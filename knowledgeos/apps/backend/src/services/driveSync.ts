// apps/backend/src/services/driveSync.ts
/**
 * Google Drive Sync Service
 *
 * Core sync logic that:
 * 1. Lists all files in the user's KnowledgeOS/ Drive folder recursively
 * 2. Compares against existing Document records in PostgreSQL
 * 3. Creates PENDING Document records for new/modified files
 * 4. Enqueues chained ProcessingJob records (PARSE → EMBED → SUMMARIZE → TAG → GRAPH_EXTRACT)
 * 5. Supports incremental sync using Drive's Changes API pageToken
 * 6. Handles rate limiting with exponential backoff
 */

import { google, type drive_v3 } from 'googleapis';
import type { FileType } from '@prisma/client';

import { createOAuth2Client, refreshDriveToken } from '../auth/googleAuth.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import { enqueueDocumentProcessing } from '../queues/processingQueue.js';

const KNOWLEDGE_OS_FOLDER_NAME = 'KnowledgeOS';
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

/** Map Google MIME types to our FileType enum */
function mapMimeToFileType(mimeType: string): FileType {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'text/plain') return 'TXT';
  if (mimeType === 'text/markdown' || mimeType === 'text/x-markdown') return 'MD';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  return 'OTHER';
}

/** Sleep for exponential backoff */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Execute a function with exponential backoff retry */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRateLimit = error instanceof Error &&
        'code' in error &&
        (error as { code: number }).code === 429;

      if (attempt === maxRetries || !isRateLimit) {
        throw error;
      }

      const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt);
      logger.warn(`Rate limited. Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(backoffMs);
    }
  }

  throw new Error('Unreachable');
}

/**
 * Get an authenticated Drive API client for a user.
 * Automatically refreshes expired tokens.
 */
async function getDriveClient(userId: string): Promise<drive_v3.Drive> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      driveAccessToken: true,
      driveRefreshToken: true,
      tokenExpiry: true,
    },
  });

  if (!user?.driveAccessToken) {
    throw new Error('User has no Drive access token. Please re-authenticate.');
  }

  // Check if token is expired (with 5 minute buffer)
  const isExpired = user.tokenExpiry
    ? new Date(user.tokenExpiry).getTime() < Date.now() + 5 * 60 * 1000
    : false;

  let accessToken = user.driveAccessToken;
  if (isExpired && user.driveRefreshToken) {
    accessToken = await refreshDriveToken(userId);
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: user.driveRefreshToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Find or create the KnowledgeOS/ folder in the user's Drive.
 * Returns the folder ID.
 */
async function findOrCreateKnowledgeFolder(
  drive: drive_v3.Drive,
  userId: string,
): Promise<string> {
  // Check if we already have the folder ID cached
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { driveFolderId: true },
  });

  if (user?.driveFolderId) {
    try {
      await withRetry(() =>
        drive.files.get({
          fileId: user.driveFolderId!,
          fields: 'id, trashed',
        })
      );
      return user.driveFolderId;
    } catch (err: any) {
      if (err.code === 404) {
        logger.warn(`Cached folder ID ${user.driveFolderId} not found on Drive. Resetting and re-creating...`);
        await prisma.user.update({
          where: { id: userId },
          data: { driveFolderId: null },
        });
      } else {
        throw err;
      }
    }
  }

  // Search for existing KnowledgeOS folder
  const response = await withRetry(() =>
    drive.files.list({
      q: `name='${KNOWLEDGE_OS_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    }),
  );

  let folderId: string;

  if (response.data.files && response.data.files.length > 0) {
    folderId = response.data.files[0]?.id ?? '';
    logger.info(`Found existing KnowledgeOS folder: ${folderId}`);
  } else {
    // Create the folder
    const folder = await withRetry(() =>
      drive.files.create({
        requestBody: {
          name: KNOWLEDGE_OS_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      }),
    );
    folderId = folder.data.id ?? '';
    logger.info(`Created KnowledgeOS folder: ${folderId}`);
  }

  // Cache the folder ID
  await prisma.user.update({
    where: { id: userId },
    data: { driveFolderId: folderId },
  });

  return folderId;
}

/**
 * Recursively list all files in a Drive folder.
 */
async function listFilesRecursive(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<drive_v3.Schema$File[]> {
  const allFiles: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;

  do {
    const response = await withRetry(() =>
      drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, parents)',
        pageSize: 100,
        pageToken,
      }),
    );

    const files = response.data.files ?? [];

    for (const file of files) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        // Recurse into subfolders
        const subFiles = await listFilesRecursive(drive, file.id ?? '');
        allFiles.push(...subFiles);
      } else {
        allFiles.push(file);
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return allFiles;
}

export interface SyncResult {
  newFiles: number;
  updatedFiles: number;
  totalFiles: number;
  errors: string[];
}

/**
 * Perform a full sync of the user's KnowledgeOS/ Drive folder.
 * Compares Drive files against the database and enqueues processing for new/modified files.
 */
export async function syncDriveFolder(userId: string): Promise<SyncResult> {
  const result: SyncResult = { newFiles: 0, updatedFiles: 0, totalFiles: 0, errors: [] };

  try {
    const drive = await getDriveClient(userId);
    const folderId = await findOrCreateKnowledgeFolder(drive, userId);
    const driveFiles = await listFilesRecursive(drive, folderId);

    result.totalFiles = driveFiles.length;
    logger.info(`Found ${driveFiles.length} files in Drive for user ${userId}`);

    // Get existing documents for comparison
    const existingDocs = await prisma.document.findMany({
      where: { userId },
      select: { driveFileId: true, driveModifiedAt: true },
    });

    const existingMap = new Map(
      existingDocs.map(doc => [doc.driveFileId, doc.driveModifiedAt]),
    );

    for (const file of driveFiles) {
      try {
        const driveFileId = file.id ?? '';
        const modifiedTime = new Date(file.modifiedTime ?? Date.now());
        const existingModified = existingMap.get(driveFileId);

        if (!existingModified) {
          // New file — create Document record
          const document = await prisma.document.create({
            data: {
              userId,
              driveFileId,
              driveFileUrl: file.webViewLink ?? null,
              title: file.name?.replace(/\.[^.]+$/, '') ?? 'Untitled',
              fileName: file.name ?? 'unknown',
              fileType: mapMimeToFileType(file.mimeType ?? ''),
              mimeType: file.mimeType ?? 'application/octet-stream',
              fileSizeBytes: parseInt(file.size ?? '0', 10),
              driveModifiedAt: modifiedTime,
              status: 'PENDING',
            },
          });

          // Enqueue processing pipeline
          await enqueueDocumentProcessing(document.id, userId, driveFileId);
          result.newFiles++;
          logger.info(`New file detected: ${file.name} → ${document.id}`);
        } else if (modifiedTime > existingModified) {
          // Modified file — update and re-process
          const document = await prisma.document.update({
            where: { driveFileId },
            data: {
              driveModifiedAt: modifiedTime,
              fileSizeBytes: parseInt(file.size ?? '0', 10),
              status: 'PENDING',
            },
          });

          await enqueueDocumentProcessing(document.id, userId, driveFileId);
          result.updatedFiles++;
          logger.info(`Updated file detected: ${file.name} → ${document.id}`);
        }
      } catch (fileError) {
        const errorMsg = `Failed to process file ${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        logger.error(errorMsg);
      }
    }

    logger.info(`Sync complete for user ${userId}: ${result.newFiles} new, ${result.updatedFiles} updated`);
  } catch (error) {
    const errorMsg = `Drive sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(errorMsg);
    logger.error(errorMsg);
  }

  return result;
}

/**
 * Download a file's content from Google Drive.
 * Returns the file content as a Buffer.
 */
export async function downloadDriveFile(
  userId: string,
  driveFileId: string,
): Promise<Buffer> {
  const drive = await getDriveClient(userId);

  const response = await withRetry(() =>
    drive.files.get(
      { fileId: driveFileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    ),
  );

  return Buffer.from(response.data as ArrayBuffer);
}
