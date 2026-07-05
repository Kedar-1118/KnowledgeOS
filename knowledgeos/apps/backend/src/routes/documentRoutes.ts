// apps/backend/src/routes/documentRoutes.ts
/**
 * Document CRUD routes.
 * GET    /api/documents     → List user's documents with pagination, filters
 * GET    /api/documents/:id → Get document detail with tags and relations
 * DELETE /api/documents/:id → Delete document and all related data
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import axios from 'axios';

import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import { getLLMProvider } from '../services/llm/llmProvider.js';

const ML_SERVICE_URL = process.env['ML_SERVICE_URL'] ?? 'http://localhost:8000';

export const documentRouter = Router();

// All document routes require authentication
documentRouter.use(jwtMiddleware);

/**
 * GET /api/documents
 * List all documents for the authenticated user.
 * Supports pagination, search, status filter, and sort.
 */
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'PROCESSING', 'INDEXED', 'FAILED']).optional(),
  fileType: z.enum(['PDF', 'TXT', 'MD', 'IMAGE', 'VIDEO', 'OTHER']).optional(),
  search: z.string().optional(),
  spaceId: z.string().optional(),
  sortBy: z.enum(['createdAt', 'title', 'lastAccessedAt', 'readingTimeMinutes']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

documentRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: parsed.error.message },
      });
      return;
    }

    const { page, limit, status, fileType, search, spaceId, sortBy, sortDir } = parsed.data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, any> = {};
    if (status) where['status'] = status;
    if (fileType) where['fileType'] = fileType;

    if (spaceId) {
      if (spaceId === 'personal') {
        where['userId'] = req.user.id;
        where['spaceId'] = null;
      } else {
        // Shared Space: verify membership
        const membership = await prisma.spaceMember.findFirst({
          where: { spaceId, userId: req.user.id },
        });
        if (!membership) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'You do not have access to this space' },
          });
          return;
        }
        where['spaceId'] = spaceId;
      }
    } else {
      // Default: list all documents user owns
      where['userId'] = req.user.id;
    }

    if (search) {
      where['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          title: true,
          fileName: true,
          fileType: true,
          mimeType: true,
          fileSizeBytes: true,
          status: true,
          summary: true,
          readingTimeMinutes: true,
          lastAccessedAt: true,
          accessCount: true,
          driveFileUrl: true,
          createdAt: true,
          updatedAt: true,
          documentTags: {
            select: {
              confidence: true,
              tag: { select: { id: true, name: true, category: true, color: true } },
            },
          },
        },
        orderBy: { [sortBy]: sortDir },
        skip,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    // Format response
    const formattedDocs = documents.map(doc => ({
      ...doc,
      tags: doc.documentTags.map(dt => ({
        id: dt.tag.id,
        name: dt.tag.name,
        category: dt.tag.category,
        color: dt.tag.color,
        confidence: dt.confidence,
      })),
      documentTags: undefined,
    }));

    res.json({
      success: true,
      data: {
        documents: formattedDocs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('List documents failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LIST_FAILED', message: 'Failed to list documents' },
    });
  }
});

/**
 * GET /api/documents/:id
 * Get full document details including tags, chunks count, and relations.
 */
documentRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const docId = req.params['id'] as string;

    const document = await prisma.document.findUnique({
      where: { id: docId },
      include: {
        documentTags: {
          include: { tag: true },
        },
        _count: {
          select: { chunks: true },
        },
        relationsAsSource: {
          select: {
            targetDocId: true,
            relationType: true,
            strength: true,
            targetDocument: {
              select: { id: true, title: true, fileType: true },
            },
          },
          take: 10,
        },
        processingJobs: {
          select: {
            jobType: true,
            status: true,
            completedAt: true,
            lastError: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    // Verify access: owner or space member
    let hasAccess = document.userId === req.user.id;
    if (!hasAccess && document.spaceId) {
      const membership = await prisma.spaceMember.findFirst({
        where: { spaceId: document.spaceId, userId: req.user.id },
      });
      hasAccess = !!membership;
    }

    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have access to this document' },
      });
      return;
    }

    // Update access count and last accessed
    await prisma.document.update({
      where: { id: document.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        ...document,
        chunksCount: document._count.chunks,
        tags: document.documentTags.map(dt => ({
          id: dt.tag.id,
          name: dt.tag.name,
          category: dt.tag.category,
          color: dt.tag.color,
          confidence: dt.confidence,
        })),
        relatedDocuments: document.relationsAsSource.map(r => ({
          document: r.targetDocument,
          relationType: r.relationType,
          strength: r.strength,
        })),
        documentTags: undefined,
        _count: undefined,
        relationsAsSource: undefined,
      },
    });
  } catch (error) {
    logger.error('Get document failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_FAILED', message: 'Failed to get document' },
    });
  }
});

/**
 * POST /api/documents/compare
 * Compare multiple documents side-by-side.
 */
documentRouter.post('/compare', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { documentIds } = req.body as { documentIds: string[] };

    if (!Array.isArray(documentIds) || documentIds.length < 2) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'At least two documentIds are required for comparison' },
      });
      return;
    }

    // Fetch documents
    const docs = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        userId: req.user.id,
      },
      select: {
        id: true,
        title: true,
        summary: true,
        fileType: true,
      },
    });

    if (docs.length < 2) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Could not find two or more matching documents' },
      });
      return;
    }

    // Build context for LLM
    const docContexts = docs.map((doc, idx) => {
      return `Document ${idx + 1} (ID: ${doc.id}):\nTitle: ${doc.title}\nFormat: ${doc.fileType}\nSummary: ${doc.summary || 'No summary available.'}`;
    }).join('\n\n');

    const prompt = `You are a Senior Systems Architect and Technical Analyst. Compare the following documents.
Format the response as a single, valid JSON object matching the following structure:
{
  "comparisonMatrix": [
    { "category": "Topic", "docValues": ["Doc 1 Topic", "Doc 2 Topic"] },
    { "category": "Core Concepts", "docValues": ["Doc 1 Concepts", "Doc 2 Concepts"] },
    { "category": "Key Summary", "docValues": ["Doc 1 Summary", "Doc 2 Summary"] }
  ],
  "similarities": ["Sim 1", "Sim 2"],
  "differences": ["Diff 1", "Diff 2"],
  "contradictions": ["Contradiction 1 or State None"]
}

Make sure the "docValues" array matches the order of the documents provided.
Provide detailed descriptions for the docValues.

Documents to Compare:
${docContexts}

JSON Output:`;

    const provider = getLLMProvider();
    const rawResult = await provider.generate(prompt, 'You are a technical analyst that outputs ONLY raw JSON arrays/objects. Do not include markdown code block formatting.');

    let comparisons = {
      comparisonMatrix: [],
      similarities: [],
      differences: [],
      contradictions: [],
    };

    try {
      const cleaned = rawResult.replace(/```json/g, '').replace(/```/g, '').trim();
      comparisons = JSON.parse(cleaned);
    } catch (e) {
      logger.error('Failed to parse document comparisons JSON from LLM: ' + rawResult);
    }

    res.json({
      success: true,
      data: {
        documents: docs.map(d => ({ id: d.id, title: d.title })),
        comparisons,
      },
    });
  } catch (error: any) {
    logger.error('Compare documents failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'COMPARE_FAILED', message: error.message },
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document and all related data (chunks, tags, jobs, etc.).
 * Cascade deletes are handled by Prisma schema.
 */
documentRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const docId = req.params['id'] as string;

    const document = await prisma.document.findFirst({
      where: { id: docId, userId: req.user.id },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
      return;
    }

    // Delete from database (cascade handles chunks, tags, jobs)
    await prisma.document.delete({ where: { id: document.id } });

    // Delete from Qdrant via ML service
    try {
      await axios.post(`${ML_SERVICE_URL}/ml/delete-document`, {
        documentId: document.id,
        userId: req.user.id,
      });
      logger.info(`Deleted Qdrant vectors for document ${document.id}`);
    } catch (err: any) {
      logger.warn(`Failed to clean up Qdrant vectors for document ${document.id}: ${err.message}`);
    }

    logger.info(`Document deleted: ${document.title} (${document.id})`);

    res.json({
      success: true,
      data: { message: 'Document deleted successfully', documentId: document.id },
    });
  } catch (error) {
    logger.error('Delete document failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: 'Failed to delete document' },
    });
  }
});
