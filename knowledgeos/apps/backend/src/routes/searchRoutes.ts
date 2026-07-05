// apps/backend/src/routes/searchRoutes.ts
/**
 * Search and Q&A routes.
 * POST /api/search → Proxy search request to ML service + log
 * POST /api/qa    → Proxy Q&A request to ML service (SSE streaming)
 */

import axios from 'axios';
import { Router, type Request, type Response } from 'express';

import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

export const searchRouter = Router();

const ML_SERVICE_URL = process.env['ML_SERVICE_URL'] ?? 'http://localhost:8000';

// All search routes require authentication
searchRouter.use(jwtMiddleware);

/**
 * POST /api/search
 * Proxies semantic search request to ML service.
 * Logs the query to SearchHistory and enriches results with document metadata.
 */
searchRouter.post('/search', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    const { query, topK, filters } = req.body as {
      query: string;
      topK?: number;
      filters?: Record<string, unknown>;
    };

    if (!query?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Query string is required' },
      });
      return;
    }

    // 1. Resolve accessible document IDs and group them by owner userId
    const userSpaces = await prisma.spaceMember.findMany({
      where: { userId: req.user.id },
      select: { spaceId: true },
    });
    const spaceIds = userSpaces.map(s => s.spaceId).filter(Boolean);

    let docWhereClause: any = {
      OR: [
        { userId: req.user.id },
        { spaceId: { in: spaceIds } },
      ],
      status: 'INDEXED',
    };

    // Apply space filter if present
    const filterSpaceId = filters?.spaceId as string | undefined;
    if (filterSpaceId) {
      if (filterSpaceId === 'personal') {
        docWhereClause = {
          userId: req.user.id,
          spaceId: null,
          status: 'INDEXED',
        };
      } else {
        if (!spaceIds.includes(filterSpaceId)) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'You do not have access to this space' },
          });
          return;
        }
        docWhereClause = {
          spaceId: filterSpaceId,
          status: 'INDEXED',
        };
      }
    }

    const docs = await prisma.document.findMany({
      where: docWhereClause,
      select: { id: true, userId: true },
    });

    const accessibleDocIds = docs.map(d => d.id);

    // Group document IDs by owner userId
    const userDocumentMap: Record<string, string[]> = {};
    for (const doc of docs) {
      if (!userDocumentMap[doc.userId]) {
        userDocumentMap[doc.userId] = [];
      }
      userDocumentMap[doc.userId]!.push(doc.id);
    }

    // Run PostgreSQL full-text search to get BM25 candidates
    let bm25Results: Array<{ chunkId: string; content: string; score: number; documentId: string }> = [];
    if (accessibleDocIds.length > 0) {
      try {
        const dbCandidates = await prisma.$queryRaw<Array<{
          id: string;
          documentId: string;
          content: string;
          rank: number;
        }>>`
          SELECT id, "documentId", content, ts_rank_cd(to_tsvector('english', content), websearch_to_tsquery('english', ${query})) as rank
          FROM chunks
          WHERE "documentId" = ANY(${accessibleDocIds})
          AND to_tsvector('english', content) @@ websearch_to_tsquery('english', ${query})
          ORDER BY rank DESC
          LIMIT 50
        `;

        bm25Results = (dbCandidates || []).map(c => ({
          chunkId: c.id,
          content: c.content,
          score: Number(c.rank || 0.0),
          documentId: c.documentId,
        }));
      } catch (err) {
        logger.warn('Postgres full-text search failed (falling back to vector search only):', err);
      }
    }

    // Forward to ML service with BM25 candidates and userDocumentMap
    const mlResponse = await axios.post(`${ML_SERVICE_URL}/ml/search`, {
      query,
      userId: req.user.id,
      topK: topK ?? 10,
      filters,
      bm25Results,
      userDocumentMap,
    });

    const searchData = mlResponse.data as {
      results: Array<{
        documentId: string;
        documentTitle: string;
        chunkContent: string;
        score: number;
        pageNumber: number | null;
        headingContext: string | null;
        fileType: string;
        tags: Array<{ label: string; category: string; confidence: number }>;
      }>;
      totalCount: number;
      queryTimeMs: number;
    };

    // Enrich results with document metadata from PostgreSQL
    const docIds = [...new Set(searchData.results.map(r => r.documentId))];
    const documents = await prisma.document.findMany({
      where: { id: { in: docIds } },
      select: {
        id: true,
        title: true,
        fileName: true,
        fileType: true,
        driveFileUrl: true,
        documentTags: {
          select: {
            confidence: true,
            tag: {
              select: { name: true, category: true, color: true },
            },
          },
        },
      },
    });

    const docMap = new Map(documents.map(d => [d.id, d]));

    const enrichedResults = searchData.results.map(result => {
      const doc = docMap.get(result.documentId);
      return {
        ...result,
        documentTitle: doc?.title ?? result.documentTitle,
        fileName: doc?.fileName ?? '',
        fileType: doc?.fileType ?? result.fileType,
        driveFileUrl: doc?.driveFileUrl ?? null,
        tags: doc?.documentTags.map(dt => ({
          label: dt.tag.name,
          category: dt.tag.category ?? '',
          color: dt.tag.color ?? '#888',
          confidence: dt.confidence,
        })) ?? [],
      };
    });

    // Log search to history
    await prisma.searchHistory.create({
      data: {
        userId: req.user.id,
        query,
        resultsCount: searchData.totalCount,
      },
    });

    res.json({
      success: true,
      data: {
        results: enrichedResults,
        totalCount: searchData.totalCount,
        queryTimeMs: searchData.queryTimeMs,
      },
    });
  } catch (error) {
    logger.error('Search failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SEARCH_FAILED',
        message: error instanceof Error ? error.message : 'Search failed',
      },
    });
  }
});

/**
 * POST /api/qa
 * Proxies Q&A request to ML service as SSE streaming.
 */
searchRouter.post('/qa', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    const { question, topK } = req.body as { question: string; topK?: number };

    if (!question?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUESTION', message: 'Question is required' },
      });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // 1. Resolve accessible document IDs and group them by owner userId
    const userSpacesForQA = await prisma.spaceMember.findMany({
      where: { userId: req.user.id },
      select: { spaceId: true },
    });
    const spaceIdsForQA = userSpacesForQA.map(s => s.spaceId).filter(Boolean);

    const docsForQA = await prisma.document.findMany({
      where: {
        OR: [
          { userId: req.user.id },
          { spaceId: { in: spaceIdsForQA } },
        ],
        status: 'INDEXED',
      },
      select: { id: true, userId: true },
    });

    const userDocumentMapForQA: Record<string, string[]> = {};
    for (const doc of docsForQA) {
      if (!userDocumentMapForQA[doc.userId]) {
        userDocumentMapForQA[doc.userId] = [];
      }
      userDocumentMapForQA[doc.userId]!.push(doc.id);
    }

    // Forward to ML service and stream response
    const mlResponse = await axios.post(
      `${ML_SERVICE_URL}/ml/qa`,
      {
        question,
        userId: req.user.id,
        topK: topK ?? 5,
        userDocumentMap: userDocumentMapForQA,
      },
      { responseType: 'stream' },
    );

    // Pipe the SSE stream from ML service to the client
    mlResponse.data.on('data', (chunk: Buffer) => {
      res.write(chunk);
    });

    mlResponse.data.on('end', () => {
      // Log the Q&A query
      prisma.searchHistory.create({
        data: {
          userId: req.user?.id ?? '',
          query: `[QA] ${question}`,
          resultsCount: 0,
        },
      }).catch((err: unknown) => {
        logger.error('Failed to log QA query:', err);
      });

      res.end();
    });

    mlResponse.data.on('error', (err: Error) => {
      logger.error('QA stream error:', err);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      mlResponse.data.destroy();
    });
  } catch (error) {
    logger.error('QA failed:', error);

    // If headers already sent, just end the stream
    if (res.headersSent) {
      res.end();
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'QA_FAILED',
          message: error instanceof Error ? error.message : 'QA failed',
        },
      });
    }
  }
});
