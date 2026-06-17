// apps/backend/src/routes/revisionRoutes.ts
/**
 * Spaced Repetition / Revision routes.
 * GET  /api/revision/due       → Get revision items due today
 * POST /api/revision/review    → Submit a review result (SM-2 algorithm)
 * POST /api/revision/create    → Create a revision item for a document topic
 * GET  /api/revision/stats     → Get revision statistics
 */

import { Router, type Request, type Response } from 'express';

import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import { generateCardsQueue } from '../queues/processingQueue.js';

export const revisionRouter = Router();

revisionRouter.use(jwtMiddleware);

/**
 * GET /api/revision/due
 * Returns all revision items that are due for review (nextReviewAt <= now).
 */
revisionRouter.get('/due', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const dueItems = await prisma.revisionItem.findMany({
      where: {
        userId: req.user.id,
        nextReviewAt: { lte: new Date() },
      },
      include: {
        document: {
          select: { id: true, title: true, fileType: true, summary: true },
        },
      },
      orderBy: { nextReviewAt: 'asc' },
      take: 20,
    });

    const formatted = dueItems.map(item => ({
      id: item.id,
      topicName: item.topicName,
      easeFactor: item.easeFactor,
      intervalDays: item.intervalDays,
      repetitionCount: item.repetitionCount,
      nextReviewAt: item.nextReviewAt.toISOString(),
      document: {
        id: item.document.id,
        title: item.document.title,
        fileType: item.document.fileType,
        summary: item.document.summary,
      },
    }));

    res.json({
      success: true,
      data: { items: formatted, totalDue: formatted.length },
    });
  } catch (error) {
    logger.error('Get due revisions failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'REVISION_FAILED', message: 'Failed to get due revisions' },
    });
  }
});

/**
 * POST /api/revision/review
 * Submit a review result. Updates the revision item using the SM-2 algorithm.
 *
 * Body: { itemId: string, quality: number (0-5) }
 * Quality scale: 0=complete blackout, 3=correct with difficulty, 5=perfect
 */
revisionRouter.post('/review', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { itemId, quality } = req.body as { itemId: string; quality: number };

    if (!itemId || quality === undefined || quality < 0 || quality > 5) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'itemId and quality (0-5) are required' },
      });
      return;
    }

    const item = await prisma.revisionItem.findFirst({
      where: { id: itemId, userId: req.user.id },
    });

    if (!item) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Revision item not found' },
      });
      return;
    }

    // ─── SM-2 Algorithm ───
    let { easeFactor, intervalDays, repetitionCount } = item;

    if (quality >= 3) {
      // Correct response
      if (repetitionCount === 0) {
        intervalDays = 1; // 1 day
      } else if (repetitionCount === 1) {
        intervalDays = 6; // 6 days
      } else {
        intervalDays = Math.round(intervalDays * easeFactor);
      }
      repetitionCount += 1;
    } else {
      // Incorrect response — reset
      repetitionCount = 0;
      intervalDays = 1;
    }

    // Update ease factor
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(1.3, easeFactor); // Minimum EF of 1.3

    // Calculate next review date
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

    // Update the revision item
    const updated = await prisma.revisionItem.update({
      where: { id: itemId },
      data: {
        easeFactor,
        intervalDays,
        repetitionCount,
        nextReviewAt,
      },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        easeFactor: updated.easeFactor,
        intervalDays: updated.intervalDays,
        repetitionCount: updated.repetitionCount,
        nextReviewAt: updated.nextReviewAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Review submission failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'REVIEW_FAILED', message: 'Failed to submit review' },
    });
  }
});

/**
 * POST /api/revision/create
 * Create a new revision item for a document topic.
 * Body: { documentId: string, topicName: string }
 */
revisionRouter.post('/create', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { documentId, topicName } = req.body as {
      documentId: string;
      topicName: string;
    };

    if (!documentId || !topicName) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'documentId and topicName are required' },
      });
      return;
    }

    // Verify document belongs to user
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId: req.user.id },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    const revisionItem = await prisma.revisionItem.create({
      data: {
        userId: req.user.id,
        documentId,
        topicName,
        easeFactor: 2.5,
        intervalDays: 1,
        repetitionCount: 0,
        nextReviewAt: new Date(), // Due immediately
      },
    });

    res.json({
      success: true,
      data: revisionItem,
    });
  } catch (error) {
    logger.error('Create revision item failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_FAILED', message: 'Failed to create revision item' },
    });
  }
});

/**
 * POST /api/revision/generate/:documentId
 * Trigger AI generation of flashcards for a specific document.
 */
revisionRouter.post('/generate/:documentId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { documentId } = req.params;

    if (!documentId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'documentId required' } });
      return;
    }

    // Verify document belongs to user
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId: req.user.id },
    });

    if (!document) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      return;
    }

    // Enqueue generation job
    await generateCardsQueue.add({
      documentId,
      userId: req.user.id,
    }, {
      jobId: `generate-cards-${documentId}-${Date.now()}` // Allow multiple generations
    });

    res.json({ success: true, message: 'Flashcard generation started' });
  } catch (error) {
    logger.error('Generate cards failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GENERATE_FAILED', message: 'Failed to trigger card generation' },
    });
  }
});

/**
 * GET /api/revision/stats
 * Returns revision statistics for the user.
 */
revisionRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const now = new Date();

    const [totalItems, dueNow, masteredItems, averageEaseFactor] = await Promise.all([
      prisma.revisionItem.count({ where: { userId: req.user.id } }),
      prisma.revisionItem.count({
        where: { userId: req.user.id, nextReviewAt: { lte: now } },
      }),
      prisma.revisionItem.count({
        where: { userId: req.user.id, repetitionCount: { gte: 5 } },
      }),
      prisma.revisionItem.aggregate({
        where: { userId: req.user.id },
        _avg: { easeFactor: true },
      }),
    ]);

    // Items due in next 7 days (including those due now)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dueThisWeek = await prisma.revisionItem.count({
      where: {
        userId: req.user.id,
        nextReviewAt: { lte: nextWeek },
      },
    });

    res.json({
      success: true,
      data: {
        totalItems,
        dueNow,
        dueThisWeek,
        masteredItems,
        averageEaseFactor: averageEaseFactor._avg.easeFactor ?? 2.5,
        retentionRate: totalItems > 0 ? Math.round((masteredItems / totalItems) * 100) : 0,
      },
    });
  } catch (error) {
    logger.error('Get revision stats failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'STATS_FAILED', message: 'Failed to get revision stats' },
    });
  }
});
