// apps/backend/src/routes/driveRoutes.ts
/**
 * Drive sync routes.
 * POST /api/drive/sync-now → Trigger manual sync for the authenticated user
 * GET  /api/drive/status   → Get current sync status
 */

import { Router, type Request, type Response } from 'express';

import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { syncDriveFolder } from '../services/driveSync.js';
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

    // Get active processing jobs
    const activeJobs = await prisma.processingJob.count({
      where: {
        document: { userId: req.user.id },
        status: { in: ['QUEUED', 'RUNNING'] },
      },
    });

    res.json({
      success: true,
      data: {
        isRunning: processingDocs > 0 || activeJobs > 0,
        lastSyncAt: lastDocument?.createdAt?.toISOString() ?? null,
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
