// apps/backend/src/services/llm/ollamaProvider.ts
import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { type LLMProvider } from './llmProvider.js';

export class OllamaProvider implements LLMProvider {
  private ollamaUrl: string;
  private defaultModel: string;
  private activeModel: string | null = null;
  private modelsFallbackList = ['gemma3:12b', 'qwen3:8b', 'qwen3:4b', 'llama3.1:8b'];

  constructor() {
    this.ollamaUrl = process.env['OLLAMA_URL'] || 'http://localhost:11434';
    this.defaultModel = process.env['OLLAMA_MODEL'] || 'gemma3:12b';
  }

  private async getWorkingModel(): Promise<string> {
    if (this.activeModel) return this.activeModel;

    // Check availability starting from defaultModel, then fall back
    const list = [this.defaultModel, ...this.modelsFallbackList.filter(m => m !== this.defaultModel)];

    for (const model of list) {
      try {
        logger.debug(`Checking if Ollama model ${model} is available at ${this.ollamaUrl}...`);
        // We do a fast generate check with timeout
        await axios.post(
          `${this.ollamaUrl}/api/generate`,
          { model, prompt: 'say hi', stream: false },
          { timeout: 3000 }
        );
        logger.info(`Ollama selected model: ${model}`);
        this.activeModel = model;
        return model;
      } catch (err: any) {
        logger.warn(`Ollama model ${model} is not available: ${err.message}`);
      }
    }

    // Default fallback to first list item even if test failed, maybe server is slow
    logger.error('No Ollama models answered the health check. Defaulting to ' + this.defaultModel);
    this.activeModel = this.defaultModel;
    return this.defaultModel;
  }

  private resetWorkingModelOnError() {
    this.activeModel = null;
  }

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const model = await this.getWorkingModel();
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model,
        prompt,
        system: systemPrompt,
        stream: false,
        options: { temperature: 0.2 }
      }, { timeout: 60000 });

      return response.data?.response || '';
    } catch (error: any) {
      logger.error(`Ollama generate failed for ${model}: ${error.message}`);
      this.resetWorkingModelOnError();
      // Retry once with fallback
      const fallbackModel = await this.getWorkingModel();
      if (fallbackModel !== model) {
        logger.info(`Retrying generate with fallback model ${fallbackModel}`);
        return this.generate(prompt, systemPrompt);
      }
      throw error;
    }
  }

  async stream(prompt: string, onChunk: (text: string) => void, systemPrompt?: string): Promise<void> {
    const model = await this.getWorkingModel();
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model,
        prompt,
        system: systemPrompt,
        stream: true,
        options: { temperature: 0.3 }
      }, { responseType: 'stream', timeout: 60000 });

      return new Promise((resolve, reject) => {
        const stream = response.data;
        let buffer = '';

        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              const text = parsed.response;
              if (text) onChunk(text);
            } catch (e) {
              logger.warn('Failed to parse streaming line from Ollama: ' + line);
            }
          }
        });

        stream.on('end', () => {
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer);
              const text = parsed.response;
              if (text) onChunk(text);
            } catch (e) {}
          }
          resolve();
        });

        stream.on('error', (err: any) => reject(err));
      });
    } catch (error: any) {
      logger.error(`Ollama stream failed for ${model}: ${error.message}`);
      this.resetWorkingModelOnError();
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

    const raw = await this.generate(prompt, 'You are an educational assistant that outputs ONLY raw JSON arrays. Do not include markdown code block formatting (like ```json), commentary, or notes.');
    try {
      // Clean up markdown code blocks if the model ignored system instructions
      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      logger.error('Failed to parse flashcards JSON from Ollama: ' + raw);
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

    const raw = await this.generate(prompt, 'You are a professional syllabus compiler that outputs ONLY raw JSON arrays. Do not include markdown code block formatting (like ```json) or commentary.');
    try {
      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      logger.error('Failed to parse roadmap JSON from Ollama: ' + raw);
      return [];
    }
  }
}
