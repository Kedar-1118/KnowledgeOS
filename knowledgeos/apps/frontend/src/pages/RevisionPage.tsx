// apps/frontend/src/pages/RevisionPage.tsx
/**
 * Spaced Repetition / Revision Page
 *
 * Features:
 * - Card-based review interface showing topic + document context
 * - SM-2 quality rating buttons (0-5)
 * - Progress bar showing items reviewed vs due
 * - Stats sidebar (due today, mastered, retention rate)
 * - Empty state when all caught up
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Brain,
  Clock,
  Target,
  TrendingUp,
  FileText,
  ChevronRight,
} from 'lucide-react';

import { api } from '../lib/api';

interface RevisionItem {
  id: string;
  topicName: string;
  easeFactor: number;
  intervalDays: number;
  repetitionCount: number;
  nextReviewAt: string;
  document: {
    id: string;
    title: string;
    fileType: string;
    summary: string | null;
  };
}

interface RevisionStats {
  totalItems: number;
  dueNow: number;
  dueThisWeek: number;
  masteredItems: number;
  averageEaseFactor: number;
  retentionRate: number;
}

const QUALITY_BUTTONS = [
  { value: 0, label: 'Blackout', icon: <XCircle size={16} />, color: '#E05F5F' },
  { value: 1, label: 'Wrong', icon: <XCircle size={16} />, color: '#E07F5F' },
  { value: 2, label: 'Hard', icon: <AlertTriangle size={16} />, color: '#BA7517' },
  { value: 3, label: 'OK', icon: <RotateCcw size={16} />, color: '#E0A85F' },
  { value: 4, label: 'Good', icon: <CheckCircle2 size={16} />, color: '#1D9E75' },
  { value: 5, label: 'Perfect', icon: <Sparkles size={16} />, color: '#5FC3E0' },
];

export function RevisionPage() {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Fetch due items
  const { data: dueData, isLoading: isDueLoading } = useQuery<{ items: RevisionItem[]; totalDue: number }>({
    queryKey: ['revision-due'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: RevisionItem[]; totalDue: number } }>('/api/revision/due');
      return res.data.data;
    },
  });

  // Fetch stats
  const { data: stats } = useQuery<RevisionStats>({
    queryKey: ['revision-stats'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: RevisionStats }>('/api/revision/stats');
      return res.data.data;
    },
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ itemId, quality }: { itemId: string; quality: number }) => {
      const res = await api.post('/api/revision/review', { itemId, quality });
      return res.data;
    },
    onSuccess: () => {
      setReviewedCount(c => c + 1);
      setShowAnswer(false);

      // Move to next item
      if (dueData && currentIndex < dueData.items.length - 1) {
        setCurrentIndex(i => i + 1);
      } else {
        // All done — refetch
        void queryClient.invalidateQueries({ queryKey: ['revision-due'] });
        void queryClient.invalidateQueries({ queryKey: ['revision-stats'] });
        setCurrentIndex(0);
      }
    },
  });

  const currentItem = dueData?.items[currentIndex] ?? null;
  const totalDue = dueData?.totalDue ?? 0;

  const handleRate = useCallback((quality: number) => {
    if (!currentItem) return;
    reviewMutation.mutate({ itemId: currentItem.id, quality });
  }, [currentItem, reviewMutation]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Revision
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Spaced repetition for long-term knowledge retention
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main review area */}
        <div className="lg:col-span-3">
          {isDueLoading ? (
            <div
              className="rounded-xl p-8"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-surface-border)' }}
            >
              <div className="skeleton h-8 w-1/2 mx-auto mb-4" />
              <div className="skeleton h-4 w-3/4 mx-auto mb-2" />
              <div className="skeleton h-4 w-2/3 mx-auto" />
            </div>
          ) : currentItem ? (
            <>
              {/* Progress bar */}
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${totalDue > 0 ? (reviewedCount / totalDue) * 100 : 0}%`,
                      background: 'linear-gradient(90deg, var(--color-accent-teal), var(--color-accent-purple))',
                    }}
                  />
                </div>
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {reviewedCount}/{totalDue}
                </span>
              </div>

              {/* Review Card */}
              <div
                className="rounded-xl p-8 min-h-[300px] flex flex-col items-center justify-center cursor-pointer card-hover"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: `1px solid ${showAnswer ? 'rgba(29,158,117,0.3)' : 'var(--color-surface-border)'}`,
                }}
                onClick={() => setShowAnswer(!showAnswer)}
              >
                {/* Source document badge */}
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={14} style={{ color: 'var(--color-accent-purple)' }} />
                  <span
                    className="text-xs px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: 'rgba(127,119,221,0.1)',
                      color: 'var(--color-accent-purple)',
                    }}
                  >
                    {currentItem.document.title}
                  </span>
                </div>

                {/* Topic */}
                <div className="text-center max-w-lg">
                  <span className="text-xs font-medium mb-3 block" style={{ color: 'var(--color-accent-teal)' }}>
                    TOPIC
                  </span>
                  <p className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                    {currentItem.topicName}
                  </p>

                  {!showAnswer ? (
                    <>
                      <p className="text-sm mt-4" style={{ color: 'var(--color-text-muted)' }}>
                        How well can you recall this topic?
                      </p>
                      <div className="flex items-center gap-1 mt-2 justify-center" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="text-xs">Click to reveal context</span>
                        <ChevronRight size={12} />
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-medium mb-2 mt-4 block" style={{ color: 'var(--color-accent-purple)' }}>
                        DOCUMENT SUMMARY
                      </span>
                      <p
                        className="text-sm"
                        style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}
                      >
                        {currentItem.document.summary ?? 'No summary available for this document.'}
                      </p>
                    </>
                  )}
                </div>

                {/* Repetition info */}
                <div className="flex items-center gap-4 mt-6">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Reps: {currentItem.repetitionCount}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Interval: {currentItem.intervalDays}d
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    EF: {currentItem.easeFactor.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Rating buttons (shown when answer revealed) */}
              {showAnswer && (
                <div className="mt-4">
                  <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
                    How well did you know this?
                  </p>
                  <div className="flex justify-center gap-2">
                    {QUALITY_BUTTONS.map(btn => (
                      <button
                        key={btn.value}
                        onClick={() => handleRate(btn.value)}
                        disabled={reviewMutation.isPending}
                        className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-surface-border)',
                          color: btn.color,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${btn.color}15`;
                          e.currentTarget.style.borderColor = `${btn.color}40`;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                          e.currentTarget.style.borderColor = 'var(--color-surface-border)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {btn.icon}
                        <span className="text-xs font-medium">{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* All caught up! */
            <div
              className="rounded-xl p-8 text-center"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-surface-border)',
              }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(29,158,117,0.15), rgba(127,119,221,0.15))',
                }}
              >
                <GraduationCap size={28} style={{ color: 'var(--color-accent-teal)' }} />
              </div>
              <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                {reviewedCount > 0 ? 'All caught up!' : 'No reviews due'}
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {reviewedCount > 0
                  ? `Great work! You reviewed ${reviewedCount} item${reviewedCount !== 1 ? 's' : ''} today.`
                  : 'Create revision items from your documents to start practicing.'}
              </p>
            </div>
          )}
        </div>

        {/* Stats sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <StatCard
            icon={<Clock size={18} />}
            label="Due Now"
            value={stats?.dueNow ?? 0}
            color="var(--color-accent-teal)"
          />
          <StatCard
            icon={<Target size={18} />}
            label="Due This Week"
            value={stats?.dueThisWeek ?? 0}
            color="var(--color-accent-purple)"
          />
          <StatCard
            icon={<Brain size={18} />}
            label="Mastered"
            value={stats?.masteredItems ?? 0}
            color="var(--color-accent-amber)"
          />
          <StatCard
            icon={<TrendingUp size={18} />}
            label="Retention"
            value={`${stats?.retentionRate ?? 0}%`}
            color="var(--color-success)"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-surface-border)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
      </div>
      <span
        className="text-xl font-semibold"
        style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </span>
    </div>
  );
}
