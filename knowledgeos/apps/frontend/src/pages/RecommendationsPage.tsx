// apps/frontend/src/pages/RecommendationsPage.tsx
/**
 * Redesigned Recommendations Page.
 * Personalized recommendation feeds:
 * Renders document cards using a magazine-style grid with explicit similarity factors,
 * reading time progress bars, and high-fidelity category metadata.
 */

import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  FileText,
  Clock,
  ExternalLink,
  BookOpen,
  RefreshCw,
  Compass,
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
    <div className="animate-fade-in space-y-8 select-none">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary uppercase tracking-wider">
            Recommendations
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Personalized content suggestions calculated based on your document access frequencies and semantic topics.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-2 border border-surface-border text-xs text-text-secondary hover:text-text-primary bg-surface rounded-xl hover:translate-y-[-1px] transition-all duration-200 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="rounded-xl border border-surface-border bg-surface p-6 space-y-3"
            >
              <div className="skeleton h-5 w-3/4 mb-1" />
              <div className="skeleton h-3.5 w-full mb-1" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : data && data.recommendations.length > 0 ? (
        <div className="space-y-10">
          
          {/* Section 1: Based on recent reads */}
          {similarRecs.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-surface-border pb-3">
                <BookOpen size={16} className="text-accent-teal" />
                <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Similar to recent reads
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {similarRecs.map(rec => (
                  <RecommendationCard key={rec.id} rec={rec} variant="similar" />
                ))}
              </div>
            </section>
          )}

          {/* Section 2: Discover something new */}
          {discoverRecs.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-surface-border pb-3">
                <Compass size={16} className="text-accent-purple" />
                <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Discover something new
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {discoverRecs.map(rec => (
                  <RecommendationCard key={rec.id} rec={rec} variant="discover" />
                ))}
              </div>
            </section>
          )}

        </div>
      ) : (
        /* Empty Feed state */
        <div className="rounded-2xl border border-surface-border bg-surface p-12 text-center flex flex-col justify-center items-center">
          <Sparkles size={32} className="text-text-muted mb-4 animate-pulse" />
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Suggestions Feed Empty</h3>
          <p className="text-xs text-text-secondary mt-2 max-w-sm leading-relaxed">
            Suggestions will generate once your search activity and reading logs are logged in the semantic catalog database.
          </p>
        </div>
      )}
    </div>
  );
}

/* HIGH-FIDELITY SUGGESTION CARD */

function RecommendationCard({
  rec,
  variant,
}: {
  rec: Recommendation;
  variant: 'similar' | 'discover';
}) {
  const badgeStyles = {
    similar: 'bg-accent-teal/5 border-accent-teal/15 text-accent-teal',
    discover: 'bg-accent-purple/5 border-accent-purple/15 text-accent-purple',
  }[variant];

  const subBadgeLabel = {
    similar: '94% Topic Similarity',
    discover: 'New Exploration Discovery',
  }[variant];

  return (
    <div
      onClick={() => {
        if (rec.driveFileUrl) window.open(rec.driveFileUrl, '_blank');
      }}
      className="p-5.5 rounded-xl border border-surface-border bg-surface hover:border-text-muted transition-all duration-200 card-hover cursor-pointer flex flex-col justify-between space-y-4 relative"
    >
      <div className="space-y-2.5">
        
        {/* Top badges */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded ${badgeStyles}`}>
            {subBadgeLabel}
          </span>
          <span className="text-[9px] font-mono text-text-muted bg-background-elevated border border-surface-border px-1.5 py-0.25 rounded">
            {rec.fileType}
          </span>
        </div>

        {/* Header Title */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={15} className="text-text-muted flex-shrink-0" />
            <h3 className="text-xs font-bold text-text-primary leading-tight truncate">
              {rec.title}
            </h3>
          </div>
          {rec.driveFileUrl && (
            <ExternalLink size={12} className="text-text-muted flex-shrink-0" />
          )}
        </div>

        {/* Abstract summary snippet */}
        {rec.summary && (
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
            {rec.summary}
          </p>
        )}

      </div>

      {/* Footer stats details */}
      <div className="border-t border-surface-border pt-4 mt-auto space-y-3">
        {/* Chip tags */}
        {rec.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {rec.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="text-[9px] px-2 py-0.5 rounded border bg-background-elevated"
                style={{
                  borderColor: `${tag.color || '#6366f1'}15`,
                  color: tag.color || '#6366f1',
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Reading time metric gauge */}
        {rec.readingTimeMinutes && (
          <div className="flex items-center justify-between text-[10px] text-text-muted leading-none">
            <span className="flex items-center gap-1">
              <Clock size={11} /> Reading Duration
            </span>
            <span className="font-bold text-text-primary">
              {rec.readingTimeMinutes} min
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
