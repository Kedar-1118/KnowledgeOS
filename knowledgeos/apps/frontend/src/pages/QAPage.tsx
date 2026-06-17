// apps/frontend/src/pages/QAPage.tsx
/**
 * Redesigned Ask My Knowledge Page.
 * Research assistant workspace split layout:
 * Left Pane displays the message thread; Right Pane displays details of clicked source citations.
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
  BookOpen,
  Info,
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
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || isStreaming) return;

    setInput('');
    setIsStreaming(true);
    setSelectedSource(null); // Reset preview panel

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    try {
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
                // Automatically select first source
                if (sources.length > 0) {
                  setSelectedSource(sources[0] || null);
                }
              }

              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: accumulatedContent, sources }
                    : m
                )
              );
            } catch {
              // Ignore invalid lines
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
                content: `Error: ${error instanceof Error ? error.message : 'Connection failed'}. Please retry.`,
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

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-80px)] select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary uppercase tracking-wider">
            AI Assistant Workspace
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Query files using natural language. Citations are inspectable in the right side panel.
          </p>
        </div>
        
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setSelectedSource(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border text-xs text-text-secondary hover:text-error hover:bg-error/5 hover:border-error/20 transition-all duration-200 cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Clear Threads</span>
          </button>
        )}
      </div>

      {/* Main Split Layout Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Pane: Chat Workspace (65% width) */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-0 bg-surface rounded-2xl border border-surface-border overflow-hidden">
          
          {/* Messages Feed Wrapper */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              /* Greeting Interface */
              <div className="h-full flex flex-col justify-center items-center text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent-purple/10 border border-accent-purple/20 text-accent-purple mb-4 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                  <MessageSquare size={20} />
                </div>
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  Semantic Q&A Engine
                </h3>
                <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                  Enter questions targeting your document collections. The AI assistant extracts relevant files and writes an answer citing resources.
                </p>

                {/* Suggestions list */}
                <div className="mt-6 flex flex-col gap-2 w-full">
                  {[
                    'Summarize the core concepts in my recent uploads',
                    'How does reinforcement learning differ from supervised learning?',
                    'Explain the configuration settings for the backend proxy',
                  ].map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInput(suggestion)}
                      className="px-4 py-2.5 rounded-lg border border-surface-border bg-surface-hover/30 text-left text-xs text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors cursor-pointer leading-relaxed"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Messages flow */
              <div className="space-y-6">
                {messages.map(msg => (
                  <div key={msg.id} className="flex gap-4">
                    {/* User / Bot Identity badge */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border ${
                      msg.role === 'user'
                        ? 'bg-accent-teal/10 border-accent-teal/20 text-accent-teal'
                        : 'bg-accent-purple/10 border-accent-purple/20 text-accent-purple shadow-[0_0_10px_rgba(99,102,241,0.1)]'
                    }`}>
                      {msg.role === 'user' ? <User size={14} /> : <Brain size={14} />}
                    </div>

                    {/* Content text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-text-muted tracking-wider uppercase">
                          {msg.role === 'user' ? (user?.name || 'Authorized Member') : 'KnowledgeOS Engine'}
                        </span>
                        <span className="text-[9px] text-text-muted">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap font-sans">
                        {msg.content || (
                          <span className="flex items-center gap-2 text-text-muted">
                            <Loader2 size={12} className="animate-spin" /> Ingesting resources...
                          </span>
                        )}
                      </div>

                      {/* Source Citation chips (rendered inside thread) */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="text-[10px] text-text-muted font-bold tracking-wider uppercase">
                            Sources Cited:
                          </span>
                          {msg.sources.map((src, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedSource(src)}
                              className={`px-2.5 py-1 rounded text-[10px] font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                                selectedSource?.snippet === src.snippet
                                  ? 'bg-accent-teal/10 border-accent-teal/30 text-accent-teal'
                                  : 'bg-background-elevated border-surface-border text-text-secondary hover:border-text-muted hover:text-text-primary'
                              }`}
                            >
                              <FileText size={10} />
                              <span>[{idx + 1}] {src.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Inquiries Input */}
          <div className="border-t border-surface-border p-4 bg-background-elevated flex items-end gap-3.5">
            <textarea
              ref={textareaRef}
              id="qa-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask context questions..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none text-xs leading-relaxed max-h-32 resize-none py-1.5"
              style={{ color: 'var(--color-text-primary)' }}
              disabled={isStreaming}
            />
            <button
              id="qa-send-button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || isStreaming}
              className={`p-2.5 rounded-lg border transition-all duration-200 flex-shrink-0 cursor-pointer ${
                input.trim() && !isStreaming
                  ? 'bg-text-primary border-transparent text-background hover:scale-[1.03]'
                  : 'bg-surface border-surface-border text-text-muted cursor-not-allowed'
              }`}
            >
              {isStreaming ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
            </button>
          </div>

        </div>

        {/* Right Pane: Citation Inspector Panel (35% width) */}
        <div className="lg:col-span-4 h-full flex flex-col min-h-0 bg-surface rounded-2xl border border-surface-border p-5 overflow-hidden">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <BookOpen size={13} className="text-accent-teal" /> Citation Inspector
          </h3>

          {selectedSource ? (
            <div className="flex-1 flex flex-col justify-between overflow-y-auto space-y-5">
              
              {/* Document Summary info */}
              <div className="space-y-4">
                <div className="flex items-start gap-2 bg-background-elevated p-3 rounded-xl border border-surface-border">
                  <FileText size={16} className="text-text-muted mt-0.5 flex-shrink-0" />
                  <div className="leading-tight min-w-0">
                    <span className="text-xs font-bold text-text-primary block truncate">
                      {selectedSource.title}
                    </span>
                    <p className="text-[10px] text-text-muted mt-1">
                      {selectedSource.page ? `Page Location: ${selectedSource.page}` : 'No page coordinates'}
                    </p>
                  </div>
                </div>

                {/* Excerpt Snippet */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">
                    Source Excerpt
                  </span>
                  <div className="bg-background-elevated p-4 rounded-xl border border-surface-border text-[11px] text-text-secondary leading-relaxed font-sans max-h-60 overflow-y-auto">
                    {selectedSource.snippet}
                  </div>
                </div>
              </div>

              {/* Action trigger links */}
              <div className="space-y-2 pt-4 border-t border-surface-border">
                <div className="flex items-center justify-between text-[10px] text-text-secondary bg-background-elevated p-2 rounded border border-surface-border">
                  <span className="flex items-center gap-1"><Info size={10} /> Ingestion Type</span>
                  <span className="font-semibold text-text-primary">Google Drive Sync</span>
                </div>
                <button
                  onClick={() => window.open(`/api/documents/redirect/${selectedSource.documentId}`, '_blank')}
                  className="btn-google w-full justify-center py-2.5 rounded-lg border border-surface-border hover:bg-surface-hover cursor-pointer"
                >
                  <span className="text-[11px] font-bold">Inspect Source Document</span>
                  <ExternalLink size={12} className="text-text-muted" />
                </button>
              </div>

            </div>
          ) : (
            /* Citation Inspector idle panel */
            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 bg-background-elevated/40 border border-dashed border-surface-border rounded-xl">
              <BookOpen size={24} className="text-text-muted mb-3" />
              <h4 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">Awaiting Citations</h4>
              <p className="text-[10px] text-text-secondary mt-1.5 leading-relaxed max-w-[150px]">
                Click on cited references in chat messages to verify original file excerpts.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
