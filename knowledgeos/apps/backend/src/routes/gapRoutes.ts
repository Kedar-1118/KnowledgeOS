// apps/backend/src/routes/gapRoutes.ts
import { Router, type Request, type Response } from 'express';
import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { prisma } from '../utils/prisma.js';
import { analyzeKnowledgeGaps } from '../services/knowledgeAnalyzer.js';
import { logger } from '../utils/logger.js';

export const gapRouter = Router();

gapRouter.use(jwtMiddleware);

/**
 * GET /api/gaps
 * Retrieve user's knowledge gaps. Supports forced re-analysis via ?reanalyze=true.
 */
gapRouter.get('/gaps', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { reanalyze } = req.query;
    const userId = req.user.id;

    // Check if we already have gaps saved
    let gaps = await prisma.knowledgeGap.findMany({
      where: { userId },
      orderBy: { confidence: 'desc' },
    });

    if (gaps.length === 0 || reanalyze === 'true') {
      await analyzeKnowledgeGaps(userId);
      gaps = await prisma.knowledgeGap.findMany({
        where: { userId },
        orderBy: { confidence: 'desc' },
      });
    }

    res.json({ success: true, data: gaps });
  } catch (error: any) {
    logger.error('Failed to get knowledge gaps:', error);
    res.status(500).json({ success: false, error: { code: 'GAPS_FAILED', message: error.message } });
  }
});
