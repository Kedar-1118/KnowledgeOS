// apps/backend/src/routes/heatmapRoutes.ts
import { Router, type Request, type Response } from 'express';
import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

export const heatmapRouter = Router();

heatmapRouter.use(jwtMiddleware);

/**
 * GET /api/heatmap
 * Classifies document knowledge into Hot, Cold, and Forgotten Knowledge based on activity parameters.
 */
heatmapRouter.get('/heatmap', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const userId = req.user.id;
    const documents = await prisma.document.findMany({
      where: { userId, status: 'INDEXED' },
      select: {
        id: true,
        title: true,
        accessCount: true,
        lastAccessedAt: true,
        createdAt: true,
        revisionItems: {
          select: {
            repetitionCount: true,
            easeFactor: true,
            nextReviewAt: true,
            updatedAt: true
          }
        }
      }
    });

    const hot: any[] = [];
    const cold: any[] = [];
    const forgotten: any[] = [];

    const now = new Date().getTime();

    for (const doc of documents) {
      let temp = 10; // baseline

      // Views increase temperature
      temp += doc.accessCount * 8;

      // Revisions increase temperature
      let maxRepetitions = 0;
      let lowestEase = 2.5;
      let overdue = false;
      let lastRevisionTime = 0;

      for (const rev of doc.revisionItems) {
        maxRepetitions = Math.max(maxRepetitions, rev.repetitionCount);
        lowestEase = Math.min(lowestEase, rev.easeFactor);
        lastRevisionTime = Math.max(lastRevisionTime, new Date(rev.updatedAt).getTime());
        if (new Date(rev.nextReviewAt).getTime() < now) {
          overdue = true;
        }
      }

      temp += maxRepetitions * 12;

      // Decay temperature based on time since last access
      const lastInteraction = Math.max(
        doc.lastAccessedAt ? new Date(doc.lastAccessedAt).getTime() : new Date(doc.createdAt).getTime(),
        lastRevisionTime
      );

      const daysAgo = (now - lastInteraction) / (1000 * 60 * 60 * 24);
      temp = Math.max(0, temp - daysAgo * 2.5); // Decay by 2.5 temperature units per day

      // Cap temperature at 100
      temp = Math.round(Math.min(100, temp));

      const docItem = {
        id: doc.id,
        title: doc.title,
        temperature: temp,
        accessCount: doc.accessCount,
        lastAccessedAt: doc.lastAccessedAt
      };

      // Classification logic
      if (overdue && lowestEase < 2.0) {
        forgotten.push(docItem);
      } else if (temp > 60 || daysAgo < 3) {
        hot.push(docItem);
      } else {
        cold.push(docItem);
      }
    }

    res.json({
      success: true,
      data: {
        hot: hot.sort((a, b) => b.temperature - a.temperature),
        cold: cold.sort((a, b) => b.temperature - a.temperature),
        forgotten: forgotten.sort((a, b) => a.temperature - b.temperature) // lowest temperature first
      }
    });
  } catch (error: any) {
    logger.error('Failed to calculate heatmap:', error);
    res.status(500).json({ success: false, error: { code: 'HEATMAP_FAILED', message: error.message } });
  }
});

/**
 * GET /api/analytics
 * Retrieve weekly, monthly, and yearly learning analytics.
 */
heatmapRouter.get('/analytics', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const userId = req.user.id;

    // Fetch counts
    const [docsCount, nodesCount, tagsCount, searchCount] = await Promise.all([
      prisma.document.count({ where: { userId } }),
      prisma.knowledgeNode.count({ where: { userId } }),
      prisma.tag.count(),
      prisma.searchHistory.count({ where: { userId } })
    ]);

    // Fetch chat history message counts
    const conversations = await prisma.documentConversation.findMany({
      where: { userId },
      select: { history: true }
    });
    let totalMessages = 0;
    for (const c of conversations) {
      if (Array.isArray(c.history)) {
        totalMessages += c.history.length;
      }
    }

    // Get weekly growth metrics (simulate history by sorting by createdAt)
    const docs = await prisma.document.findMany({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' }
    });

    // Group document growth by month
    const growthTrend: Record<string, number> = {};
    let cumulative = 0;
    for (const doc of docs) {
      const month = new Date(doc.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
      cumulative++;
      growthTrend[month] = cumulative;
    }

    const growthTrendArray = Object.keys(growthTrend).map(month => ({
      period: month,
      count: growthTrend[month]
    }));

    // Revisions performance retention
    const revisions = await prisma.revisionItem.findMany({
      where: { userId },
      select: { repetitionCount: true, easeFactor: true }
    });

    const mastered = revisions.filter(r => r.repetitionCount >= 5).length;
    const learning = revisions.filter(r => r.repetitionCount < 5).length;

    res.json({
      success: true,
      data: {
        summary: {
          documentsIndexed: docsCount,
          knowledgeNodes: nodesCount,
          tagsAssigned: tagsCount,
          searchesPerformed: searchCount,
          chatMessagesSent: totalMessages
        },
        growthTrend: growthTrendArray.slice(-12), // return last 12 periods
        revisionsDistribution: {
          mastered,
          learning,
          total: revisions.length
        }
      }
    });
  } catch (error: any) {
    logger.error('Failed to get analytics data:', error);
    res.status(500).json({ success: false, error: { code: 'ANALYTICS_FAILED', message: error.message } });
  }
});
