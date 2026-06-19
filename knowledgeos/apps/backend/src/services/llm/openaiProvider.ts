// apps/backend/src/services/llm/openaiProvider.ts
import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { type LLMProvider } from './llmProvider.js';

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env['OPENAI_API_KEY'] || '';
    this.model = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
    this.baseUrl = process.env['OPENAI_BASE_URL'] || 'https://api.openai.com/v1';
  }

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in environment variables');
    }

    try {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: 0.2
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'content-type': 'application/json'
          }
        }
      );

      return response.data?.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      logger.error('OpenAI generate failed: ' + error.message);
      throw error;
    }
  }

  async stream(prompt: string, onChunk: (text: string) => void, systemPrompt?: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    try {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: 0.3,
          stream: true
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'content-type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      return new Promise((resolve, reject) => {
        const stream = response.data;
        let buffer = '';

        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const text = parsed.choices?.[0]?.delta?.content;
              if (text) onChunk(text);
            } catch (e) {}
          }
        });

        stream.on('end', () => resolve());
        stream.on('error', (err: any) => reject(err));
      });
    } catch (error: any) {
      logger.error('OpenAI stream failed: ' + error.message);
      throw error;
    }
  }

  async summarize(text: string): Promise<string> {
    const prompt = `Analyze the following text and generate a concise, professional summary (around 3-4 sentences):
    
Text:
${text}

Summary:`;
    return this.generate(prompt, 'You are a professional knowledge summarizer. Be direct, clear, and informative. Avoid preambles.');
  }

  async createFlashcards(text: string): Promise<any[]> {
    const prompt = `Analyze the following text chunk and generate 3 spaced-repetition flashcards covering the key concepts.
Output ONLY a valid JSON array matching this typescript type:
Array<{
  cardType: "DEFINITION" | "CONCEPT" | "FILL_BLANK" | "QA";
  question: string;
  answer: string;
  difficultyScore: number; // 1 to 5
}>

Requirements for card types:
- DEFINITION: e.g. "What is Qdrant?"
- CONCEPT: e.g. "Why use vector embeddings?"
- FILL_BLANK: e.g. "Qdrant stores ______ vectors."
- QA (Interview Prep): e.g. "Explain semantic search."

Text:
${text}

JSON Output:`;

    const raw = await this.generate(prompt, 'You are an educational assistant that outputs ONLY raw JSON arrays. Do not include markdown code block formatting or commentary.');
    try {
      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      logger.error('Failed to parse flashcards JSON from OpenAI: ' + raw);
      return [];
    }
  }

  async createRoadmap(topic: string): Promise<any> {
    const prompt = `Generate a learning curriculum / roadmap to learn the topic: "${topic}".
Output ONLY a valid JSON array of nodes representing the lessons/subtopics.
Structure:
Array<{
  label: string; // Name of the lesson
  type: "CORE" | "ELECTIVE" | "ADVANCED";
  parentLabel: string | null; // Label of the parent lesson to build a tree structure (use null for root nodes)
  order: number; // Order sequence index
}>

Generate between 5 to 10 nodes showing a progressive learning tree.

JSON Output:`;

    const raw = await this.generate(prompt, 'You are a professional syllabus compiler that outputs ONLY raw JSON arrays. Do not include markdown code block formatting or commentary.');
    try {
      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      logger.error('Failed to parse roadmap JSON from OpenAI: ' + raw);
      return [];
    }
  }
}
