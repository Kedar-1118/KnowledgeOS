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

import { computeGraphClusters } from '../utils/louvain.js';

export const graphRouter = Router();

graphRouter.use(jwtMiddleware);

/**
 * POST /api/graph/cluster
 * Run Louvain community detection on the document relation network.
 */
graphRouter.post('/cluster', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    await computeGraphClusters(req.user.id);
    res.json({ success: true, message: 'Graph clustering computed successfully' });
  } catch (error: any) {
    logger.error('Failed to trigger graph clustering:', error);
    res.status(500).json({ success: false, error: { code: 'CLUSTER_FAILED', message: error.message } });
  }
});

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

    const [nodes, documents, clusters] = await Promise.all([
      prisma.knowledgeNode.findMany({
        where: { userId: req.user.id },
        select: {
          id: true,
          label: true,
          type: true,
          description: true,
        },
      }),
      prisma.document.findMany({
        where: { userId: req.user.id, status: 'INDEXED' },
        select: {
          id: true,
          title: true,
          summary: true,
        },
      }),
      prisma.cluster.findMany({
        where: { userId: req.user.id },
      }),
    ]);

    // Build document ID to cluster map
    const docClusterMap = new Map<string, { label: string; color: string }>();
    for (const cl of clusters) {
      let docIds: string[] = [];
      try {
        docIds = Array.isArray(cl.documentIds)
          ? (cl.documentIds as string[])
          : JSON.parse(cl.documentIds as string);
      } catch (e) {
        docIds = [];
      }
      for (const id of docIds) {
        docClusterMap.set(id, { label: cl.label, color: cl.color || '#9b6fe0' });
      }
    }

    // Build node objects for the graph visualization
    const conceptNodes = nodes.map(node => ({
      id: node.id,
      label: node.label,
      type: node.type,
      description: node.description,
      size: 1,
      clusterLabel: 'Entity',
      color: '#c3c0ff', // default primary tint
    }));

    const documentNodes = documents.map(doc => {
      const cluster = docClusterMap.get(doc.id);
      return {
        id: doc.id,
        label: doc.title,
        type: 'OTHER',
        description: doc.summary ?? 'No summary available.',
        size: 2,
        clusterLabel: cluster?.label ?? 'General',
        color: cluster?.color ?? '#999',
      };
    });

    const graphNodes = [...conceptNodes, ...documentNodes];

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

    // Get concept-to-document edges dynamically
    const [knowledgeNodes, chunks] = await Promise.all([
      prisma.knowledgeNode.findMany({
        where: { userId: req.user.id },
        select: { id: true, label: true },
      }),
      prisma.chunk.findMany({
        where: { document: { userId: req.user.id, status: 'INDEXED' } },
        select: { documentId: true, content: true },
      }),
    ]);

    // Group chunk text by document
    const docTexts = new Map<string, string>();
    for (const chunk of chunks) {
      const existing = docTexts.get(chunk.documentId) ?? '';
      docTexts.set(chunk.documentId, existing + ' ' + chunk.content);
    }

    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const conceptEdges: Array<{
      source: string;
      target: string;
      type: string;
      strength: number;
      label: string;
    }> = [];

    for (const node of knowledgeNodes) {
      const escaped = escapeRegExp(node.label);
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      for (const [docId, text] of docTexts.entries()) {
        if (regex.test(text)) {
          conceptEdges.push({
            source: node.id,
            target: docId,
            type: 'CONCEPT_LINK',
            strength: 0.8,
            label: 'MENTIONS',
          });
        }
      }
    }

    // Combine direct relations, shared-tag edges, and concept edges
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
      ...conceptEdges,
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
