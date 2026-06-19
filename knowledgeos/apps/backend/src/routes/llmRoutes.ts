// apps/backend/src/routes/llmRoutes.ts
import { Router, type Request, type Response } from 'express';
import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { getLLMProvider } from '../services/llm/llmProvider.js';
import { logger } from '../utils/logger.js';

export const llmRouter = Router();

// Secure all LLM endpoints
llmRouter.use(jwtMiddleware);

/**
 * POST /api/llm/chat
 * Generates a non-streaming LLM response.
 */
llmRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { prompt, systemPrompt } = req.body as { prompt: string; systemPrompt?: string };
    if (!prompt) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Prompt is required' } });
      return;
    }

    const provider = getLLMProvider();
    const result = await provider.generate(prompt, systemPrompt);

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('LLM Chat endpoint failed: ', error);
    res.status(500).json({ success: false, error: { code: 'LLM_ERROR', message: error.message } });
  }
});

/**
 * POST /api/llm/stream
 * Streams the LLM response as Server-Sent Events (SSE).
 */
llmRouter.post('/stream', async (req: Request, res: Response) => {
  try {
    const { prompt, systemPrompt } = req.body as { prompt: string; systemPrompt?: string };
    if (!prompt) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Prompt is required' } });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const provider = getLLMProvider();
    await provider.stream(
      prompt,
      (chunk) => {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      },
      systemPrompt
    );

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    logger.error('LLM Stream endpoint failed: ', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { code: 'LLM_ERROR', message: error.message } });
    } else {
      res.end();
    }
  }
});

/**
 * POST /api/llm/summarize
 * Summarizes the provided text.
 */
llmRouter.post('/summarize', async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text: string };
    if (!text) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Text is required' } });
      return;
    }

    const provider = getLLMProvider();
    const result = await provider.summarize(text);

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('LLM Summarize endpoint failed: ', error);
    res.status(500).json({ success: false, error: { code: 'LLM_ERROR', message: error.message } });
  }
});

/**
 * POST /api/llm/flashcards
 * Generates flashcards for the provided text.
 */
llmRouter.post('/flashcards', async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text: string };
    if (!text) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Text is required' } });
      return;
    }

    const provider = getLLMProvider();
    const result = await provider.createFlashcards(text);

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('LLM Flashcards endpoint failed: ', error);
    res.status(500).json({ success: false, error: { code: 'LLM_ERROR', message: error.message } });
  }
});

/**
 * POST /api/llm/roadmap
 * Generates a learning roadmap curriculum for a topic.
 */
llmRouter.post('/roadmap', async (req: Request, res: Response) => {
  try {
    const { topic } = req.body as { topic: string };
    if (!topic) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Topic is required' } });
      return;
    }

    const provider = getLLMProvider();
    const result = await provider.createRoadmap(topic);

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('LLM Roadmap endpoint failed: ', error);
    res.status(500).json({ success: false, error: { code: 'LLM_ERROR', message: error.message } });
  }
});
