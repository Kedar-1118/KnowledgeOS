// apps/backend/src/routes/chunkRoutes.ts
/**
 * Chunk routes.
 * GET /api/documents/:id/chunks → Get all text chunks for a document
 */

import { Router, type Request, type Response } from 'express';

import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

export const chunkRouter = Router();

// All chunk routes require authentication
chunkRouter.use(jwtMiddleware);

/**
 * GET /api/documents/:id/chunks
 * Returns all chunks for a document, ordered by chunkIndex.
 */
chunkRouter.get('/documents/:id/chunks', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
      return;
    }

    // Verify document belongs to user
    const document = await prisma.document.findFirst({
      where: { id: req.params['id'], userId: req.user.id },
      select: { id: true, title: true },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    const chunks = await prisma.chunk.findMany({
      where: { documentId: document.id },
      select: {
        id: true,
        chunkIndex: true,
        content: true,
        tokenCount: true,
        headingContext: true,
        pageNumber: true,
        createdAt: true,
      },
      orderBy: { chunkIndex: 'asc' },
    });

    res.json({
      success: true,
      data: {
        documentId: document.id,
        documentTitle: document.title,
        chunks,
        totalChunks: chunks.length,
        totalTokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
      },
    });
  } catch (error) {
    logger.error('Get chunks failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CHUNKS_FAILED', message: 'Failed to get chunks' },
    });
  }
});
