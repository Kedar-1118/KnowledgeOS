// apps/backend/src/queues/jobWorkers.ts
/**
 * Processing Queue Workers
 *
 * Five workers that process documents through the ML pipeline:
 * 1. PARSE   → Downloads file from Drive, parses into chunks, saves to DB
 * 2. EMBED   → Sends chunks to ML service for embedding, stores in Qdrant
 * 3. SUMMARIZE → Sends text to ML service for summarization
 * 4. TAG     → Sends summary to ML service for auto-tagging
 * 5. GRAPH_EXTRACT → Sends text to ML service for entity extraction + Neo4j
 *
 * Each worker chains to the next on completion.
 */

import axios from 'axios';
import type { Job } from 'bull';

import { downloadDriveFile } from '../services/driveSync.js';
import { parseFile } from '../services/fileParser.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import {
  parseQueue,
  embedQueue,
  summarizeQueue,
  tagQueue,
  graphExtractQueue,
  forceAddToQueue,
  type ParseJobData,
  type EmbedJobData,
  type SummarizeJobData,
  type TagJobData,
  type GraphExtractJobData,
} from './processingQueue.js';

const ML_SERVICE_URL = process.env['ML_SERVICE_URL'] ?? 'http://localhost:8000';

/**
 * Update a ProcessingJob's status in the database.
 */
async function updateJobStatus(
  documentId: string,
  jobType: string,
  status: 'RUNNING' | 'DONE' | 'FAILED',
  error?: string,
): Promise<void> {
  const updateData: Record<string, unknown> = { status };

  if (status === 'RUNNING') {
    updateData['startedAt'] = new Date();
    updateData['attempts'] = { increment: 1 };
  } else if (status === 'DONE') {
    updateData['completedAt'] = new Date();
  } else if (status === 'FAILED') {
    updateData['lastError'] = error ?? 'Unknown error';
  }

  await prisma.processingJob.updateMany({
    where: { documentId, jobType: jobType as 'PARSE' | 'EMBED' | 'SUMMARIZE' | 'TAG' | 'GRAPH_EXTRACT' },
    data: updateData,
  });
}

/**
 * Sanitize strings by removing null bytes (\x00 / \u0000) to prevent Postgres database insertion errors.
 */
function sanitizeString(str: string): string;
function sanitizeString(str: string | null | undefined): string | null;
function sanitizeString(str: string | null | undefined): string | null {
  if (str === null || str === undefined) return null;
  return str.replace(/\0/g, '');
}

/**
 * Register all job workers on their respective queues.
 */
export function registerJobWorkers(): void {
  // ─── PARSE Worker ───
  parseQueue.process(2, async (job: Job<ParseJobData>) => {
    const { documentId, userId, driveFileId } = job.data;
    logger.info(`[PARSE] Starting for document ${documentId}`);

    await updateJobStatus(documentId, 'PARSE', 'RUNNING');

    try {
      // Get document info
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { mimeType: true, fileName: true },
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Download file from Drive
      const fileBuffer = await downloadDriveFile(userId, driveFileId);
      logger.info(`[PARSE] Downloaded ${document.fileName} (${fileBuffer.length} bytes)`);

      // Parse file into chunks
      const parseResult = await parseFile(fileBuffer, document.mimeType, document.fileName);
      logger.info(`[PARSE] Parsed ${document.fileName}: ${parseResult.chunks.length} chunks, ${parseResult.totalTokens} tokens`);

      // Save chunks to database
      await prisma.chunk.deleteMany({
        where: { documentId },
      });

      if (parseResult.chunks.length > 0) {
        await prisma.chunk.createMany({
          data: parseResult.chunks.map((chunk, index) => ({
            documentId,
            chunkIndex: index,
            content: sanitizeString(chunk.content),
            tokenCount: chunk.tokenCount,
            headingContext: sanitizeString(chunk.headingContext),
            pageNumber: chunk.pageNumber,
          })),
        });
      }

      // Update document metadata
      await prisma.document.update({
        where: { id: documentId },
        data: {
          title: sanitizeString(parseResult.title),
          author: sanitizeString(parseResult.author),
          readingTimeMinutes: parseResult.readingTimeMinutes,
          status: 'PROCESSING',
        },
      });

      await updateJobStatus(documentId, 'PARSE', 'DONE');

      // Chain to next step: EMBED
      if (parseResult.chunks.length > 0) {
        await forceAddToQueue(
          embedQueue,
          { documentId, userId } satisfies EmbedJobData,
          { jobId: `embed-${documentId}` },
        );
      } else {
        // No chunks to process — mark as indexed
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'INDEXED' },
        });
        logger.info(`[PARSE] No chunks for ${document.fileName}, marking as indexed`);
      }

      return { chunksCreated: parseResult.chunks.length };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Parse failed';
      await updateJobStatus(documentId, 'PARSE', 'FAILED', errMsg);
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  });

  // ─── EMBED Worker ───
  embedQueue.process(2, async (job: Job<EmbedJobData>) => {
    const { documentId, userId } = job.data;
    logger.info(`[EMBED] Starting for document ${documentId}`);

    await updateJobStatus(documentId, 'EMBED', 'RUNNING');

    try {
      // Fetch chunks for this document
      const chunks = await prisma.chunk.findMany({
        where: { documentId },
        select: { id: true, content: true },
        orderBy: { chunkIndex: 'asc' },
      });

      if (chunks.length === 0) {
        await updateJobStatus(documentId, 'EMBED', 'DONE');
        return { pointsCreated: 0 };
      }

      // Call ML service to generate embeddings and store in Qdrant
      const response = await axios.post(`${ML_SERVICE_URL}/ml/embed`, {
        chunks: chunks.map(c => ({ id: c.id, content: c.content })),
        userId,
        documentId,
      });

      const points = response.data?.points as Array<{ id: string; qdrantPointId: string }> | undefined;

      // Update chunk records with Qdrant point IDs
      if (points) {
        for (const point of points) {
          await prisma.chunk.update({
            where: { id: point.id },
            data: { qdrantPointId: point.qdrantPointId },
          });
        }
      }

      await updateJobStatus(documentId, 'EMBED', 'DONE');

      // Chain to next step: SUMMARIZE
      await forceAddToQueue(
        summarizeQueue,
        { documentId, userId } satisfies SummarizeJobData,
        { jobId: `summarize-${documentId}` },
      );

      return { pointsCreated: points?.length ?? 0 };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Embed failed';
      await updateJobStatus(documentId, 'EMBED', 'FAILED', errMsg);
      logger.error(`[EMBED] Failed for document ${documentId}:`, errMsg);
      throw error;
    }
  });

  // ─── SUMMARIZE Worker ───
  summarizeQueue.process(2, async (job: Job<SummarizeJobData>) => {
    const { documentId, userId } = job.data;
    logger.info(`[SUMMARIZE] Starting for document ${documentId}`);

    await updateJobStatus(documentId, 'SUMMARIZE', 'RUNNING');

    try {
      // Fetch first 4096 tokens of document text
      const chunks = await prisma.chunk.findMany({
        where: { documentId },
        select: { content: true, tokenCount: true },
        orderBy: { chunkIndex: 'asc' },
      });

      let text = '';
      let tokenCount = 0;
      for (const chunk of chunks) {
        if (tokenCount + chunk.tokenCount > 4096) {
          // Take partial chunk up to limit
          const remainingTokens = 4096 - tokenCount;
          const charLimit = remainingTokens * 4; // Approximate
          text += chunk.content.slice(0, charLimit);
          break;
        }
        text += chunk.content + ' ';
        tokenCount += chunk.tokenCount;
      }

      // Call ML service for summarization
      const response = await axios.post(`${ML_SERVICE_URL}/ml/summarize`, {
        text: text.trim(),
        maxLength: 150,
        minLength: 50,
      });

      const summary = response.data?.summary as string | undefined;

      // Update document with summary
      if (summary) {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            summary: sanitizeString(summary),
            summaryGeneratedAt: new Date(),
          },
        });
      }

      await updateJobStatus(documentId, 'SUMMARIZE', 'DONE');

      // Chain to next step: TAG
      await forceAddToQueue(
        tagQueue,
        { documentId, userId } satisfies TagJobData,
        { jobId: `tag-${documentId}` },
      );

      return { summary: summary?.slice(0, 100) };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Summarize failed';
      await updateJobStatus(documentId, 'SUMMARIZE', 'FAILED', errMsg);
      logger.error(`[SUMMARIZE] Failed for document ${documentId}:`, errMsg);
      throw error;
    }
  });

  // ─── TAG Worker ───
  tagQueue.process(2, async (job: Job<TagJobData>) => {
    const { documentId, userId } = job.data;
    logger.info(`[TAG] Starting for document ${documentId}`);

    await updateJobStatus(documentId, 'TAG', 'RUNNING');

    try {
      // Fetch document title and summary
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { title: true, summary: true },
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Call ML service for auto-tagging
      const response = await axios.post(`${ML_SERVICE_URL}/ml/tag`, {
        title: document.title,
        summary: document.summary ?? '',
        userId,
      });

      const tags = response.data?.tags as Array<{
        label: string;
        category: string;
        confidence: number;
      }> | undefined;

      // Upsert tags and create document-tag associations
      if (tags) {
        // Delete existing AUTO tags for this document first to avoid stale tags
        await prisma.documentTag.deleteMany({
          where: {
            documentId,
            assignedBy: 'AUTO',
          },
        });

        for (const tag of tags) {
          const sanitizedLabel = sanitizeString(tag.label);
          const sanitizedCategory = sanitizeString(tag.category);
          const tagRecord = await prisma.tag.upsert({
            where: { name: sanitizedLabel },
            update: { category: sanitizedCategory },
            create: {
              name: sanitizedLabel,
              category: sanitizedCategory,
              color: generateTagColor(sanitizedCategory),
            },
          });

          await prisma.documentTag.upsert({
            where: {
              documentId_tagId: { documentId, tagId: tagRecord.id },
            },
            update: { confidence: tag.confidence },
            create: {
              documentId,
              tagId: tagRecord.id,
              confidence: tag.confidence,
              assignedBy: 'AUTO',
            },
          });
        }
      }

      await updateJobStatus(documentId, 'TAG', 'DONE');

      // Chain to next step: GRAPH_EXTRACT
      await forceAddToQueue(
        graphExtractQueue,
        { documentId, userId } satisfies GraphExtractJobData,
        { jobId: `graph-extract-${documentId}` },
      );

      return { tagsAssigned: tags?.length ?? 0 };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Tag failed';
      await updateJobStatus(documentId, 'TAG', 'FAILED', errMsg);
      logger.error(`[TAG] Failed for document ${documentId}:`, errMsg);
      throw error;
    }
  });

  // ─── GRAPH_EXTRACT Worker ───
  graphExtractQueue.process(1, async (job: Job<GraphExtractJobData>) => {
    const { documentId, userId } = job.data;
    logger.info(`[GRAPH_EXTRACT] Starting for document ${documentId}`);

    await updateJobStatus(documentId, 'GRAPH_EXTRACT', 'RUNNING');

    try {
      // Fetch document text (concatenated chunks)
      const chunks = await prisma.chunk.findMany({
        where: { documentId },
        select: { content: true },
        orderBy: { chunkIndex: 'asc' },
      });

      const text = chunks.map(c => c.content).join(' ');

      // Call ML service for entity extraction
      const response = await axios.post(`${ML_SERVICE_URL}/ml/extract-entities`, {
        text,
        documentId,
        userId,
      });

      const entities = response.data?.entities as Array<{
        text: string;
        type: string;
        count: number;
      }> | undefined;

      // Create/update KnowledgeNode records
      if (entities) {
        for (const entity of entities) {
          const sanitizedText = sanitizeString(entity.text);
          const sanitizedType = sanitizeString(entity.type);
          const nodeType = mapEntityType(sanitizedType);
          await prisma.knowledgeNode.upsert({
            where: {
              userId_label: { userId, label: sanitizedText },
            },
            update: {
              description: `Mentioned ${entity.count} time(s) in documents`,
            },
            create: {
              userId,
              label: sanitizedText,
              type: nodeType,
              description: `Extracted from document. Mentioned ${entity.count} time(s).`,
            },
          });
        }
      }

      // Mark document as fully indexed
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'INDEXED' },
      });

      await updateJobStatus(documentId, 'GRAPH_EXTRACT', 'DONE');

      logger.info(`[GRAPH_EXTRACT] Document ${documentId} fully indexed`);

      return { entitiesExtracted: entities?.length ?? 0 };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Graph extract failed';
      await updateJobStatus(documentId, 'GRAPH_EXTRACT', 'FAILED', errMsg);
      logger.error(`[GRAPH_EXTRACT] Failed for document ${documentId}:`, errMsg);

      // Even if graph extraction fails, mark as indexed
      // since search/summarization still work
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'INDEXED' },
      });

      throw error;
    }
  });

  logger.info('All job workers registered');
}

// ─── Helpers ───

/**
 * Map NER entity types to our NodeType enum.
 */
function mapEntityType(nerType: string): 'CONCEPT' | 'PERSON' | 'PLACE' | 'TECHNOLOGY' | 'METHOD' | 'OTHER' {
  switch (nerType.toUpperCase()) {
    case 'PERSON':
    case 'PER':
      return 'PERSON';
    case 'GPE':
    case 'LOC':
    case 'PLACE':
      return 'PLACE';
    case 'TECH':
    case 'TECHNOLOGY':
    case 'PRODUCT':
      return 'TECHNOLOGY';
    case 'METHOD':
    case 'ALGORITHM':
      return 'METHOD';
    case 'CONCEPT':
    case 'NORP':
    case 'EVENT':
      return 'CONCEPT';
    default:
      return 'OTHER';
  }
}

/**
 * Generate a hex color for a tag category.
 */
function generateTagColor(category: string): string {
  const categoryColors: Record<string, string> = {
    'CS': '#1D9E75',
    'ML': '#7F77DD',
    'DL': '#9B6FE0',
    'NLP': '#6B8AFF',
    'OS': '#E07F5F',
    'DBMS': '#E0A85F',
    'Networks': '#5FC3E0',
    'Math': '#BA7517',
    'Physics': '#4A90D9',
    'Chemistry': '#27AE60',
    'Biology': '#2ECC71',
    'Law': '#8E44AD',
    'Medicine': '#E74C3C',
    'Finance': '#F39C12',
    'History': '#D4A574',
    'Literature': '#C0392B',
    'Philosophy': '#9B59B6',
  };

  return categoryColors[category] ?? '#888780';
}
