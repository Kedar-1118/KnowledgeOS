// apps/frontend/src/pages/RecommendationsPage.tsx
/**
 * Recommendations Page — Personalized document recommendations.
 *
 * Shows two sections:
 * 1. "Similar to your recent reads" — tag-similarity based
 * 2. "Discover something new" — least-accessed documents
 */

import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  FileText,
  Clock,
  ExternalLink,
  BookOpen,
  RefreshCw,
} from 'lucide-react';

import { api } from '../lib/api';

interface Recommendation {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  summary: string | null;
  readingTimeMinutes: number | null;
  accessCount: number;
  driveFileUrl: string | null;
  reason: string;
  tags: Array<{
    name: string;
    category: string | null;
    color: string;
    confidence: number;
  }>;
}

interface RecommendationResponse {
  recommendations: Recommendation[];
  totalCount: number;
}

export function RecommendationsPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<RecommendationResponse>({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: RecommendationResponse }>('/api/recommendations');
      return res.data.data;
    },
  });

  const similarRecs = data?.recommendations.filter(r => r.reason === 'Similar to your recent reads') ?? [];
  const discoverRecs = data?.recommendations.filter(r => r.reason === 'Discover something new') ?? [];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Recommendations
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Personalized suggestions based on your reading activity
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="btn-primary"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="skeleton h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : data && data.recommendations.length > 0 ? (
        <>
          {/* Similar to recent reads */}
          {similarRecs.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={18} style={{ color: 'var(--color-accent-teal)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Based on your recent reads
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {similarRecs.map(rec => (
                  <RecommendationCard key={rec.id} rec={rec} />
                ))}
              </div>
            </section>
          )}

          {/* Discover something new */}
          {discoverRecs.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} style={{ color: 'var(--color-accent-purple)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Discover something new
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {discoverRecs.map(rec => (
                  <RecommendationCard key={rec.id} rec={rec} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div
          className="rounded-xl p-8 text-center"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-surface-border)',
          }}
        >
          <Sparkles size={40} style={{ color: 'var(--color-text-muted)', margin: '0 auto 16px' }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            No recommendations yet
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Start reading and searching your documents to get personalized recommendations.
          </p>
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <div
      className="rounded-xl p-5 card-hover cursor-pointer"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-surface-border)',
      }}
      onClick={() => {
        if (rec.driveFileUrl) window.open(rec.driveFileUrl, '_blank');
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={16} style={{ color: 'var(--color-text-muted)' }} />
          <h3
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {rec.title}
          </h3>
        </div>
        {rec.driveFileUrl && (
          <ExternalLink size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        )}
      </div>

      {rec.summary && (
        <p
          className="text-xs mb-3 line-clamp-2"
          style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}
        >
          {rec.summary}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {rec.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
        {rec.readingTimeMinutes && (
          <span
            className="text-xs flex items-center gap-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Clock size={11} /> {rec.readingTimeMinutes} min
          </span>
        )}
      </div>
    </div>
  );
}
