// apps/backend/src/routes/docConversationRoutes.ts
import { Router, type Request, type Response } from 'express';
import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { prisma } from '../utils/prisma.js';
import { getLLMProvider } from '../services/llm/llmProvider.js';
import { logger } from '../utils/logger.js';

export const docConversationRouter = Router();

docConversationRouter.use(jwtMiddleware);

/**
 * GET /api/documents/:id/conversation
 * Retrieve chat history, insights, and follow-ups for a document.
 */
docConversationRouter.get('/:id/conversation', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const documentId = req.params['id'] as string;
    const userId = (req.user as any).id as string;

    // Verify document ownership or space membership
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, summary: true, userId: true, spaceId: true }
    });

    if (!document) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      return;
    }

    let hasAccess = document.userId === userId;
    if (!hasAccess && document.spaceId) {
      const membership = await prisma.spaceMember.findFirst({
        where: { spaceId: document.spaceId, userId }
      });
      hasAccess = !!membership;
    }

    if (!hasAccess) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this document' } });
      return;
    }

    let conversation = await prisma.documentConversation.findUnique({
      where: { documentId_userId: { documentId, userId } }
    });

    if (!conversation) {
      conversation = await prisma.documentConversation.create({
        data: {
          documentId,
          userId,
          history: [] as any,
          insights: [] as any,
          followUps: [`Can you explain the main idea of "${document.title}"?`, `What are the key terms?`] as any
        }
      });
    }

    res.json({ success: true, data: conversation });
  } catch (error: any) {
    logger.error('Failed to get document conversation:', error);
    res.status(500).json({ success: false, error: { code: 'CONVERSATION_FAILED', message: error.message } });
  }
});

/**
 * POST /api/documents/:id/chat
 * Chat with a document. Appends messages to history and updates insights/follow-ups.
 */
docConversationRouter.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const documentId = req.params['id'] as string;
    const userId = (req.user as any).id as string;
    const { message } = req.body as { message: string };

    if (!message?.trim()) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Message is required' } });
      return;
    }

    // Verify document ownership or space membership
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, summary: true, userId: true, spaceId: true }
    });

    if (!document) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      return;
    }

    let hasAccess = document.userId === userId;
    if (!hasAccess && document.spaceId) {
      const membership = await prisma.spaceMember.findFirst({
        where: { spaceId: document.spaceId, userId }
      });
      hasAccess = !!membership;
    }

    if (!hasAccess) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this document' } });
      return;
    }

    // Get chunks for contextual knowledge
    const chunks = await prisma.chunk.findMany({
      where: { documentId },
      select: { content: true },
      take: 5
    });
    const docContext = chunks.map(c => c.content).join('\n\n');

    // Get or create conversation record
    let conversation = await prisma.documentConversation.findUnique({
      where: { documentId_userId: { documentId, userId } }
    });

    if (!conversation) {
      conversation = await prisma.documentConversation.create({
        data: { documentId, userId, history: [] as any, insights: [] as any, followUps: [] as any }
      });
    }

    const currentHistory = Array.isArray(conversation.history)
      ? (conversation.history as Array<{ role: string; content: string }>)
      : [];

    // Append user message
    const updatedHistory = [...currentHistory, { role: 'user', content: message }];

    // Format chat history context for LLM
    const chatHistoryContext = updatedHistory.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');

    // Construct RAG prompt
    const systemPrompt = `You are a knowledgeable AI tutor helping the user study the document: "${document.title}".
Use the following document text as context to answer the user's questions:
---
${docContext}
---
Be concise, pedagogical, and align with Obsidian/Notion styles. Cite the document if needed.`;

    const provider = getLLMProvider();
    const assistantReply = await provider.generate(chatHistoryContext, systemPrompt);

    // Append assistant reply
    const finalHistory = [...updatedHistory, { role: 'assistant', content: assistantReply }];

    // Trigger asynchronous extraction of insights and follow-ups
    let insights = conversation.insights;
    let followUps = conversation.followUps;

    try {
      const extractPrompt = `Based on the following chat history between a user studying the document "${document.title}" and an AI assistant, identify:
1. Up to 5 core insights or facts the user learned.
2. 3 logical follow-up questions the user might ask next.
Format your response as a valid JSON object matching the following structure:
{
  "insights": ["Insight 1", "Insight 2"],
  "followUps": ["Follow-up 1", "Follow-up 2", "Follow-up 3"]
}

Chat History:
${finalHistory.map(h => `${h.role}: ${h.content}`).join('\n')}

JSON Output:`;

      const rawExtract = await provider.generate(extractPrompt, 'You output ONLY valid raw JSON objects.');
      const cleaned = rawExtract.replace(/```json/g, '').replace(/```/g, '').trim();
      const extracted = JSON.parse(cleaned);
      if (Array.isArray(extracted.insights)) insights = extracted.insights;
      if (Array.isArray(extracted.followUps)) followUps = extracted.followUps;
    } catch (e) {
      logger.warn('Failed to extract insights from document chat:', e);
    }

    // Save back to DB
    const updatedConversation = await prisma.documentConversation.update({
      where: { id: conversation.id },
      data: {
        history: finalHistory as any,
        insights: insights as any,
        followUps: followUps as any
      }
    });

    res.json({ success: true, data: updatedConversation });
  } catch (error: any) {
    logger.error('Failed to chat with document:', error);
    res.status(500).json({ success: false, error: { code: 'CHAT_FAILED', message: error.message } });
  }
});
