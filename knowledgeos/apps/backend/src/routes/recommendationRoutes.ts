// apps/backend/src/routes/recommendationRoutes.ts
/**
 * Recommendation routes.
 * GET  /api/recommendations     → Get personalized document recommendations
 * POST /api/recommendations/log → Log a recommendation interaction (click, dismiss)
 */

import { Router, type Request, type Response } from 'express';

import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

export const recommendationRouter = Router();

recommendationRouter.use(jwtMiddleware);

/**
 * GET /api/recommendations
 * Returns personalized document recommendations based on:
 * 1. Recently accessed documents (find similar via shared tags)
 * 2. Least accessed but indexed documents
 * 3. Documents related to frequently searched topics
 */
recommendationRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const userId = req.user.id;

    // 1. Get recently accessed documents' tags
    const recentDocs = await prisma.document.findMany({
      where: { userId, status: 'INDEXED' },
      orderBy: { lastAccessedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        documentTags: { select: { tagId: true } },
      },
    });

    const recentTagIds = new Set(
      recentDocs.flatMap(d => d.documentTags.map(dt => dt.tagId))
    );
    const recentDocIds = new Set(recentDocs.map(d => d.id));

    // 2. Find similar documents (share tags with recent, but haven't been accessed recently)
    let similarDocs: Array<{
      id: string;
      title: string;
      fileName: string;
      fileType: string;
      summary: string | null;
      readingTimeMinutes: number | null;
      accessCount: number;
      driveFileUrl: string | null;
      documentTags: Array<{
        confidence: number;
        tag: { name: string; category: string | null; color: string | null };
      }>;
    }> = [];

    if (recentTagIds.size > 0) {
      similarDocs = await prisma.document.findMany({
        where: {
          userId,
          status: 'INDEXED',
          id: { notIn: [...recentDocIds] },
          documentTags: {
            some: { tagId: { in: [...recentTagIds] } },
          },
        },
        select: {
          id: true,
          title: true,
          fileName: true,
          fileType: true,
          summary: true,
          readingTimeMinutes: true,
          accessCount: true,
          driveFileUrl: true,
          documentTags: {
            select: {
              confidence: true,
              tag: { select: { name: true, category: true, color: true } },
            },
          },
        },
        orderBy: { accessCount: 'asc' },
        take: 5,
      });
    }

    // 3. Get least accessed indexed docs (discovery recommendations)
    const undiscoveredDocs = await prisma.document.findMany({
      where: {
        userId,
        status: 'INDEXED',
        id: { notIn: [...recentDocIds, ...similarDocs.map(d => d.id)] },
      },
      select: {
        id: true,
        title: true,
        fileName: true,
        fileType: true,
        summary: true,
        readingTimeMinutes: true,
        accessCount: true,
        driveFileUrl: true,
        documentTags: {
          select: {
            confidence: true,
            tag: { select: { name: true, category: true, color: true } },
          },
        },
      },
      orderBy: { accessCount: 'asc' },
      take: 5,
    });

    // Format response
    const formatDoc = (doc: typeof similarDocs[0], reason: string) => ({
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      fileType: doc.fileType,
      summary: doc.summary,
      readingTimeMinutes: doc.readingTimeMinutes,
      accessCount: doc.accessCount,
      driveFileUrl: doc.driveFileUrl,
      reason,
      tags: doc.documentTags.map(dt => ({
        name: dt.tag.name,
        category: dt.tag.category,
        color: dt.tag.color,
        confidence: dt.confidence,
      })),
    });

    const recommendations = [
      ...similarDocs.map(d => formatDoc(d, 'Similar to your recent reads')),
      ...undiscoveredDocs.map(d => formatDoc(d, 'Discover something new')),
    ];

    res.json({
      success: true,
      data: {
        recommendations,
        totalCount: recommendations.length,
      },
    });
  } catch (error) {
    logger.error('Get recommendations failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'RECOMMENDATIONS_FAILED', message: 'Failed to get recommendations' },
    });
  }
});
