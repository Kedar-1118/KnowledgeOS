// apps/frontend/src/pages/QAPage.tsx
/**
 * QAPage — AI Research Assistant Workspace.
 * Integrates an SSE streaming chatbot client, citation tags,
 * and a sidebar to inspect original source excerpts.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
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

  // Textarea height auto-adjust
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
    setSelectedSource(null);

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

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

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
        throw new Error(`HTTP Error ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No stream body');

      let accumulatedAnswer = '';
      let sources: Source[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const rawData = line.slice(6);
            if (rawData === '[DONE]') continue;

            try {
              const parsed = JSON.parse(rawData) as {
                answer_chunk?: string;
                error?: string;
                sources?: Source[];
              };

              if (parsed.error) {
                accumulatedAnswer += parsed.error;
              } else if (parsed.answer_chunk) {
                accumulatedAnswer += parsed.answer_chunk;
              } else if (parsed.sources) {
                sources = parsed.sources;
                if (sources.length > 0) {
                  setSelectedSource(sources[0] || null);
                }
              }

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: accumulatedAnswer, sources } : msg
                )
              );
            } catch {
              // Ignore parser errors
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: `Error generating response: ${err.message || 'System fault'}` }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, token]);

  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const citations = latestAssistantMessage?.sources ?? [];

  return (
    <div className="flex h-[calc(100vh-100px)] overflow-hidden rounded-xl border border-outline-variant glass-panel select-none relative">
      {/* Left: Chat Column */}
      <section className="flex-grow flex flex-col min-w-0 bg-surface-dim justify-between h-full">
        {/* Chat Message Lists */}
        <div className="flex-1 overflow-y-auto p-gutter custom-scrollbar space-y-xl" id="chat-container">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-on-surface-variant max-w-md mx-auto">
              <span className="material-symbols-outlined text-4xl mb-4 text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                smart_toy
              </span>
              <h3 className="font-display-lg text-lg font-bold text-on-surface">AI Research Assistant</h3>
              <p className="text-xs leading-relaxed text-on-surface-variant mt-2">
                Ask questions regarding technical reports, legal compliance specs, and financial datasets.
                Nexus AI will synthesize answers referencing direct citations.
              </p>
            </div>
          ) : (
            <div className="space-y-xl">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end ml-auto' : 'items-start'} max-w-3xl`}
                >
                  {/* Sender title */}
                  <div className="flex items-center gap-sm mb-xs">
                    {msg.role === 'assistant' ? (
                      <>
                        <div className="w-6 h-6 bg-primary-container rounded-md flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-[14px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                            smart_toy
                          </span>
                        </div>
                        <span className="font-label-sm text-xs font-bold text-primary">Nexus Engine</span>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 bg-white/10 rounded-md flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                            person
                          </span>
                        </div>
                        <span className="font-label-sm text-xs font-bold text-on-surface-variant">
                          {user?.name?.split(' ')[0] ?? 'Explorer'}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Bubble content */}
                  <div className={`border shadow-sm px-lg py-md rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary-container/20 border-primary/30 rounded-tr-none text-on-surface'
                      : 'bg-surface-container-high/40 border-outline-variant/30 rounded-tl-none text-on-surface'
                  }`}>
                    <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.content || (
                        <div className="flex items-center gap-1.5 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>

                    {/* Citations chip links row */}
                    {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-4 border-t border-outline-variant/20 pt-2.5">
                        {msg.sources.map((src, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedSource(src)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                              selectedSource?.snippet === src.snippet
                                ? 'bg-primary/20 border-primary text-primary'
                                : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px]">link</span>
                            <span>Source [{index + 1}]</span>
                          </button>
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

        {/* Input Pane */}
        <div className="p-gutter border-t border-outline-variant bg-surface-container-lowest/50">
          <div className="max-w-3xl mx-auto relative glass-panel rounded-xl p-2 focus-within:ring-2 focus-within:ring-primary/20">
            <div className="flex flex-col">
              <textarea
                ref={textareaRef}
                className="w-full bg-transparent border-none text-xs p-md focus:ring-0 resize-none max-h-24 custom-scrollbar text-on-surface outline-none"
                placeholder="Ask Nexus AI about your data..."
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <div className="flex items-center justify-between px-md pb-md">
                <div className="flex items-center gap-md text-on-surface-variant/60">
                  <button className="hover:text-primary transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">attach_file</span>
                  </button>
                  <button className="hover:text-primary transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">mic</span>
                  </button>
                  <button className="hover:text-primary transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">image</span>
                  </button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={isStreaming || !input.trim()}
                  className="bg-primary text-on-primary p-2 rounded-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px] block">send</span>
                </button>
              </div>
            </div>
          </div>
          <div className="mt-sm text-center">
            <p className="font-label-sm text-[9px] text-on-surface-variant/40 tracking-wider">
              NEXUS AI MAY DISPLAY INACCURATE INFO. VERIFY CITATIONS.
            </p>
          </div>
        </div>
      </section>

      {/* Right: Citations panel drawer */}
      <aside className="w-[360px] bg-surface-container-low border-l border-outline-variant flex flex-col overflow-hidden h-full">
        <div className="p-md border-b border-outline-variant flex items-center justify-between">
          <h2 className="font-label-sm text-xs font-bold text-on-surface uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">menu_book</span>
            Citations ({citations.length})
          </h2>
          <button className="p-1 text-on-surface-variant hover:text-on-surface cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
          </button>
        </div>

        {/* Selected Excerpt preview details */}
        {selectedSource ? (
          <div className="flex-1 flex flex-col overflow-y-auto p-md space-y-md custom-scrollbar bg-surface-dim/40">
            <div className="glass-panel p-md rounded-xl border-l-4 border-l-primary flex flex-col justify-between min-h-[200px]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase">
                    Active Excerpt
                  </span>
                  {selectedSource.page && (
                    <span className="text-[10px] text-on-surface-variant font-semibold">
                      Page {selectedSource.page}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-on-surface">
                  {selectedSource.title}
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed italic whitespace-pre-wrap font-sans">
                  "{selectedSource.snippet}"
                </p>
              </div>
              <div className="mt-md pt-3 border-t border-outline-variant/20 flex items-center gap-2 text-[10px] text-on-surface-variant font-mono">
                <span className="material-symbols-outlined text-[14px]">find_in_page</span>
                <span>Vector Chunk Reference</span>
              </div>
            </div>

            {/* Inactive citations list in the same drawer for visual depth */}
            <div className="space-y-2 mt-4">
              <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                Other Sources Checked
              </span>
              <div className="space-y-2">
                {citations
                  .filter((c) => c.snippet !== selectedSource.snippet)
                  .map((c, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedSource(c)}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-outline-variant/30 cursor-pointer text-xs transition-colors"
                    >
                      <h4 className="font-semibold text-on-surface truncate">{c.title}</h4>
                      <p className="text-[10px] text-on-surface-variant truncate mt-1 italic">
                        "{c.snippet}"
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-on-surface-variant bg-surface-dim/20">
            <span className="material-symbols-outlined text-4xl mb-3 opacity-30">menu_book</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">Source Excerpts</h4>
            <p className="text-[11px] mt-1.5 leading-relaxed max-w-[180px]">
              Type a question in the prompt input to receive dynamic references, then click any citation link to view original snippets.
            </p>
          </div>
        )}

        {/* Network topology visualizer mock */}
        <div className="p-md bg-surface-container-highest/20 border-t border-outline-variant">
          <div className="relative h-24 rounded-lg overflow-hidden border border-outline-variant bg-surface-dim flex items-center justify-center">
            <img
              alt="Data Center Visualization"
              className="w-full h-full object-cover opacity-30 grayscale"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAXgzzYWAPzgtVIhSKIIi62DMK_zGaNIlZ8QQfTx9F7KmGO37akFeC5t_IC-zGAMeyap8RkNH2MURq8uxr6qvBr0aqkrO7llkxLh_yv2fKyzgkLiRN1NZ5CLaExX_1pi0yQmcbK4DQjBg4g9H-HpHPsatQL1az9S9_mA6hoOq7zRFbJnDn308SiEXvDLxsNXBQjnkciUjrbZgqo0qAYd-B7UPCh_uxiWdLiNquI2kA5m2Q3Bf3K24nfHnBgdoiBPTGqI4OH5QVN_jI"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low to-transparent" />
            <div className="absolute bottom-2 left-2">
              <p className="font-label-sm text-[9px] text-primary-fixed uppercase tracking-widest font-bold">
                Knowledge Topology Map
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
