// apps/frontend/src/pages/QAPage.tsx
/**
 * "Ask My Knowledge" — Chat-like Q&A interface with streaming AI answers.
 *
 * Features:
 * - Message thread (user questions + AI answers with streaming)
 * - Source citations as expandable cards below each answer
 * - Textarea input with shift+enter for newline, enter to send
 * - Recent questions history panel
 * - Clear conversation button
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Brain,
  User,
  FileText,
  ExternalLink,
  Trash2,
  MessageSquare,
  Loader2,
} from 'lucide-react';

import { useAuthStore } from '../store/authStore';

interface Source {
  documentId: string;
  title: string;
  page: number | null;
  snippet: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
}

export function QAPage() {
  const { user, token } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || isStreaming) return;

    setInput('');
    setIsStreaming(true);

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    // Add placeholder assistant message
    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    try {
      // Stream Q&A response via SSE
      const response = await fetch('/api/qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ question, topK: 5 }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let accumulatedContent = '';
      let sources: Source[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data) as {
                answer_chunk?: string;
                error?: string;
                sources?: Source[];
              };

              if (parsed.error) {
                accumulatedContent += parsed.error;
              } else if (parsed.answer_chunk) {
                accumulatedContent += parsed.answer_chunk;
              } else if (parsed.sources) {
                sources = parsed.sources;
              }

              // Update the assistant message with accumulated content
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: accumulatedContent, sources }
                    : m
                )
              );
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, token]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const clearConversation = () => {
    setMessages([]);
  };

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Ask My Knowledge
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Ask questions and get AI-powered answers from your documents
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(224,95,95,0.1)';
              e.currentTarget.style.color = 'var(--color-error)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-muted)';
            }}
          >
            <Trash2 size={15} />
            Clear
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto rounded-xl p-4 mb-4"
        style={{
          backgroundColor: 'var(--color-background-elevated)',
          border: '1px solid var(--color-surface-border)',
        }}
      >
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(127,119,221,0.15), rgba(29,158,117,0.15))',
              }}
            >
              <MessageSquare size={28} style={{ color: 'var(--color-accent-purple)' }} />
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Ask anything
            </h3>
            <p
              className="text-sm text-center max-w-md mb-6"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              I&apos;ll search your documents and provide answers with source citations.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                'What are the key concepts in my notes?',
                'Explain the main idea of the last paper I uploaded',
                'How do these topics relate to each other?',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(suggestion); }}
                  className="px-3 py-1.5 rounded-full text-xs transition-colors"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-surface-border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent-purple)';
                    e.currentTarget.style.color = 'var(--color-accent-purple)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-surface-border)';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map(msg => (
              <div key={msg.id} className="flex gap-3">
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    backgroundColor: msg.role === 'user'
                      ? 'rgba(29,158,117,0.15)'
                      : 'rgba(127,119,221,0.15)',
                  }}
                >
                  {msg.role === 'user' ? (
                    <User size={16} style={{ color: 'var(--color-accent-teal)' }} />
                  ) : (
                    <Brain size={16} style={{ color: 'var(--color-accent-purple)' }} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <span
                    className="text-xs font-medium mb-1 block"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {msg.role === 'user' ? (user?.name ?? 'You') : 'KnowledgeOS'}
                  </span>

                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {msg.content || (
                      <span className="flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                        <Loader2 size={14} className="animate-spin" />
                        Thinking...
                      </span>
                    )}
                  </div>

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        Sources
                      </span>
                      {msg.sources.map((source, i) => (
                        <div
                          key={i}
                          className="rounded-lg p-3 text-xs"
                          style={{
                            backgroundColor: 'var(--color-surface)',
                            border: '1px solid var(--color-surface-border)',
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <FileText size={12} style={{ color: 'var(--color-accent-teal)' }} />
                            <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                              {source.title}
                            </span>
                            {source.page && (
                              <span style={{ color: 'var(--color-text-muted)' }}>
                                · Page {source.page}
                              </span>
                            )}
                            <ExternalLink
                              size={12}
                              className="ml-auto cursor-pointer"
                              style={{ color: 'var(--color-text-muted)' }}
                            />
                          </div>
                          <p style={{ color: 'var(--color-text-secondary)' }}>
                            {source.snippet}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div
        className="flex items-end gap-3 p-3 rounded-xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-surface-border)',
        }}
      >
        <textarea
          ref={textareaRef}
          id="qa-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents..."
          rows={1}
          className="flex-1 bg-transparent border-none outline-none text-sm resize-none"
          style={{
            color: 'var(--color-text-primary)',
            maxHeight: '150px',
            lineHeight: '1.5',
          }}
          disabled={isStreaming}
        />
        <button
          id="qa-send-button"
          onClick={() => void handleSend()}
          disabled={!input.trim() || isStreaming}
          className="p-2.5 rounded-lg transition-all duration-200"
          style={{
            backgroundColor: input.trim() && !isStreaming ? 'var(--color-accent-teal)' : 'rgba(255,255,255,0.05)',
            color: input.trim() && !isStreaming ? 'white' : 'var(--color-text-muted)',
            cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
          }}
        >
          {isStreaming ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  );
}
