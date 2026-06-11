// apps/backend/src/queues/processingQueue.ts
/**
 * Bull Processing Queue — Redis-backed job queue for document processing.
 *
 * Manages the processing pipeline: PARSE → EMBED → SUMMARIZE → TAG → GRAPH_EXTRACT
 * Each job type has its own queue for independent scaling and monitoring.
 */

import Bull from 'bull';

import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import { registerJobWorkers } from './jobWorkers.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

// ─── Queue Definitions ───

export const parseQueue = new Bull('parse', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const embedQueue = new Bull('embed', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const summarizeQueue = new Bull('summarize', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const tagQueue = new Bull('tag', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const graphExtractQueue = new Bull('graph-extract', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

// ─── Job Data Types ───

export interface ParseJobData {
  documentId: string;
  userId: string;
  driveFileId: string;
}

export interface EmbedJobData {
  documentId: string;
  userId: string;
}

export interface SummarizeJobData {
  documentId: string;
  userId: string;
}

export interface TagJobData {
  documentId: string;
  userId: string;
}

export interface GraphExtractJobData {
  documentId: string;
  userId: string;
}

// ─── Enqueue Processing Pipeline ───

/**
 * Enqueue the full processing pipeline for a document.
 * Creates ProcessingJob records in the database and adds the first job (PARSE) to the queue.
 * Subsequent jobs are chained: each worker enqueues the next step on completion.
 */
export async function enqueueDocumentProcessing(
  documentId: string,
  userId: string,
  driveFileId: string,
): Promise<void> {
  // Create all ProcessingJob records
  const jobTypes = ['PARSE', 'EMBED', 'SUMMARIZE', 'TAG', 'GRAPH_EXTRACT'] as const;

  await prisma.processingJob.createMany({
    data: jobTypes.map(jobType => ({
      documentId,
      jobType,
      status: jobType === 'PARSE' ? 'QUEUED' : 'QUEUED',
    })),
    skipDuplicates: true,
  });

  // Enqueue the first step
  await parseQueue.add(
    { documentId, userId, driveFileId } satisfies ParseJobData,
    { jobId: `parse-${documentId}` },
  );

  logger.info(`Processing pipeline enqueued for document ${documentId}`);
}

// ─── Initialize Queue Workers ───

/**
 * Initialize all queue workers. Called on server startup.
 */
export async function initializeProcessingQueue(): Promise<void> {
  logger.info('Initializing processing queue workers...');

  registerJobWorkers();

  // Log queue events for monitoring
  const queues = [
    { name: 'parse', queue: parseQueue },
    { name: 'embed', queue: embedQueue },
    { name: 'summarize', queue: summarizeQueue },
    { name: 'tag', queue: tagQueue },
    { name: 'graph-extract', queue: graphExtractQueue },
  ];

  for (const { name, queue } of queues) {
    queue.on('error', (error: Error) => {
      logger.error(`Queue ${name} error:`, error);
    });

    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} in queue ${name} failed:`, error.message);
    });

    queue.on('completed', (job) => {
      logger.debug(`Job ${job.id} in queue ${name} completed`);
    });
  }

  logger.info('Processing queue workers initialized');
}
