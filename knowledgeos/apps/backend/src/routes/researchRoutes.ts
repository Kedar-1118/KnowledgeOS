// apps/backend/src/routes/researchRoutes.ts
import { Router, type Request, type Response } from 'express';
import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { prisma } from '../utils/prisma.js';
import { getLLMProvider } from '../services/llm/llmProvider.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export const researchRouter = Router();

researchRouter.use(jwtMiddleware);

const ML_SERVICE_URL = process.env['ML_SERVICE_URL'] ?? 'http://localhost:8000';

/**
 * POST /api/research/generate
 * Perform research: search local knowledge, retrieve chunks, and generate a markdown report.
 */
researchRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { query } = req.body as { query: string };
    if (!query?.trim()) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Query is required' } });
      return;
    }

    const userId = req.user.id;

    // 1. Resolve accessible document IDs and group them by owner userId
    const userSpaces = await prisma.spaceMember.findMany({
      where: { userId },
      select: { spaceId: true },
    });
    const spaceIds = userSpaces.map(s => s.spaceId).filter(Boolean);

    const docs = await prisma.document.findMany({
      where: {
        OR: [
          { userId },
          { spaceId: { in: spaceIds } },
        ],
        status: 'INDEXED',
      },
      select: { id: true, userId: true },
    });

    const accessibleDocIds = docs.map(d => d.id);

    const userDocumentMap: Record<string, string[]> = {};
    for (const doc of docs) {
      if (!userDocumentMap[doc.userId]) {
        userDocumentMap[doc.userId] = [];
      }
      userDocumentMap[doc.userId]!.push(doc.id);
    }

    // Search locally using hybrid search logic
    // Run PostgreSQL full-text search first
    let bm25Results: any[] = [];
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
          LIMIT 30
        `;
        bm25Results = (dbCandidates || []).map(c => ({
          chunkId: c.id,
          content: c.content,
          score: Number(c.rank || 0.0),
          documentId: c.documentId
        }));
      } catch (e) {
        logger.warn('FTS failed during research lookup:', e);
      }
    }

    // Call ML service search endpoint
    let searchHits: any[] = [];
    try {
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/ml/search`, {
        query,
        userId,
        topK: 10,
        bm25Results,
        userDocumentMap
      });
      searchHits = mlResponse.data?.results || [];
    } catch (e) {
      logger.error('ML Search failed during research compilation:', e);
    }

    // Enrich search hits with document metadata to give the LLM clear sources
    const docIds = [...new Set(searchHits.map((h: any) => h.documentId))];
    const documents = await prisma.document.findMany({
      where: { id: { in: docIds } },
      select: { id: true, title: true, fileName: true }
    });
    const docMap = new Map(documents.map(d => [d.id, d]));

    // Format context text with sources
    const contextParts = searchHits.map((hit: any, index: number) => {
      const doc = docMap.get(hit.documentId);
      const title = doc?.title || 'Unknown Source';
      return `[Source ${index + 1} - "${title}"]: ${hit.chunkContent}`;
    });

    const context = contextParts.join('\n\n');

    // 2. Draft prompt for the LLM
    const prompt = `You are a Senior AI Research Agent. Your task is to compile a comprehensive, highly professional research report on the topic: "${query}".
Answer ONLY using the provided source contexts. Format the report using clear GitHub Markdown.
Always cite your sources using [Source N] inline notation where appropriate.

Your report must contain these sections:
# Executive Summary
Provide a high-level summary of the findings.

# Key Concepts
Explain the core concepts and terms identified in the documents.

# Important Sources
A list of sources utilized with brief summaries of their contributions.

# Contradictions & Discrepancies
Highlight any contradictory details, inconsistencies, or varying viewpoints found across different source documents. If none, state so clearly.

# Recommendations
Actionable takeaways based on the research.

# Missing Knowledge
Identify critical gaps or details that are NOT covered in the provided documents but are essential to fully understand this topic.

Context Sources:
${context || 'No local documents found matching this query.'}

Markdown Report Output:`;

    const provider = getLLMProvider();
    const reportMarkdown = await provider.generate(prompt, 'You are an objective research agent that writes detailed, highly formatted markdown reports.');

    res.json({
      success: true,
      data: {
        query,
        report: reportMarkdown,
        sourcesCount: searchHits.length
      }
    });
  } catch (error: any) {
    logger.error('Research generation failed:', error);
    res.status(500).json({ success: false, error: { code: 'RESEARCH_FAILED', message: error.message } });
  }
});

/**
 * POST /api/research/save
 * Save the generated report as a document in KnowledgeOS.
 */
researchRouter.post('/save', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { title, markdown } = req.body as { title: string; markdown: string };
    if (!title || !markdown) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Title and markdown content are required' } });
      return;
    }

    const userId = req.user.id;

    // Create document in database
    const document = await prisma.document.create({
      data: {
        userId,
        driveFileId: `research-${uuidv4()}`,
        title,
        fileName: `${title.replace(/\s+/g, '_')}.md`,
        fileType: 'MD',
        mimeType: 'text/markdown',
        fileSizeBytes: Buffer.byteLength(markdown),
        driveModifiedAt: new Date(),
        status: 'INDEXED',
        summary: `AI Generated Research Report on: ${title}`,
        readingTimeMinutes: Math.ceil(markdown.split(/\s+/).length / 200),
      }
    });

    // Create the chunk for full-text search availability
    await prisma.chunk.create({
      data: {
        documentId: document.id,
        chunkIndex: 0,
        content: markdown,
        tokenCount: Math.ceil(markdown.length / 4)
      }
    });

    // Optional: add to Qdrant vector index in the background
    try {
      await axios.post(`${ML_SERVICE_URL}/ml/embed`, {
        chunks: [{ id: `${document.id}-c0`, content: markdown }],
        userId,
        documentId: document.id
      });
    } catch (e) {
      logger.warn('Failed to embed research report chunk in Qdrant (still available in database search):', e);
    }

    res.json({ success: true, data: { documentId: document.id, message: 'Report saved as document successfully' } });
  } catch (error: any) {
    logger.error('Failed to save research report:', error);
    res.status(500).json({ success: false, error: { code: 'SAVE_FAILED', message: error.message } });
  }
});
