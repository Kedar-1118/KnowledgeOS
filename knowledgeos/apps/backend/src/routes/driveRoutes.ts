// apps/backend/src/routes/driveRoutes.ts
/**
 * Drive sync routes.
 * POST /api/drive/sync-now → Trigger manual sync for the authenticated user
 * GET  /api/drive/status   → Get current sync status
 */

import { Router, type Request, type Response } from 'express';

import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { syncDriveFolder, getDriveClient, findOrCreateKnowledgeFolder } from '../services/driveSync.js';
import { enqueueDocumentProcessing } from '../queues/processingQueue.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

export const driveRouter = Router();

// All drive routes require authentication
driveRouter.use(jwtMiddleware);

/**
 * POST /api/drive/sync-now
 * Triggers an immediate sync of the user's KnowledgeOS/ Drive folder.
 */
driveRouter.post('/sync-now', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    logger.info(`Manual sync triggered by user ${req.user.email}`);

    const result = await syncDriveFolder(req.user.id);

    res.json({
      success: true,
      data: {
        newFiles: result.newFiles,
        updatedFiles: result.updatedFiles,
        totalFiles: result.totalFiles,
        errors: result.errors,
      },
    });
  } catch (error) {
    logger.error('Manual sync failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SYNC_FAILED',
        message: error instanceof Error ? error.message : 'Drive sync failed',
      },
    });
  }
});

/**
 * POST /api/drive/upload/init
 * Initialize a resumable upload session to Google Drive
 */
driveRouter.post('/upload/init', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      return;
    }

    const { fileName, mimeType } = req.body;
    if (!fileName || !mimeType) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'fileName and mimeType required' } });
      return;
    }

    logger.info(`Init upload for ${fileName} by ${req.user.email}`);
    
    const drive = await getDriveClient(req.user.id);
    const folderId = await findOrCreateKnowledgeFolder(drive, req.user.id);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: { mimeType },
      fields: 'id',
    }, {
      options: { url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable' }
    });

    res.json({
      success: true,
      data: {
        uploadUrl: response.headers.location,
        tempFileId: response.data.id,
      }
    });
  } catch (error) {
    logger.error('Failed to init upload:', error);
    res.status(500).json({ success: false, error: { code: 'UPLOAD_INIT_FAILED', message: 'Failed to initialize upload' } });
  }
});

/**
 * POST /api/drive/upload/complete
 * Trigger sync processing after upload is complete
 */
driveRouter.post('/upload/complete', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      return;
    }

    const { fileId } = req.body;
    if (!fileId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'fileId required' } });
      return;
    }

    logger.info(`Completing upload for fileId ${fileId} by ${req.user.email}`);

    // Call sync function to let it pick up the new file and enqueue jobs
    // In a more optimized version, we'd directly create the document and enqueue
    const result = await syncDriveFolder(req.user.id);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to complete upload:', error);
    res.status(500).json({ success: false, error: { code: 'UPLOAD_COMPLETE_FAILED', message: 'Failed to complete upload' } });
  }
});

/**
 * GET /api/drive/status
 * Returns the current sync status for the authenticated user.
 */
driveRouter.get('/status', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    // Get document counts by status
    const [totalDocs, pendingDocs, processingDocs, indexedDocs, failedDocs] = await Promise.all([
      prisma.document.count({ where: { userId: req.user.id } }),
      prisma.document.count({ where: { userId: req.user.id, status: 'PENDING' } }),
      prisma.document.count({ where: { userId: req.user.id, status: 'PROCESSING' } }),
      prisma.document.count({ where: { userId: req.user.id, status: 'INDEXED' } }),
      prisma.document.count({ where: { userId: req.user.id, status: 'FAILED' } }),
    ]);


    // Get last sync time (most recent document creation)
    const lastDocument = await prisma.document.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // Get active processing jobs and cached folder ID
    const [activeJobs, user] = await Promise.all([
      prisma.processingJob.count({
        where: {
          document: { userId: req.user.id },
          status: { in: ['QUEUED', 'RUNNING'] },
        },
      }),
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { driveFolderId: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        isRunning: processingDocs > 0 || activeJobs > 0,
        lastSyncAt: lastDocument?.createdAt?.toISOString() ?? null,
        driveFolderId: user?.driveFolderId ?? null,
        driveFolderUrl: user?.driveFolderId ? `https://drive.google.com/drive/folders/${user.driveFolderId}` : null,
        documents: {
          total: totalDocs,
          pending: pendingDocs,
          processing: processingDocs,
          indexed: indexedDocs,
          failed: failedDocs,
        },
        activeJobs,
      },
    });
  } catch (error) {
    logger.error('Failed to get sync status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_FAILED',
        message: 'Failed to retrieve sync status',
      },
    });
  }
});
