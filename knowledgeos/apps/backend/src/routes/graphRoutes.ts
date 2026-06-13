// apps/backend/src/routes/graphRoutes.ts
/**
 * Knowledge Graph API routes.
 * GET  /api/graph/nodes     → Get all knowledge nodes for user
 * GET  /api/graph/edges     → Get relations between nodes
 * GET  /api/graph/stats     → Get graph statistics
 */

import { Router, type Request, type Response } from 'express';

import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

export const graphRouter = Router();

graphRouter.use(jwtMiddleware);

/**
 * GET /api/graph/nodes
 * Returns all KnowledgeNodes for the authenticated user,
 * formatted for force-directed graph rendering.
 */
graphRouter.get('/nodes', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const nodes = await prisma.knowledgeNode.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        label: true,
        type: true,
        description: true,
        createdAt: true,
      },
    });

    // Build node objects for the graph visualization
    const graphNodes = nodes.map(node => ({
      id: node.id,
      label: node.label,
      type: node.type,
      description: node.description,
      size: 1, // Will be weighted by number of connections
    }));

    res.json({
      success: true,
      data: { nodes: graphNodes, totalNodes: graphNodes.length },
    });
  } catch (error) {
    logger.error('Get graph nodes failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GRAPH_NODES_FAILED', message: 'Failed to get graph nodes' },
    });
  }
});

/**
 * GET /api/graph/edges
 * Returns all DocumentRelations for the authenticated user.
 * These form the edges between documents in the graph.
 * Also includes edges derived from shared tags and KnowledgeNode co-occurrences.
 */
graphRouter.get('/edges', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    // Get document relations
    const relations = await prisma.documentRelation.findMany({
      where: {
        sourceDocument: { userId: req.user.id },
      },
      select: {
        sourceDocId: true,
        targetDocId: true,
        relationType: true,
        strength: true,
        sourceDocument: { select: { title: true } },
        targetDocument: { select: { title: true } },
      },
    });

    // Get shared-tag edges: documents sharing the same tag
    const documentTags = await prisma.documentTag.findMany({
      where: {
        document: { userId: req.user.id },
      },
      select: {
        documentId: true,
        tagId: true,
        tag: { select: { name: true } },
      },
    });

    // Group documents by tag to find shared-tag edges
    const tagToDocuments = new Map<string, { docId: string; tagName: string }[]>();
    for (const dt of documentTags) {
      const existing = tagToDocuments.get(dt.tagId) ?? [];
      existing.push({ docId: dt.documentId, tagName: dt.tag.name });
      tagToDocuments.set(dt.tagId, existing);
    }

    const sharedTagEdges: Array<{
      source: string;
      target: string;
      type: string;
      strength: number;
      label: string;
    }> = [];

    for (const [, docs] of tagToDocuments) {
      if (docs.length < 2) continue;
      // Create edges between all pairs of documents sharing this tag
      for (let i = 0; i < docs.length; i++) {
        for (let j = i + 1; j < docs.length; j++) {
          const d1 = docs[i]!;
          const d2 = docs[j]!;
          sharedTagEdges.push({
            source: d1.docId,
            target: d2.docId,
            type: 'SHARED_TAG',
            strength: 0.5,
            label: d1.tagName,
          });
        }
      }
    }

    // Combine direct relations and shared-tag edges
    const edges = [
      ...relations.map(r => ({
        source: r.sourceDocId,
        target: r.targetDocId,
        type: r.relationType,
        strength: r.strength,
        label: r.relationType,
        sourceTitle: r.sourceDocument.title,
        targetTitle: r.targetDocument.title,
      })),
      ...sharedTagEdges,
    ];

    res.json({
      success: true,
      data: { edges, totalEdges: edges.length },
    });
  } catch (error) {
    logger.error('Get graph edges failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GRAPH_EDGES_FAILED', message: 'Failed to get graph edges' },
    });
  }
});

/**
 * GET /api/graph/stats
 * Returns graph statistics for the dashboard.
 */
graphRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const [totalNodes, totalDocuments, totalTags, nodesByType] = await Promise.all([
      prisma.knowledgeNode.count({ where: { userId: req.user.id } }),
      prisma.document.count({ where: { userId: req.user.id, status: 'INDEXED' } }),
      prisma.tag.count(),
      prisma.knowledgeNode.groupBy({
        by: ['type'],
        where: { userId: req.user.id },
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalNodes,
        totalDocuments,
        totalTags,
        nodesByType: nodesByType.map(g => ({
          type: g.type,
          count: g._count,
        })),
      },
    });
  } catch (error) {
    logger.error('Get graph stats failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GRAPH_STATS_FAILED', message: 'Failed to get graph stats' },
    });
  }
});
