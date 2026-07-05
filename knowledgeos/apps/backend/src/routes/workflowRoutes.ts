// apps/backend/src/routes/workflowRoutes.ts
import { Router, type Request, type Response } from 'express';
import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { prisma } from '../utils/prisma.js';
import { getLLMProvider } from '../services/llm/llmProvider.js';
import { logger } from '../utils/logger.js';

export const workflowRouter = Router();

workflowRouter.use(jwtMiddleware);

/**
 * POST /api/workflows/study-guide
 * Generate a complete study guide bundle (Summary, Quiz, Roadmap, Interview Prep, Flashcards) for a topic.
 */
workflowRouter.post('/study-guide', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { topic } = req.body as { topic: string };
    if (!topic?.trim()) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Topic is required' } });
      return;
    }

    const provider = getLLMProvider();

    logger.info(`Running Agentic Workflow: Study Guide for topic "${topic}"...`);

    const prompt = `You are a Senior Curriculum Director. Generate a complete study guide bundle for the topic: "${topic}".
Output ONLY a valid JSON object matching the following structure:
{
  "summary": "Detailed comprehensive summary paragraph explaining the topic...",
  "quiz": [
    { "question": "Question text?", "options": ["A", "B", "C", "D"], "correctAnswer": "A", "explanation": "Why correct" }
  ],
  "roadmap": ["Step 1: Basics", "Step 2: Advanced Concepts"],
  "interviewPrep": [
    { "question": "Common interview question?", "answer": "Detailed correct answer." }
  ],
  "flashcards": [
    { "cardType": "DEFINITION", "question": "What is X?", "answer": "X is..." }
  ]
}

JSON Output:`;

    const rawGuide = await provider.generate(prompt, 'You are an educational curriculum parser that outputs ONLY raw valid JSON.');
    let guide = {};
    try {
      const cleaned = rawGuide.replace(/```json/g, '').replace(/```/g, '').trim();
      guide = JSON.parse(cleaned);
    } catch (e) {
      logger.error('Failed to parse study guide JSON: ' + rawGuide);
      res.status(500).json({ success: false, error: { code: 'GUIDE_FAILED', message: 'Failed to generate study guide' } });
      return;
    }

    res.json({ success: true, data: guide });
  } catch (error: any) {
    logger.error('Failed to run study guide workflow:', error);
    res.status(500).json({ success: false, error: { code: 'WORKFLOW_FAILED', message: error.message } });
  }
});

/**
 * GET /api/digest
 * Generate the Daily Knowledge Digest.
 */
workflowRouter.get('/digest', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const userId = req.user.id;
    const now = new Date();

    // 1. Due Revision Cards
    const dueCount = await prisma.revisionItem.count({
      where: { userId, nextReviewAt: { lte: now } }
    });

    // 2. Recommended Reading (unvisited documents)
    const unvisited = await prisma.document.findMany({
      where: { userId, accessCount: 0, status: 'INDEXED' },
      select: { id: true, title: true, fileType: true },
      take: 3
    });

    // 3. Forgotten Topics (simulate from low easeFactor revisions)
    const forgottenRevs = await prisma.revisionItem.findMany({
      where: { userId, easeFactor: { lt: 2.0 } },
      select: { topicName: true },
      distinct: ['topicName'],
      take: 3
    });

    // 4. Interesting Connections (DocumentRelations with high strength)
    const relations = await prisma.documentRelation.findMany({
      where: { sourceDocument: { userId }, strength: { gte: 0.7 } },
      select: {
        sourceDocument: { select: { title: true } },
        targetDocument: { select: { title: true } },
        relationType: true
      },
      take: 2
    });

    const connections = relations.map(r => ({
      description: `"${r.sourceDocument.title}" and "${r.targetDocument.title}" have a strong correlation (${r.relationType}).`
    }));

    res.json({
      success: true,
      data: {
        dueCards: dueCount,
        recommendedReading: unvisited,
        forgottenTopics: forgottenRevs.map(r => r.topicName),
        connections
      }
    });
  } catch (error: any) {
    logger.error('Failed to get daily digest:', error);
    res.status(500).json({ success: false, error: { code: 'DIGEST_FAILED', message: error.message } });
  }
});

/**
 * GET /api/timeline
 * Generate yearly studies timeline.
 */
workflowRouter.get('/timeline', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const userId = req.user.id;

    // Fetch documents grouped by creation date
    const documents = await prisma.document.findMany({
      where: { userId },
      select: { title: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    // Group by year and month
    const timelineMap: Record<number, Record<string, string[]>> = {};

    for (const doc of documents) {
      const date = new Date(doc.createdAt);
      const year = date.getFullYear();
      const month = date.toLocaleString('default', { month: 'long' });

      if (!timelineMap[year]) timelineMap[year] = {};
      if (!timelineMap[year]![month]) timelineMap[year]![month] = [];

      timelineMap[year]![month]!.push(doc.title);
    }

    // Format output
    const years = Object.keys(timelineMap).map(Number).sort((a, b) => b - a).map(year => {
      const months = Object.keys(timelineMap[year]!).map(month => ({
        month,
        events: timelineMap[year]![month]!
      }));
      return { year, months };
    });

    res.json({ success: true, data: years });
  } catch (error: any) {
    logger.error('Failed to get timeline:', error);
    res.status(500).json({ success: false, error: { code: 'TIMELINE_FAILED', message: error.message } });
  }
});

/**
 * GET /api/bookmarks
 * List semantic bookmarks.
 */
workflowRouter.get('/bookmarks', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const bookmarks = await prisma.semanticBookmark.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: bookmarks });
  } catch (error: any) {
    logger.error('Failed to list bookmarks:', error);
    res.status(500).json({ success: false, error: { code: 'BOOKMARKS_FAILED', message: error.message } });
  }
});

/**
 * POST /api/bookmarks
 * Create a new semantic bookmark.
 */
workflowRouter.post('/bookmarks', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { concept, notes, relatedDocumentIds, relatedEntities } = req.body as {
      concept: string;
      notes?: string;
      relatedDocumentIds?: string[];
      relatedEntities?: string[];
    };

    if (!concept?.trim()) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Concept is required' } });
      return;
    }

    const bookmark = await prisma.semanticBookmark.upsert({
      where: {
        userId_concept: {
          userId: req.user.id,
          concept
        }
      },
      update: {
        notes,
        relatedDocumentIds: relatedDocumentIds || [],
        relatedEntities: relatedEntities || []
      },
      create: {
        userId: req.user.id,
        concept,
        notes,
        relatedDocumentIds: relatedDocumentIds || [],
        relatedEntities: relatedEntities || []
      }
    });

    res.json({ success: true, data: bookmark });
  } catch (error: any) {
    logger.error('Failed to save bookmark:', error);
    res.status(500).json({ success: false, error: { code: 'BOOKMARK_FAILED', message: error.message } });
  }
});

/**
 * DELETE /api/bookmarks/:id
 * Delete a bookmark.
 */
workflowRouter.delete('/bookmarks/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const bookmarkId = req.params['id'] as string;
    const bookmark = await prisma.semanticBookmark.findFirst({
      where: { id: bookmarkId, userId: req.user.id }
    });

    if (!bookmark) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bookmark not found' } });
      return;
    }

    await prisma.semanticBookmark.delete({
      where: { id: bookmark.id }
    });

    res.json({ success: true, message: 'Bookmark deleted successfully' });
  } catch (error: any) {
    logger.error('Failed to delete bookmark:', error);
    res.status(500).json({ success: false, error: { code: 'BOOKMARK_DELETE_FAILED', message: error.message } });
  }
});
