// apps/frontend/src/pages/SearchPage.tsx
/**
 * SearchPage — Premium Semantic Search Interface.
 * Features a spotlight-style query bar, search histories stored in localStorage,
 * and a side-by-side details preview showing text snippets with highlight matching.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface SearchResult {
  documentId: string;
  documentTitle: string;
  chunkContent: string;
  score: number;
  pageNumber: number | null;
  headingContext: string | null;
  fileType: string;
  fileName: string;
  driveFileUrl: string | null;
  tags: Array<{
    label: string;
    category: string;
    color: string;
    confidence: number;
  }>;
}

interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  queryTimeMs: number;
}

const RECENT_SEARCHES_KEY = 'knowledgeos-recent-searches';
const MAX_RECENT_LOGS = 6;

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function addRecentSearch(queryStr: string): void {
  const query = queryStr.trim();
  if (!query) return;
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_LOGS)));
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(urlQuery);
  const [submittedQuery, setSubmittedQuery] = useState(urlQuery);
  const [focused, setFocused] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Sync with URL query parameter changes ───
  useEffect(() => {
    if (urlQuery) {
      setQuery(urlQuery);
      setSubmittedQuery(urlQuery);
    }
  }, [urlQuery]);

  // ─── Cmd+K Focus Listener ───
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // ─── Query: Fetch Semantic Matches ───
  const { data, isLoading } = useQuery<SearchResponse>({
    queryKey: ['search', submittedQuery],
    queryFn: async () => {
      const res = await api.post<{ success: boolean; data: SearchResponse }>('/api/search', {
        query: submittedQuery,
        topK: 12,
      });
      return res.data.data;
    },
    enabled: !!submittedQuery,
  });

  const handleSearchSubmit = useCallback((qStr: string) => {
    const trimmed = qStr.trim();
    if (trimmed) {
      setSubmittedQuery(trimmed);
      setSearchParams({ q: trimmed });
      addRecentSearch(trimmed);
      setFocused(false);
      setSelectedResult(null);
    }
  }, [setSearchParams]);

  // Sync selected node with first result on load
  useEffect(() => {
    if (data?.results && data.results.length > 0) {
      setSelectedResult(data.results[0] || null);
    } else {
      setSelectedResult(null);
    }
  }, [data]);

  const recentSearches = getRecentSearches();

  // Highlight matches function
  const renderHighlightedText = (text: string, q: string) => {
    if (!q.trim()) return <span>{text}</span>;
    const words = q.split(/\s+/).filter(Boolean);
    const regex = new RegExp(`(${words.join('|')})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, idx) =>
          regex.test(part) ? (
            <span key={idx} className="highlight-match">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="animate-fade-in flex flex-col items-center select-none flex-1 min-h-[calc(100vh-100px)]">
      {/* Hero / Search Section */}
      <section className="w-full max-w-4xl relative z-20">
        <div className="text-center mb-xl">
          <h1 className="font-display-lg text-display-lg text-on-surface mb-xs text-3xl font-semibold">Search Intelligence</h1>
          <p className="font-body-md text-on-surface-variant text-sm">Analyze across vectors, documents, and neural graphs.</p>
        </div>
        <div className="relative w-full group">
          <div className="search-glow flex items-center bg-surface-container-high border border-outline-variant rounded-xl p-4 transition-all duration-300">
            <span className="material-symbols-outlined text-primary mr-md">search</span>
            <input
              ref={inputRef}
              className="bg-transparent border-none outline-none w-full text-on-surface font-body-lg text-sm placeholder:text-on-surface-variant/50 focus:ring-0 focus:border-none"
              placeholder="Search knowledge base..."
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchSubmit(query);
                if (e.key === 'Escape') {
                  setFocused(false);
                  inputRef.current?.blur();
                }
              }}
            />
            <div className="flex gap-xs items-center ml-auto">
              <kbd className="font-code text-[11px] bg-surface-container-lowest px-2 py-0.5 rounded border border-outline-variant text-on-surface-variant font-mono">⌘</kbd>
              <kbd className="font-code text-[11px] bg-surface-container-lowest px-2 py-0.5 rounded border border-outline-variant text-on-surface-variant font-mono">K</kbd>
            </div>
          </div>

          {/* Spotlight Dropdown (Visible on focus) */}
          {focused && recentSearches.length > 0 && (
            <div className="absolute top-[calc(100%+8px)] left-0 w-full glass-effect rounded-xl overflow-hidden shadow-2xl transition-all duration-300 z-30 opacity-100 translate-y-0">
              <div className="p-sm border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-high/40">
                <span className="font-label-sm text-on-surface-variant px-md text-[10px] font-bold uppercase tracking-wider">Recent Searches</span>
                <button
                  className="font-label-sm text-primary hover:text-primary-fixed-dim px-md text-[10px] font-bold cursor-pointer"
                  onClick={() => {
                    localStorage.removeItem(RECENT_SEARCHES_KEY);
                    setFocused(false);
                  }}
                >
                  Clear All
                </button>
              </div>
              <div className="py-1 bg-surface-dim">
                {recentSearches.map((historyQuery, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setQuery(historyQuery);
                      handleSearchSubmit(historyQuery);
                    }}
                    className="flex items-center gap-md px-lg py-2.5 hover:bg-white/5 cursor-pointer transition-colors group"
                  >
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-[18px]">history</span>
                    <span className="flex-1 font-body-md text-xs text-on-surface">{historyQuery}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Search Results / Split View */}
      {submittedQuery && (
        <section className="flex-grow w-full max-w-6xl mt-xl grid grid-cols-12 gap-lg overflow-hidden items-stretch">
          {/* Results List */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-md pr-1 overflow-y-auto max-h-[550px]">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : data && data.results.length > 0 ? (
              data.results.map((res, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedResult(res)}
                  className={`bg-surface-container-low border rounded-xl p-lg transition-colors cursor-pointer group flex flex-col justify-between ${
                    selectedResult?.documentId === res.documentId && selectedResult?.chunkContent === res.chunkContent
                      ? 'border-primary shadow-md bg-surface-container-high/40'
                      : 'border-outline-variant hover:border-primary/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-sm gap-2">
                    <div className="flex items-center gap-sm min-w-0">
                      <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {res.fileType === 'PDF' ? 'picture_as_pdf' : 'description'}
                      </span>
                      <h3 className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                        {res.documentTitle}
                      </h3>
                    </div>
                    <div className="bg-secondary-container/20 border border-secondary-fixed-dim/30 text-secondary px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0">
                      {Math.round(res.score * 100)}% Match
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 mb-md font-sans">
                    {renderHighlightedText(res.chunkContent, submittedQuery)}
                  </p>
                  <div className="flex items-center gap-md text-[10px] text-on-surface-variant border-t border-outline-variant/20 pt-2 font-mono">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">folder</span>
                      <span>{res.fileType} Ingestion</span>
                    </div>
                    {res.pageNumber && (
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">find_in_page</span>
                        <span>Page {res.pageNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-12 glass-panel rounded-xl text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl opacity-30 block mb-2">sentiment_dissatisfied</span>
                <span className="text-xs">No vector matches found for "{submittedQuery}". Try refining the query keywords.</span>
              </div>
            )}
          </div>

          {/* Detail Panel (Right Side) */}
          <div className="col-span-12 lg:col-span-5 flex flex-col bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden min-h-[300px]">
            {selectedResult ? (
              <div className="p-xl flex-1 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold">
                      Concept Excerpt
                    </span>
                    {selectedResult.driveFileUrl && (
                      <button 
                        onClick={() => window.open(selectedResult.driveFileUrl!, '_blank')}
                        className="material-symbols-outlined text-on-surface-variant hover:text-on-surface text-[18px] cursor-pointer"
                        title="Open document"
                      >
                        open_in_new
                      </button>
                    )}
                  </div>
                  <h2 className="font-display-lg text-lg text-on-surface font-semibold leading-tight">
                    {selectedResult.documentTitle}
                  </h2>
                  <div className="flex flex-wrap gap-xs">
                    <span className="text-[10px] bg-white/5 border border-outline-variant px-2 py-0.5 rounded font-mono text-on-surface-variant">
                      Type: {selectedResult.fileType}
                    </span>
                    {selectedResult.pageNumber && (
                      <span className="text-[10px] bg-white/5 border border-outline-variant px-2 py-0.5 rounded font-mono text-on-surface-variant">
                        Page: {selectedResult.pageNumber}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-[150px] bg-surface-dim border border-outline-variant/50 p-4 rounded-xl overflow-y-auto font-sans leading-relaxed text-xs text-on-surface">
                  {renderHighlightedText(selectedResult.chunkContent, submittedQuery)}
                </div>

                <div className="pt-4 border-t border-outline-variant/30 text-[10px] text-on-surface-variant font-mono">
                  <span>Cosine Similarity: {(selectedResult.score).toFixed(4)}</span>
                </div>
              </div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center p-6 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-3 opacity-30">info</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">Concept Analysis</h4>
                <p className="text-[11px] mt-1.5 leading-relaxed max-w-[180px]">
                  Select any matching block item on the list view to analyze its context snippets.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
