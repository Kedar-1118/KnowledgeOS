// apps/backend/src/services/knowledgeAnalyzer.ts
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { getLLMProvider } from './llm/llmProvider.js';

export async function analyzeKnowledgeGaps(userId: string): Promise<any[]> {
  logger.info(`Analyzing knowledge gaps for user ${userId}...`);

  try {
    // 1. Fetch Search History
    const searches = await prisma.searchHistory.findMany({
      where: { userId },
      select: { query: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 2. Fetch Unvisited Documents (accessCount = 0)
    const unvisitedDocs = await prisma.document.findMany({
      where: { userId, accessCount: 0, status: 'INDEXED' },
      select: { title: true },
      take: 20,
    });

    // 3. Fetch Failed Revision items (easeFactor < 2.0 or intervalDays = 1)
    const strugglingCards = await prisma.revisionItem.findMany({
      where: {
        userId,
        OR: [
          { easeFactor: { lt: 2.0 } },
          { intervalDays: 1, repetitionCount: { gt: 0 } },
        ],
      },
      select: { topicName: true, question: true },
      take: 20,
    });

    // 4. Fetch Conversations
    const conversations = await prisma.documentConversation.findMany({
      where: { userId },
      select: { insights: true, followUps: true },
      take: 10,
    });

    // Compile text profile for the LLM
    const searchQueries = searches.map(s => s.query).join(', ');
    const unvisitedTitles = unvisitedDocs.map(d => d.title).join(', ');
    const strugglingTopics = strugglingCards.map(c => `${c.topicName} ( Struggled on: ${c.question} )`).join(', ');

    let chatInsights = '';
    for (const conv of conversations) {
      if (Array.isArray(conv.insights)) {
        chatInsights += conv.insights.join('. ') + ' ';
      }
    }

    const prompt = `Analyze the following learning activity log for a user in KnowledgeOS.
Identify:
1. What subjects/topics the user understands well.
2. What specific subtopics or concepts are "Knowledge Gaps" (i.e. missing prerequisites, topics they search for but haven't studied, concepts they fail at in revisions, or unvisited docs that they might need).
Format the output as a valid JSON object matching this structure:
{
  "understood": ["React Hooks", "Docker Basics"],
  "gaps": [
    { "topic": "React Memoization", "confidence": 0.85 },
    { "topic": "Docker Multi-stage Builds", "confidence": 0.70 }
  ]
}

User Activity Log:
- Recent Search Queries: ${searchQueries || 'None'}
- Unvisited Knowledge Files: ${unvisitedTitles || 'None'}
- Revisions User is Struggling With: ${strugglingTopics || 'None'}
- Chat Memory Facts/Insights: ${chatInsights || 'None'}

JSON Output:`;

    const provider = getLLMProvider();
    const rawOutput = await provider.generate(prompt, 'You are an educational analytics engine that outputs ONLY valid JSON objects.');
    
    let result = { understood: [], gaps: [] };
    try {
      const cleaned = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (e) {
      logger.error('Failed to parse knowledge gaps analyzer LLM output: ' + rawOutput);
    }

    // Save gaps to database
    if (result.gaps && Array.isArray(result.gaps)) {
      // Clear old gaps
      await prisma.knowledgeGap.deleteMany({ where: { userId } });

      // Insert new gaps
      const createData = result.gaps.map((g: any) => ({
        userId,
        topic: String(g.topic || ''),
        confidence: Number(g.confidence || 0.5),
      })).filter(g => g.topic !== '');

      if (createData.length > 0) {
        await prisma.knowledgeGap.createMany({
          data: createData,
        });
      }
    }

    return result.gaps || [];
  } catch (error) {
    logger.error(`Knowledge analyzer failed:`, error);
    return [];
  }
}
