// apps/frontend/src/pages/SearchPage.tsx
/**
 * Semantic Search Page
 *
 * Features:
 * - Large centered search bar with ⌘K shortcut
 * - Recent searches from localStorage
 * - Results with highlighted matching text, tags, score bars
 * - Filters sidebar (tag, file type, date range)
 * - Skeleton loading states
 * - Empty state
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  FileText,
  Filter,
  X,
  Clock,
  ChevronRight,
  Sparkles,
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

  // Search query
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
    }
  }, []);

  const recentSearches = getRecentSearches();

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      {/* Search Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-semibold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Search
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Semantic search across all your indexed documents
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div
          className="flex items-center gap-3 px-5 py-4 rounded-xl transition-all duration-200"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: `1px solid ${showRecent ? 'var(--color-accent-teal)' : 'var(--color-surface-border)'}`,
          }}
        >
          <Search size={20} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
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
            placeholder="Search your knowledge..."
            className="flex-1 bg-transparent border-none outline-none text-base"
            style={{ color: 'var(--color-text-primary)' }}
            autoFocus
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setSubmittedQuery(''); }}
              className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X size={16} />
            </button>
          )}
          <kbd
            className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-surface-border)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            ⌘K
          </kbd>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 rounded-lg transition-colors"
            style={{
              color: showFilters ? 'var(--color-accent-teal)' : 'var(--color-text-muted)',
              backgroundColor: showFilters ? 'rgba(29,158,117,0.1)' : 'transparent',
            }}
          >
            <Filter size={18} />
          </button>
        </div>

        {/* Recent Searches Dropdown */}
        {showRecent && !submittedQuery && recentSearches.length > 0 && (
          <div
            className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-20"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-surface-border)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
            }}
          >
            <div className="px-4 py-2.5">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                Recent searches
              </span>
            </div>
            {recentSearches.map((recent, i) => (
              <button
                key={i}
                onClick={() => { setQuery(recent); handleSubmit(recent); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-sm flex-1">{recent}</span>
                <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading || isFetching ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="rounded-xl p-5"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-surface-border)',
              }}
            >
              <div className="skeleton h-5 w-3/4 mb-3" />
              <div className="skeleton h-3 w-full mb-2" />
              <div className="skeleton h-3 w-5/6 mb-3" />
              <div className="flex gap-2">
                <div className="skeleton h-5 w-16 rounded-full" />
                <div className="skeleton h-5 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : data && data.results.length > 0 ? (
        <div>
          {/* Results count + time */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {data.totalCount} result{data.totalCount !== 1 ? 's' : ''} for &ldquo;{submittedQuery}&rdquo;
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {data.queryTimeMs.toFixed(0)}ms
            </span>
          </div>

          {/* Result Cards */}
          <div className="flex flex-col gap-3">
            {data.results.map((result, idx) => (
              <SearchResultCard key={`${result.documentId}-${idx}`} result={result} query={submittedQuery} />
            ))}
          </div>
        </div>
      ) : submittedQuery ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-surface-border)',
          }}
        >
          <Search size={40} style={{ color: 'var(--color-text-muted)', margin: '0 auto 16px' }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            No results found
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Try rephrasing your query or check that your Drive folder has indexed files.
          </p>
        </div>
      ) : (
        /* Initial empty state — tips */
        <div className="flex flex-col items-center pt-8">
          <Sparkles size={40} style={{ color: 'var(--color-accent-purple)', marginBottom: 16 }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Semantic Search
          </h3>
          <p
            className="text-sm text-center max-w-md"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Search using natural language. Try questions like &ldquo;how does backpropagation work&rdquo;
            or &ldquo;explain mutex vs semaphore&rdquo;.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Search Result Card ───

function SearchResultCard({ result, query }: { result: SearchResult; query: string }) {
  const highlightText = (text: string, q: string) => {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark
          key={i}
          style={{
            backgroundColor: 'rgba(29, 158, 117, 0.25)',
            color: 'var(--color-text-primary)',
            padding: '0 2px',
            borderRadius: '2px',
          }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const fileTypeBadgeColor = {
    PDF: '#E05F5F',
    TXT: '#5FC3E0',
    MD: '#7F77DD',
    IMAGE: '#BA7517',
    VIDEO: '#1D9E75',
    OTHER: '#888780',
  }[result.fileType] ?? '#888780';

  return (
    <div
      className="rounded-xl p-5 card-hover cursor-pointer"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-surface-border)',
      }}
      onClick={() => {
        if (result.driveFileUrl) {
          window.open(result.driveFileUrl, '_blank');
        }
      }}
    >
      {/* Title row */}
      <div className="flex items-center gap-2.5 mb-2">
        <FileText size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        <h3 className="text-sm font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          {result.documentTitle}
        </h3>
        <span
          className="badge"
          style={{
            backgroundColor: `${fileTypeBadgeColor}15`,
            color: fileTypeBadgeColor,
          }}
        >
          {result.fileType}
        </span>
      </div>

      {/* Chunk content with highlighting */}
      <p
        className="text-sm mb-3 line-clamp-3"
        style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}
      >
        {highlightText(result.chunkContent, query)}
      </p>

      {/* Meta row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Page/heading context */}
          {(result.pageNumber ?? result.headingContext) && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: 'var(--color-text-muted)',
              }}
            >
              {result.pageNumber ? `Page ${result.pageNumber}` : ''}
              {result.pageNumber && result.headingContext ? ' · ' : ''}
              {result.headingContext ?? ''}
            </span>
          )}

          {/* Tags */}
          {result.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${tag.color}15`,
                color: tag.color,
              }}
            >
              {tag.label}
            </span>
          ))}
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-2">
          <div
            className="w-16 h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, result.score * 100)}%`,
                background: result.score > 0.7
                  ? 'var(--color-accent-teal)'
                  : result.score > 0.4
                    ? 'var(--color-accent-amber)'
                    : 'var(--color-text-muted)',
              }}
            />
          </div>
          <span
            className="text-xs"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {(result.score * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}
