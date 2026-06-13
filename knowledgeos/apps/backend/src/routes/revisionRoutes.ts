// apps/backend/src/routes/revisionRoutes.ts
/**
 * Spaced Repetition / Revision routes.
 * GET  /api/revision/due       → Get revision items due today
 * POST /api/revision/review    → Submit a review result (SM-2 algorithm)
 * POST /api/revision/create    → Create a revision item from a document chunk
 * GET  /api/revision/stats     → Get revision statistics
 */

import { Router, type Request, type Response } from 'express';

import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

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
        chunk: {
          select: {
            content: true,
            headingContext: true,
            pageNumber: true,
            document: {
              select: { id: true, title: true, fileType: true },
            },
          },
        },
      },
      orderBy: { nextReviewAt: 'asc' },
      take: 20,
    });

    const formatted = dueItems.map(item => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
      hint: item.hint,
      difficulty: item.difficulty,
      easeFactor: item.easeFactor,
      interval: item.interval,
      repetitions: item.repetitions,
      nextReviewAt: item.nextReviewAt.toISOString(),
      chunk: item.chunk ? {
        content: item.chunk.content,
        headingContext: item.chunk.headingContext,
        pageNumber: item.chunk.pageNumber,
        document: item.chunk.document,
      } : null,
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
    let { easeFactor, interval, repetitions } = item;

    if (quality >= 3) {
      // Correct response
      if (repetitions === 0) {
        interval = 1; // 1 day
      } else if (repetitions === 1) {
        interval = 6; // 6 days
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    } else {
      // Incorrect response — reset
      repetitions = 0;
      interval = 1;
    }

    // Update ease factor
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(1.3, easeFactor); // Minimum EF of 1.3

    // Calculate next review date
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + interval);

    // Update the revision item
    const updated = await prisma.revisionItem.update({
      where: { id: itemId },
      data: {
        easeFactor,
        interval,
        repetitions,
        nextReviewAt,
        lastReviewedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        easeFactor: updated.easeFactor,
        interval: updated.interval,
        repetitions: updated.repetitions,
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
 * Create a new revision item from a document chunk.
 * Body: { chunkId: string, question: string, answer: string, hint?: string }
 */
revisionRouter.post('/create', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { chunkId, question, answer, hint } = req.body as {
      chunkId: string;
      question: string;
      answer: string;
      hint?: string;
    };

    if (!chunkId || !question || !answer) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'chunkId, question, and answer are required' },
      });
      return;
    }

    // Verify chunk belongs to user's document
    const chunk = await prisma.chunk.findFirst({
      where: {
        id: chunkId,
        document: { userId: req.user.id },
      },
    });

    if (!chunk) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chunk not found' },
      });
      return;
    }

    const revisionItem = await prisma.revisionItem.create({
      data: {
        userId: req.user.id,
        chunkId,
        question,
        answer,
        hint: hint ?? null,
        difficulty: 'MEDIUM',
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
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
        where: { userId: req.user.id, repetitions: { gte: 5 } },
      }),
      prisma.revisionItem.aggregate({
        where: { userId: req.user.id },
        _avg: { easeFactor: true },
      }),
    ]);

    // Items due in next 7 days
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dueThisWeek = await prisma.revisionItem.count({
      where: {
        userId: req.user.id,
        nextReviewAt: { lte: nextWeek, gt: now },
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
