// apps/frontend/src/pages/RecommendationsPage.tsx
/**
 * RecommendationsPage — Premium Personalized Content Suggestions Feed.
 * Divides recommendations into Similar Reads and Discoveries based on real usage.
 */

import { useQuery } from '@tanstack/react-query';
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
  // ─── Query: Recommendations Feed ───
  const { data, isLoading, refetch, isFetching } = useQuery<RecommendationResponse>({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: RecommendationResponse }>('/api/recommendations');
      return res.data.data;
    },
  });

  const similarRecs = data?.recommendations.filter((r) => r.reason === 'Similar to your recent reads') ?? [];
  const discoverRecs = data?.recommendations.filter((r) => r.reason === 'Discover something new') ?? [];

  return (
    <div className="animate-fade-in space-y-8 select-none max-w-5xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex justify-between items-end flex-wrap gap-md">
        <div>
          <h2 className="font-display-lg text-headline-lg text-on-surface">Recommendations</h2>
          <p className="text-on-surface-variant mt-xs text-xs">Suggested content matching your search profiles and access logs.</p>
        </div>

        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-xs px-4 py-2 bg-surface-container border border-outline-variant hover:bg-surface-bright rounded-lg text-label-sm text-xs cursor-pointer font-bold disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[18px] ${isFetching ? 'animate-spin' : ''}`}>refresh</span>
          <span>Refresh Feed</span>
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-44 rounded-xl" />
          ))}
        </div>
      ) : data && data.recommendations.length > 0 ? (
        <div className="space-y-10">
          {/* Section 1: Similar Reads */}
          {similarRecs.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
                <span className="material-symbols-outlined text-secondary text-[20px]">menu_book</span>
                <h3 className="font-headline-lg text-sm font-semibold text-on-surface uppercase tracking-wider">
                  Similar to recent reads
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {similarRecs.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} variant="similar" />
                ))}
              </div>
            </section>
          )}

          {/* Section 2: Discovery Topics */}
          {discoverRecs.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
                <span className="material-symbols-outlined text-primary text-[20px]">explore</span>
                <h3 className="font-headline-lg text-sm font-semibold text-on-surface uppercase tracking-wider">
                  Discover something new
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {discoverRecs.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} variant="discover" />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-outline-variant bg-surface/50 p-12 text-center flex flex-col justify-center items-center">
          <span className="material-symbols-outlined text-primary text-4xl mb-4 animate-pulse">sparkles</span>
          <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Empty Suggestions Feed</h3>
          <p className="text-xs text-on-surface-variant mt-2 max-w-sm leading-relaxed">
            Content suggestions generate dynamically as you search and read indexed documents.
          </p>
        </div>
      )}
    </div>
  );
}

/* RECOMMENDATION CARD COMPONENT */

function RecommendationCard({
  rec,
  variant,
}: {
  rec: Recommendation;
  variant: 'similar' | 'discover';
}) {
  const badgeStyles = {
    similar: 'bg-secondary/10 border-secondary/20 text-secondary',
    discover: 'bg-primary/10 border-primary/20 text-primary',
  }[variant];

  const subBadgeLabel = {
    similar: 'Topic Match Found',
    discover: 'Explore New Concept',
  }[variant];

  return (
    <div
      onClick={() => {
        if (rec.driveFileUrl) window.open(rec.driveFileUrl, '_blank');
      }}
      className="p-5 rounded-xl border border-outline-variant bg-surface-container hover:bg-surface-container-high transition-all duration-200 card-hover cursor-pointer flex flex-col justify-between space-y-4 text-xs"
    >
      <div className="space-y-3">
        {/* Top Badges row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded ${badgeStyles}`}>
            {subBadgeLabel}
          </span>
          <span className="text-[9px] font-mono text-on-surface-variant bg-surface-container-lowest border border-outline-variant px-1.5 py-0.5 rounded font-bold uppercase">
            {rec.fileType}
          </span>
        </div>

        {/* Title */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">description</span>
            <h3 className="text-xs font-semibold text-on-surface leading-tight truncate">
              {rec.title}
            </h3>
          </div>
          {rec.driveFileUrl && (
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">open_in_new</span>
          )}
        </div>

        {/* Summary excerpt */}
        {rec.summary && (
          <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 font-sans">
            {rec.summary}
          </p>
        )}
      </div>

      {/* Footer information */}
      <div className="border-t border-outline-variant/30 pt-3 mt-auto space-y-2">
        {/* Tag chips */}
        {rec.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {rec.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="text-[9px] px-2 py-0.5 rounded border bg-surface-container-lowest text-on-surface-variant font-bold"
                style={{
                  borderColor: `${tag.color || '#c3c0ff'}15`,
                  color: tag.color || '#c3c0ff',
                }}
              >
                {tag.name.toUpperCase()}
              </span>
            ))}
          </div>
        )}

        {/* Reading Time */}
        {rec.readingTimeMinutes && (
          <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-mono">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              <span>Reading duration</span>
            </span>
            <span className="font-semibold text-on-surface font-mono">{rec.readingTimeMinutes} min</span>
          </div>
        )}
      </div>
    </div>
  );
}
