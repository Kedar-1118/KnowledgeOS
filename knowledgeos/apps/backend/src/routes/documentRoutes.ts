// apps/backend/src/routes/documentRoutes.ts
/**
 * Document CRUD routes.
 * GET    /api/documents     → List user's documents with pagination, filters
 * GET    /api/documents/:id → Get document detail with tags and relations
 * DELETE /api/documents/:id → Delete document and all related data
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

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

    const { page, limit, status, fileType, search, sortBy, sortDir } = parsed.data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { userId: req.user.id };
    if (status) where['status'] = status;
    if (fileType) where['fileType'] = fileType;
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

    const document = await prisma.document.findFirst({
      where: { id: docId, userId: req.user.id },
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
