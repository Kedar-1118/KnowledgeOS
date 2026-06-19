// apps/backend/src/services/llm/llmProvider.ts
import { logger } from '../../utils/logger.js';
import { OllamaProvider } from './ollamaProvider.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { OpenAIProvider } from './openaiProvider.js';

export interface LLMProvider {
  generate(prompt: string, systemPrompt?: string): Promise<string>;
  stream(prompt: string, onChunk: (text: string) => void, systemPrompt?: string): Promise<void>;
  summarize(text: string): Promise<string>;
  createFlashcards(text: string): Promise<any[]>;
  createRoadmap(topic: string): Promise<any>;
}

let activeProvider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (activeProvider) return activeProvider;

  const providerType = (process.env['LLM_PROVIDER'] || 'ollama').toLowerCase();
  logger.info(`Initializing LLM Provider: ${providerType}`);

  switch (providerType) {
    case 'anthropic':
      activeProvider = new AnthropicProvider();
      break;
    case 'openai':
      activeProvider = new OpenAIProvider();
      break;
    case 'ollama':
    default:
      activeProvider = new OllamaProvider();
      break;
  }

  return activeProvider;
}
