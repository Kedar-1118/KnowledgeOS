// apps/backend/src/routes/mentorRoutes.ts
import { Router, type Request, type Response } from 'express';
import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { prisma } from '../utils/prisma.js';
import { getLLMProvider } from '../services/llm/llmProvider.js';
import { logger } from '../utils/logger.js';

export const mentorRouter = Router();

mentorRouter.use(jwtMiddleware);

/**
 * POST /api/mentor/session
 * Initialize a new AI Mentor learning session with an LLM-generated syllabus.
 */
mentorRouter.post('/session', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { topic, difficulty } = req.body as {
      topic: string;
      difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    };

    if (!topic?.trim() || !difficulty) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Topic and difficulty are required' } });
      return;
    }

    const userId = req.user.id;
    const provider = getLLMProvider();

    const prompt = `Generate a progressive course syllabus for teaching: "${topic}" at a "${difficulty}" level.
Output ONLY a valid JSON array of subtopics. Structure:
Array<{
  nodeId: string; // unique short ID like "1", "2"
  title: string; // subtopic name
  description: string; // short summary of the lesson
  order: number; // sequential index
  estimatedMinutes: number; // study duration estimate
}>

Generate between 4 to 6 sequential lessons.

JSON Output:`;

    const rawSyllabus = await provider.generate(prompt, 'You are an academic course designer. Output ONLY raw valid JSON arrays.');
    let syllabus = [];
    try {
      const cleaned = rawSyllabus.replace(/```json/g, '').replace(/```/g, '').trim();
      syllabus = JSON.parse(cleaned);
    } catch (e) {
      logger.error('Failed to parse mentor syllabus JSON: ' + rawSyllabus);
      res.status(500).json({ success: false, error: { code: 'SYLLABUS_FAILED', message: 'Failed to generate curriculum' } });
      return;
    }

    const session = await prisma.mentorSession.create({
      data: {
        userId,
        topic,
        difficulty,
        status: 'ACTIVE',
        roadmap: syllabus
      }
    });

    res.json({ success: true, data: session });
  } catch (error: any) {
    logger.error('Failed to create mentor session:', error);
    res.status(500).json({ success: false, error: { code: 'MENTOR_FAILED', message: error.message } });
  }
});

/**
 * GET /api/mentor/sessions
 * List active/completed mentor sessions for user.
 */
mentorRouter.get('/sessions', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const sessions = await prisma.mentorSession.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: sessions });
  } catch (error: any) {
    logger.error('Failed to list mentor sessions:', error);
    res.status(500).json({ success: false, error: { code: 'MENTOR_FAILED', message: error.message } });
  }
});

/**
 * GET /api/mentor/session/:id
 * Retrieve details for a mentor session, including completion progress nodes.
 */
mentorRouter.get('/session/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const sessionId = req.params['id'] as string;
    const userId = (req.user as any).id as string;

    const session = await prisma.mentorSession.findFirst({
      where: { id: sessionId, userId },
      include: { progress: true }
    }) as any;

    if (!session) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
      return;
    }

    // Auto-initialize progress nodes if they aren't created yet
    const syllabus = Array.isArray(session.roadmap) ? (session.roadmap as any[]) : [];
    const existingNodes = session.progress.map((p: any) => p.nodeId);

    for (const node of syllabus) {
      if (node && node.nodeId && !existingNodes.includes(node.nodeId)) {
        await prisma.mentorProgress.create({
          data: {
            mentorSessionId: session.id,
            nodeId: node.nodeId,
            masteryScore: 0.0,
            quizzes: [] as any,
            assignments: [] as any,
            weakAreas: [] as any
          }
        });
      }
    }

    const refreshedSession = await prisma.mentorSession.findFirst({
      where: { id: session.id },
      include: { progress: true }
    });

    res.json({ success: true, data: refreshedSession });
  } catch (error: any) {
    logger.error('Failed to get session details:', error);
    res.status(500).json({ success: false, error: { code: 'MENTOR_FAILED', message: error.message } });
  }
});

/**
 * POST /api/mentor/session/:id/quiz
 * Generate an adaptive quiz for a syllabus node.
 */
mentorRouter.post('/session/:id/quiz', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const sessionId = req.params['id'] as string;
    const userId = (req.user as any).id as string;
    const { nodeId } = req.body as { nodeId: string };
    const session = await prisma.mentorSession.findFirst({
      where: { id: sessionId, userId }
    }) as any;

    if (!session || !nodeId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session or Node ID not found' } });
      return;
    }

    // Get the subtopic title from syllabus
    const syllabus = Array.isArray(session.roadmap) ? (session.roadmap as any[]) : [];
    const node = syllabus.find((n: any) => n.nodeId === nodeId);
    const nodeTitle = node?.title || 'General Concepts';

    const provider = getLLMProvider();
    const prompt = `Generate a 3-question multiple choice quiz testing mastery of the subtopic: "${nodeTitle}" (part of "${session.topic}") at a "${session.difficulty}" level.
Output ONLY a valid JSON array matching this structure:
Array<{
  id: string; // e.g. "q1", "q2"
  question: string;
  options: string[]; // 4 options
  correctAnswer: string; // The exact text of the correct option
  explanation: string; // Explanation of why this option is correct
}>

JSON Output:`;

    const rawQuiz = await provider.generate(prompt, 'You are an educational quiz designer. Output ONLY valid JSON arrays.');
    let questions = [];
    try {
      const cleaned = rawQuiz.replace(/```json/g, '').replace(/```/g, '').trim();
      questions = JSON.parse(cleaned);
    } catch (e) {
      logger.error('Failed to parse generated quiz JSON: ' + rawQuiz);
      res.status(500).json({ success: false, error: { code: 'QUIZ_GEN_FAILED', message: 'Failed to generate quiz questions' } });
      return;
    }

    res.json({ success: true, data: { nodeId, questions } });
  } catch (error: any) {
    logger.error('Failed to create quiz:', error);
    res.status(500).json({ success: false, error: { code: 'QUIZ_FAILED', message: error.message } });
  }
});

/**
 * POST /api/mentor/session/:id/quiz/submit
 * Submit quiz answers and calculate mastery updates.
 */
mentorRouter.post('/session/:id/quiz/submit', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const sessionId = req.params['id'] as string;
    const userId = (req.user as any).id as string;
    const { nodeId, answers, questions } = req.body as {
      nodeId: string;
      answers: Record<string, string>; // e.g. { q1: "correct option" }
      questions: any[];
    };

    const session = await prisma.mentorSession.findFirst({
      where: { id: sessionId, userId }
    }) as any;

    if (!session || !nodeId || !answers || !questions) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Incomplete parameters' } });
      return;
    }

    let correctCount = 0;
    const reviewDetails = questions.map(q => {
      const userAnswer = answers[q.id];
      const isCorrect = userAnswer === q.correctAnswer;
      if (isCorrect) correctCount++;
      return {
        questionId: q.id,
        questionText: q.question,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation
      };
    });

    const gradeRatio = correctCount / questions.length;
    const masteryScore = Math.round(gradeRatio * 100) / 100;

    const progressRecord = await prisma.mentorProgress.findUnique({
      where: { mentorSessionId_nodeId: { mentorSessionId: session.id, nodeId } }
    });

    if (!progressRecord) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Progress record not found' } });
      return;
    }

    const existingQuizzes = Array.isArray(progressRecord.quizzes) ? (progressRecord.quizzes as any[]) : [];
    const quizHistory = [...existingQuizzes, { timestamp: new Date(), score: gradeRatio, details: reviewDetails }];

    // Identify weak areas if score is low
    const weakAreas = [...(progressRecord.weakAreas as string[])];
    if (gradeRatio < 0.7) {
      // Find subtopic from syllabus
      const syllabus = Array.isArray(session.roadmap) ? (session.roadmap as any[]) : [];
      const node = syllabus.find((n: any) => n.nodeId === nodeId);
      if (node && !weakAreas.includes(node.title)) {
        weakAreas.push(node.title);
        // Also register a global KnowledgeGap
        await prisma.knowledgeGap.create({
          data: {
            userId: (req.user as any).id as string,
            topic: `${session.topic} - ${node.title}`,
            confidence: 0.8
          }
        }).catch(() => {});
      }
    }

    const updatedProgress = await prisma.mentorProgress.update({
      where: { id: progressRecord.id },
      data: {
        masteryScore,
        quizzes: quizHistory as any,
        weakAreas: weakAreas as any
      }
    });

    res.json({
      success: true,
      data: {
        score: gradeRatio,
        correctCount,
        totalCount: questions.length,
        masteryScore: updatedProgress.masteryScore,
        reviewDetails
      }
    });
  } catch (error: any) {
    logger.error('Failed to submit quiz:', error);
    res.status(500).json({ success: false, error: { code: 'SUBMISSION_FAILED', message: error.message } });
  }
});

/**
 * POST /api/mentor/session/:id/assignment
 * Generate essay assignment details.
 */
mentorRouter.post('/session/:id/assignment', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const sessionId = req.params['id'] as string;
    const userId = (req.user as any).id as string;
    const { nodeId } = req.body as { nodeId: string };
    const session = await prisma.mentorSession.findFirst({
      where: { id: sessionId, userId }
    }) as any;

    if (!session || !nodeId) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
      return;
    }

    const syllabus = Array.isArray(session.roadmap) ? (session.roadmap as any[]) : [];
    const node = syllabus.find((n: any) => n.nodeId === nodeId);
    const nodeTitle = node?.title || 'General Concepts';

    const provider = getLLMProvider();
    const prompt = `Write a short assignment/essay question that tests a user's critical understanding of: "${nodeTitle}" (part of "${session.topic}") at a "${session.difficulty}" level.
Design the prompt so that it requires a short written paragraph answer explaining the core mechanisms.

Assignment Prompt:`;

    const assignmentText = await provider.generate(prompt, 'You are an university professor assigning short essays.');

    res.json({ success: true, data: { nodeId, prompt: assignmentText } });
  } catch (error: any) {
    logger.error('Failed to create assignment:', error);
    res.status(500).json({ success: false, error: { code: 'ASSIGNMENT_FAILED', message: error.message } });
  }
});

/**
 * POST /api/mentor/session/:id/assignment/submit
 * Evaluate student essay submission using LLM grading.
 */
mentorRouter.post('/session/:id/assignment/submit', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const sessionId = req.params['id'] as string;
    const userId = (req.user as any).id as string;
    const { nodeId, submission, prompt } = req.body as {
      nodeId: string;
      submission: string;
      prompt: string;
    };

    const session = await prisma.mentorSession.findFirst({
      where: { id: sessionId, userId }
    }) as any;

    if (!session || !nodeId || !submission || !prompt) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Incomplete parameters' } });
      return;
    }

    const syllabus = Array.isArray(session.roadmap) ? (session.roadmap as any[]) : [];
    const node = syllabus.find((n: any) => n.nodeId === nodeId);
    const nodeTitle = node?.title || 'General Concepts';

    const provider = getLLMProvider();
    const gradingPrompt = `Grade the student's submission for the following assignment prompt on topic: "${nodeTitle}".
Assignment Question: ${prompt}
Student Response: "${submission}"

Provide:
1. Score (from 0.0 to 1.0)
2. Detailed constructive feedback
3. Identify any specific weak points/weak areas mentioned in their response.

Output ONLY a valid JSON object matching this structure:
{
  "score": 0.85,
  "feedback": "Your explanation is correct, but you could elaborate more on...",
  "weakAreas": ["Concept X"]
}

JSON Output:`;

    const rawGrade = await provider.generate(gradingPrompt, 'You are an objective grading bot. Output ONLY raw valid JSON.');
    let grade = { score: 0.5, feedback: 'Grading failed to parse.', weakAreas: [] };
    try {
      const cleaned = rawGrade.replace(/```json/g, '').replace(/```/g, '').trim();
      grade = JSON.parse(cleaned);
    } catch (e) {
      logger.error('Failed to parse grading response: ' + rawGrade);
    }

    const progress = await prisma.mentorProgress.findUnique({
      where: { mentorSessionId_nodeId: { mentorSessionId: session.id, nodeId } }
    });

    if (!progress) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Progress not found' } });
      return;
    }

    const existingAssignments = Array.isArray(progress.assignments) ? (progress.assignments as any[]) : [];
    const assignmentHistory = [...existingAssignments, { timestamp: new Date(), submission, score: grade.score, feedback: grade.feedback }];

    // Update mastery score as the average of quiz and assignment (if both exist) or assignment score
    const updatedProgress = await prisma.mentorProgress.update({
      where: { id: progress.id },
      data: {
        masteryScore: grade.score,
        assignments: assignmentHistory as any,
        weakAreas: [...(progress.weakAreas as string[]), ...grade.weakAreas] as any
      }
    });

    res.json({ success: true, data: { grade, masteryScore: updatedProgress.masteryScore } });
  } catch (error: any) {
    logger.error('Failed to submit assignment:', error);
    res.status(500).json({ success: false, error: { code: 'SUBMISSION_FAILED', message: error.message } });
  }
});
