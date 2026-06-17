// apps/frontend/src/pages/SearchPage.tsx
/**
 * Redesigned Semantic Search Page.
 * Spotlight-style search bar combined with a side-by-side Live Preview Panel.
 * Left Pane displays search results; Right Pane displays selected chunk preview in detail.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search as SearchIcon,
  FileText,
  Filter,
  X,
  Clock,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react';

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
const MAX_RECENT = 8;

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string): void {
  const recent = getRecentSearches().filter(s => s !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search query fetching
  const { data, isLoading, isFetching } = useQuery<SearchResponse>({
    queryKey: ['search', submittedQuery],
    queryFn: async () => {
      const res = await api.post<{ success: boolean; data: SearchResponse }>('/api/search', {
        query: submittedQuery,
        topK: 15,
      });
      return res.data.data;
    },
    enabled: !!submittedQuery,
  });

  const handleSubmit = useCallback((searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      setSubmittedQuery(trimmed);
      addRecentSearch(trimmed);
      setShowRecent(false);
      setSelectedResult(null); // Reset selection
    }
  }, []);

  // Set default selection when data arrives
  useEffect(() => {
    if (data && data.results.length > 0) {
      setSelectedResult(data.results[0] || null);
    } else {
      setSelectedResult(null);
    }
  }, [data]);

  const recentSearches = getRecentSearches();

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6 select-none">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-text-primary font-sans uppercase tracking-wider">
          Semantic Finder
        </h1>
        <p className="text-xs text-text-secondary mt-1">
          Perform concept-based neural searches across Google Drive files.
        </p>
      </div>

      {/* Spotlight Command Bar */}
      <div className="relative">
        <div
          className="flex items-center gap-3 px-5 py-4.5 rounded-xl border transition-all duration-200"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: showRecent ? 'var(--color-accent-teal)' : 'var(--color-surface-border)',
            boxShadow: showRecent ? '0 0 20px rgba(14,165,233,0.1)' : 'none',
          }}
        >
          <SearchIcon size={18} className="text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            id="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowRecent(true)}
            onBlur={() => setTimeout(() => setShowRecent(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit(query);
              if (e.key === 'Escape') {
                setShowRecent(false);
                inputRef.current?.blur();
              }
            }}
            placeholder="Search matching concepts or ask a question (e.g. 'explain neural backpropagation')..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-sans"
            style={{ color: 'var(--color-text-primary)' }}
            autoFocus
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setSubmittedQuery(''); setSelectedResult(null); }}
              className="p-1 rounded-md text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-background-elevated border border-surface-border text-text-muted font-mono">
            ⌘K
          </kbd>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 rounded-lg transition-colors cursor-pointer"
            style={{
              color: showFilters ? 'var(--color-accent-teal)' : 'var(--color-text-muted)',
              backgroundColor: showFilters ? 'rgba(14,165,233,0.08)' : 'transparent',
            }}
          >
            <Filter size={16} />
          </button>
        </div>

        {/* Recent queries suggestion dropdown */}
        {showRecent && !submittedQuery && recentSearches.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2.5 rounded-xl border border-surface-border bg-surface shadow-[0_12px_30px_rgba(0,0,0,0.5)] z-20 overflow-hidden">
            <div className="px-4 py-2 border-b border-surface-border">
              <span className="text-[10px] font-bold text-text-muted tracking-wider uppercase">
                Recent Search Inquiries
              </span>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {recentSearches.map((recent, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(recent); handleSubmit(recent); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary cursor-pointer"
                >
                  <Clock size={12} className="text-text-muted" />
                  <span className="flex-1 font-medium">{recent}</span>
                  <ChevronRight size={12} className="text-text-muted" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Split Layout Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Pane (Results List) */}
        <div className="lg:col-span-7 flex flex-col min-h-[500px]">
          {isLoading || isFetching ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-xl border border-surface-border bg-surface p-5 space-y-3">
                  <div className="skeleton h-5 w-2/3" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-5/6" />
                  <div className="flex gap-2">
                    <div className="skeleton h-4.5 w-16" />
                    <div className="skeleton h-4.5 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : data && data.results.length > 0 ? (
            <div className="space-y-3">
              {/* Statistics row */}
              <div className="flex items-center justify-between text-xs text-text-secondary px-1">
                <span>{data.totalCount} result matches for &ldquo;{submittedQuery}&rdquo;</span>
                <span className="font-mono text-text-muted">{data.queryTimeMs.toFixed(0)}ms</span>
              </div>

              {/* Cards List */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {data.results.map((result, idx) => (
                  <ResultRowCard
                    key={`${result.documentId}-${idx}`}
                    result={result}
                    query={submittedQuery}
                    isSelected={selectedResult?.documentId === result.documentId && selectedResult?.chunkContent === result.chunkContent}
                    onSelect={() => setSelectedResult(result)}
                  />
                ))}
              </div>
            </div>
          ) : submittedQuery ? (
            /* Empty state results */
            <div className="rounded-2xl border border-surface-border bg-surface p-12 text-center flex-1 flex flex-col justify-center items-center">
              <SearchIcon size={32} className="text-text-muted mb-4" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">No Matches Located</h3>
              <p className="text-xs text-text-secondary mt-2 max-w-sm leading-relaxed">
                Could not retrieve semantic clusters. Rephrase details or confirm Drive index status.
              </p>
            </div>
          ) : (
            /* Idle landing prompt */
            <div className="rounded-2xl border border-surface-border bg-surface p-12 text-center flex-1 flex flex-col justify-center items-center">
              <Sparkles size={32} className="text-accent-purple mb-4 animate-pulse" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Awaiting Inquiry</h3>
              <p className="text-xs text-text-secondary mt-2 max-w-xs leading-relaxed">
                Enter queries above to scan indexed documents. We parse concepts and locate matching paragraphs instantly.
              </p>
            </div>
          )}
        </div>

        {/* Right Pane (Live Preview Panel) */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-surface-border bg-surface p-6 h-full flex flex-col justify-between shadow-[0_4px_25px_rgba(0,0,0,0.3)] sticky top-6">
            {selectedResult ? (
              <div className="flex flex-col justify-between h-full space-y-6">
                
                {/* Meta details */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-text-secondary flex-shrink-0" />
                      <h3 className="text-xs font-bold text-text-primary leading-snug line-clamp-2">
                        {selectedResult.documentTitle}
                      </h3>
                    </div>

                    <span className={`badge ${selectedResult.fileType === 'PDF' ? 'badge-failed' : 'badge-processing'} flex-shrink-0`}>
                      {selectedResult.fileType}
                    </span>
                  </div>

                  {/* Similarity metric gauge */}
                  <div className="p-3 bg-background-elevated rounded-xl border border-surface-border flex items-center justify-between text-xs">
                    <span className="text-text-secondary flex items-center gap-1">
                      <Info size={12} className="text-text-muted" /> Matches Relevance
                    </span>
                    <span className="font-mono font-bold text-accent-teal">
                      {(selectedResult.score * 100).toFixed(0)}% Score
                    </span>
                  </div>
                </div>

                {/* Content reading block */}
                <div className="flex-1 overflow-y-auto bg-background-elevated p-4 rounded-xl border border-surface-border max-h-[300px]">
                  <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap font-sans">
                    {highlightText(selectedResult.chunkContent, submittedQuery)}
                  </p>
                </div>

                {/* Bottom detail descriptors */}
                <div className="space-y-4 pt-4 border-t border-surface-border">
                  <div className="flex items-center justify-between text-[11px] text-text-secondary">
                    <span>Target Page:</span>
                    <span className="font-bold text-text-primary">
                      {selectedResult.pageNumber ? `Page ${selectedResult.pageNumber}` : 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-text-secondary">
                    <span>Heading Path:</span>
                    <span className="font-bold text-text-primary truncate max-w-[200px]">
                      {selectedResult.headingContext || 'Top Level'}
                    </span>
                  </div>

                  {/* Tags */}
                  {selectedResult.tags.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                        Assigned Clusters
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedResult.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded border"
                            style={{
                              backgroundColor: `${tag.color || '#6366f1'}08`,
                              borderColor: `${tag.color || '#6366f1'}20`,
                              color: tag.color || '#6366f1',
                            }}
                          >
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions CTA */}
                  {selectedResult.driveFileUrl && (
                    <button
                      onClick={() => window.open(selectedResult.driveFileUrl!, '_blank')}
                      className="btn-google w-full justify-center py-2.5 rounded-lg border border-surface-border hover:bg-surface-hover cursor-pointer"
                    >
                      <span className="text-[11px] font-bold">Open File in Google Drive</span>
                      <ExternalLink size={12} className="text-text-muted" />
                    </button>
                  )}
                </div>

              </div>
            ) : (
              /* Awaiting Selection placeholder */
              <div className="flex-1 flex flex-col justify-center items-center text-center p-6">
                <FileText size={28} className="text-text-muted mb-3" />
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Preview Terminal</h4>
                <p className="text-[11px] text-text-secondary mt-1.5 max-w-[200px] leading-relaxed">
                  Select a matching segment on the left to read context parameters.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* HELPER ROW CARD FOR SEARCH RESULTS */

function ResultRowCard({
  result,
  query,
  isSelected,
  onSelect,
}: {
  result: SearchResult;
  query: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`rounded-xl p-4.5 border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'bg-surface-hover border-accent-teal shadow-[0_4px_12px_rgba(0,0,0,0.4)]'
          : 'bg-surface border-surface-border hover:border-text-muted'
      }`}
    >
      <div className="flex items-start gap-3 justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-text-muted flex-shrink-0" />
          <span className="text-xs font-bold text-text-primary truncate">
            {result.documentTitle}
          </span>
        </div>

        <span className="text-[10px] font-mono font-bold text-accent-teal bg-accent-teal/5 border border-accent-teal/15 px-1.5 py-0.25 rounded">
          {(result.score * 100).toFixed(0)}%
        </span>
      </div>

      <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-3">
        {highlightText(result.chunkContent, query)}
      </p>

      <div className="flex items-center justify-between text-[10px] text-text-muted">
        <span>{result.pageNumber ? `Page ${result.pageNumber}` : 'Top Context'}</span>
        <span className="truncate max-w-[150px] font-semibold">
          {result.headingContext || 'Root Context'}
        </span>
      </div>
    </div>
  );
}

/* TEXT HIGHLIGHT HELPER */

function highlightText(text: string, q: string) {
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark
        key={i}
        className="bg-accent-teal/20 text-text-primary px-0.5 rounded"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}
