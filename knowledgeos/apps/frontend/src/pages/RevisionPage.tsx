// apps/frontend/src/pages/RevisionPage.tsx
/**
 * Redesigned Spaced Repetition / Revision Page.
 * Implements interactive Y-axis CSS 3D flashcard flip structures.
 * Features rating buttons, weekly goal progress trackers, and detailed learning statistics.
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
  HelpCircle,
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
  { value: 0, label: 'Forgot', icon: <XCircle size={14} />, color: '#ef4444' },
  { value: 1, label: 'Wrong', icon: <XCircle size={14} />, color: '#f43f5e' },
  { value: 2, label: 'Hard', icon: <AlertTriangle size={14} />, color: '#d97706' },
  { value: 3, label: 'Hesitant', icon: <RotateCcw size={14} />, color: '#eab308' },
  { value: 4, label: 'Good', icon: <CheckCircle2 size={14} />, color: '#10b981' },
  { value: 5, label: 'Perfect', icon: <Sparkles size={14} />, color: '#0ea5e9' },
];

export function RevisionPage() {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Fetch items due
  const { data: dueData, isLoading: isDueLoading } = useQuery<{ items: RevisionItem[]; totalDue: number }>({
    queryKey: ['revision-due'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: RevisionItem[]; totalDue: number } }>('/api/revision/due');
      return res.data.data;
    },
  });

  // Fetch user learning statistics
  const { data: stats } = useQuery<RevisionStats>({
    queryKey: ['revision-stats'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: RevisionStats }>('/api/revision/stats');
      return res.data.data;
    },
  });

  // Quality response mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ itemId, quality }: { itemId: string; quality: number }) => {
      const res = await api.post('/api/revision/review', { itemId, quality });
      return res.data;
    },
    onSuccess: () => {
      setReviewedCount(c => c + 1);
      setShowAnswer(false);

      if (dueData && currentIndex < dueData.items.length - 1) {
        // Delay index increment briefly to allow flip animation to reset
        setTimeout(() => {
          setCurrentIndex(i => i + 1);
        }, 150);
      } else {
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
    <div className="animate-fade-in space-y-6 select-none">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-text-primary uppercase tracking-wider">
          Revision Deck
        </h1>
        <p className="text-xs text-text-secondary mt-1">
          Lock in concepts from your documents. Optimized with SM-2 spaced repetition algorithms.
        </p>
      </div>

      {/* Main content grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Left main area: Review Flashcard */}
        <div className="lg:col-span-3 space-y-6">
          {isDueLoading ? (
            <div className="rounded-xl border border-surface-border bg-surface p-12 text-center h-80 flex flex-col justify-center items-center">
              <div className="skeleton h-8 w-1/3 mb-4" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ) : currentItem ? (
            <div className="space-y-6">
              
              {/* Progress counter */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-surface-border overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-purple to-accent-teal transition-all duration-300"
                    style={{
                      width: `${totalDue > 0 ? (reviewedCount / totalDue) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-text-secondary font-bold">
                  {reviewedCount}/{totalDue} Cards Reviewed
                </span>
              </div>

              {/* 3D Flip Card Widget */}
              <div className="flip-card-container w-full h-[320px]">
                <div
                  onClick={() => setShowAnswer(!showAnswer)}
                  className={`flip-card-inner w-full h-full cursor-pointer rounded-2xl ${
                    showAnswer ? 'flip-card-flipped' : ''
                  }`}
                >
                  
                  {/* FRONT SIDE FACE */}
                  <div className="flip-card-front w-full h-full p-8 border border-surface-border bg-surface flex flex-col justify-between items-center text-center shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
                    {/* Header Doc badge */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-accent-purple/20 bg-accent-purple/5 text-accent-purple text-[10px] font-bold uppercase tracking-wider">
                      <FileText size={11} />
                      <span className="truncate max-w-[200px]">{currentItem.document.title}</span>
                    </div>

                    {/* Topic text */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-extrabold text-accent-teal tracking-widest uppercase block">
                        Review Topic
                      </span>
                      <h2 className="text-xl font-extrabold tracking-tight text-text-primary max-w-md font-sans">
                        {currentItem.topicName}
                      </h2>
                    </div>

                    {/* Instructions footer */}
                    <div className="text-[10px] text-text-muted flex items-center gap-1">
                      <HelpCircle size={12} /> Click card to flip and inspect explanation
                    </div>
                  </div>

                  {/* BACK SIDE FACE */}
                  <div className="flip-card-back w-full h-full p-8 border border-surface-border bg-surface-hover flex flex-col justify-between items-center text-center shadow-[0_4px_35px_rgba(0,0,0,0.5)]">
                    {/* Header */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-accent-teal/20 bg-accent-teal/5 text-accent-teal text-[10px] font-bold uppercase tracking-wider">
                      <CheckCircle2 size={11} /> Explanatory Context
                    </div>

                    {/* Document summary */}
                    <div className="max-w-xl overflow-y-auto max-h-36 pr-1">
                      <p className="text-xs text-text-secondary leading-relaxed font-sans">
                        {currentItem.document.summary || 'Summary unavailable. Re-run indexing on the origin file.'}
                      </p>
                    </div>

                    {/* Sm-2 metrics metadata */}
                    <div className="flex items-center gap-5 text-[10px] text-text-muted font-mono border-t border-surface-border/50 pt-3 w-full justify-center">
                      <span>Reps: <strong className="text-text-secondary">{currentItem.repetitionCount}</strong></span>
                      <span>Interval: <strong className="text-text-secondary">{currentItem.intervalDays}d</strong></span>
                      <span>Factor: <strong className="text-text-secondary">{currentItem.easeFactor.toFixed(2)}</strong></span>
                    </div>
                  </div>

                </div>
              </div>

              {/* SM-2 Quality Rating buttons (displayed always or when flipped) */}
              <div className={`transition-all duration-300 ${showAnswer ? 'opacity-100 translate-y-0' : 'opacity-30 pointer-events-none'}`}>
                <p className="text-[10px] text-center text-text-muted font-bold uppercase tracking-wider mb-3.5">
                  Verify Recall Strength
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-w-xl mx-auto">
                  {QUALITY_BUTTONS.map(btn => (
                    <button
                      key={btn.value}
                      onClick={() => handleRate(btn.value)}
                      disabled={reviewMutation.isPending}
                      className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border border-surface-border bg-surface hover:bg-surface-hover hover:border-text-muted transition-all duration-200 hover:translate-y-[-1.5px] cursor-pointer"
                      style={{ color: btn.color }}
                    >
                      {btn.icon}
                      <span className="text-[10px] font-bold">{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            /* Catch up interface */
            <div className="rounded-2xl border border-surface-border bg-surface p-12 text-center h-80 flex flex-col justify-center items-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-success/10 border border-success/20 text-success mb-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <GraduationCap size={22} />
              </div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                Deck Catch-Up Completed
              </h3>
              <p className="text-xs text-text-secondary mt-2 max-w-sm leading-relaxed">
                {reviewedCount > 0
                  ? `Excellent progress! You finished reviewing ${reviewedCount} study units today.`
                  : 'All catch up complete. Add files or tag topics to extend study repetitions.'}
              </p>
            </div>
          )}
        </div>

        {/* Right Pane: Statistics dashboards */}
        <div className="flex flex-col gap-4">
          <LearningStatCard
            icon={<Clock size={16} />}
            label="Due Review Now"
            value={stats?.dueNow ?? 0}
            color="text-accent-teal"
            bgColor="bg-accent-teal/5"
            borderColor="border-accent-teal/15"
          />
          <LearningStatCard
            icon={<Target size={16} />}
            label="Scheduled This Week"
            value={stats?.dueThisWeek ?? 0}
            color="text-accent-purple"
            bgColor="bg-accent-purple/5"
            borderColor="border-accent-purple/15"
          />
          <LearningStatCard
            icon={<Brain size={16} />}
            label="Mastered Chapters"
            value={stats?.masteredItems ?? 0}
            color="text-accent-amber"
            bgColor="bg-accent-amber/5"
            borderColor="border-accent-amber/15"
          />
          <LearningStatCard
            icon={<TrendingUp size={16} />}
            label="Memory Retention Rate"
            value={`${stats?.retentionRate ?? 0}%`}
            color="text-success"
            bgColor="bg-success/5"
            borderColor="border-success/15"
          />
        </div>

      </div>
    </div>
  );
}

/* STUDY STATS CARD */

function LearningStatCard({
  icon,
  label,
  value,
  color,
  bgColor,
  borderColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface p-4 flex items-center justify-between shadow-sm">
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
          {label}
        </span>
        <span className="text-xl font-extrabold text-text-primary tracking-tight font-mono block">
          {value}
        </span>
      </div>

      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${color} ${bgColor} ${borderColor}`}>
        {icon}
      </div>
    </div>
  );
}
