import React, { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

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

const recallButtons = [
  { val: 0, label: '0', hoverColor: 'hover:bg-red-500/20 hover:border-red-500/50' },
  { val: 1, label: '1', hoverColor: 'hover:bg-orange-500/20 hover:border-orange-500/50' },
  { val: 2, label: '2', hoverColor: 'hover:bg-amber-500/20 hover:border-amber-500/50' },
  { val: 3, label: '3', hoverColor: 'hover:bg-blue-500/20 hover:border-blue-500/50' },
  { val: 4, label: '4', hoverColor: 'hover:bg-emerald-500/20 hover:border-emerald-500/50' },
  { val: 5, label: '5', hoverColor: 'bg-primary-container text-white scale-110 shadow-lg border-primary' },
]

export default function RevisionPage() {
  const queryClient = useQueryClient()
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)

  // Query: Due items
  const { data: dueData, isLoading: isDueLoading } = useQuery<{ items: RevisionItem[]; totalDue: number }>({
    queryKey: ['revision-due'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: RevisionItem[]; totalDue: number } }>('/api/revision/due')
      return res.data.data
    },
  })

  // Query: Stats
  const { data: stats } = useQuery<RevisionStats>({
    queryKey: ['revision-stats'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: RevisionStats }>('/api/revision/stats')
      return res.data.data
    },
  })

  // Mutation: Rate Recall
  const reviewMutation = useMutation({
    mutationFn: async ({ itemId, quality }: { itemId: string; quality: number }) => {
      await api.post('/api/revision/review', { itemId, quality })
    },
    onSuccess: () => {
      setReviewedCount((c) => c + 1)
      setFlipped(false)

      if (dueData && idx < dueData.items.length - 1) {
        setTimeout(() => {
          setIdx((i) => i + 1)
        }, 150)
      } else {
        void queryClient.invalidateQueries({ queryKey: ['revision-due'] })
        void queryClient.invalidateQueries({ queryKey: ['revision-stats'] })
        setIdx(0)
      }
    },
  })

  const currentItem = dueData?.items[idx] ?? null
  const totalDue = dueData?.totalDue ?? 0

  const handleQualitySubmit = useCallback((q: number) => {
    if (!currentItem) return
    reviewMutation.mutate({ itemId: currentItem.id, quality: q })
  }, [currentItem, reviewMutation])

  // Keybindings
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setFlipped((f) => !f)
      }
      if (flipped && e.key >= '0' && e.key <= '5') {
        handleQualitySubmit(Number(e.key))
      }
    }
    window.addEventListener('keydown', handleKeys)
    return () => window.removeEventListener('keydown', handleKeys)
  }, [flipped, handleQualitySubmit])

  const progressPercent = totalDue > 0 ? Math.round((reviewedCount / (reviewedCount + totalDue)) * 100) : 100

  return (
    <div className="space-y-6 select-none flex-grow flex flex-col justify-start max-w-5xl mx-auto w-full">
      <div className="flex flex-col gap-md">
        <div className="flex justify-between items-end flex-wrap gap-md">
          <div>
            <h2 className="font-display-lg text-display-lg font-semibold text-on-surface">Spaced Repetition</h2>
            <p className="text-on-surface-variant font-body-lg text-sm mt-xs">Daily session to strengthen recall parameters of vector documents.</p>
          </div>
          <div className="flex gap-md">
            <div className="glass-panel px-lg py-md rounded-xl flex items-center gap-md bg-surface-container">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined">verified</span>
              </div>
              <div className="leading-tight">
                <p className="font-label-sm text-[10px] text-on-surface-variant uppercase font-bold">Mastered items</p>
                <p className="font-display-lg text-xl text-on-surface leading-none font-bold mt-1">
                  {stats?.masteredItems ?? 0}
                </p>
              </div>
            </div>
            <div className="glass-panel px-lg py-md rounded-xl flex items-center gap-md bg-surface-container">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">analytics</span>
              </div>
              <div className="leading-tight">
                <p className="font-label-sm text-[10px] text-on-surface-variant uppercase font-bold">Retention rate</p>
                <p className="font-display-lg text-xl text-on-surface leading-none font-bold mt-1">
                  {stats?.retentionRate ? `${(stats.retentionRate * 100).toFixed(1)}%` : '94.2%'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden flex">
          <div className="h-full bg-secondary" style={{ width: `${progressPercent}%` }}></div>
          <div className="h-full bg-primary/40 flex-1"></div>
        </div>
        <div className="flex justify-between text-[11px] font-label-sm text-on-surface-variant">
          <div className="flex gap-md">
            <span className="flex items-center gap-xs">
              <span className="w-2 h-2 rounded-full bg-secondary"></span> {reviewedCount} Completed
            </span>
            <span className="flex items-center gap-xs">
              <span className="w-2 h-2 rounded-full bg-primary/40"></span> {totalDue} Remaining
            </span>
          </div>
          <span>Est. 4 mins left</span>
        </div>
      </div>

      {/* 3D Flashcard Canvas */}
      <div className="flex-1 flex items-center justify-center py-xl min-h-[360px]">
        {isDueLoading ? (
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-12 text-center h-80 flex flex-col justify-center items-center w-full max-w-[720px] aspect-[16/9]">
            <div className="skeleton h-8 w-1/3 mb-4 bg-white/5 animate-pulse" />
            <div className="skeleton h-4.5 w-1/2 bg-white/5 animate-pulse" />
          </div>
        ) : currentItem ? (
          <div className="card-container w-full max-w-[720px] aspect-[16/9] h-80">
            <div
              className={`card-inner cursor-pointer h-full ${flipped ? 'flipped' : ''}`}
              onClick={() => setFlipped((f) => !f)}
            >
              {/* Front Face */}
              <div className="card-front glass-panel p-3xl flex flex-col justify-center items-center text-center bg-surface-container-low border-outline-variant/30">
                <div className="absolute top-md right-md px-md py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-label-sm text-[10px] uppercase font-bold">
                  {currentItem.document.fileType} Source
                </div>
                <span className="material-symbols-outlined text-primary opacity-40 mb-lg text-4xl block">
                  psychology
                </span>
                <h3 className="font-display-lg text-lg text-on-surface leading-tight px-12 font-semibold">
                  {currentItem.topicName}
                </h3>
                <p className="mt-xl font-label-sm text-xs text-on-surface-variant animate-pulse font-bold">
                  Click to reveal answer
                </p>
              </div>

              {/* Back Face */}
              <div className="card-back glass-panel p-xl flex flex-col justify-between bg-surface-container-low border-outline-variant/30">
                <div className="flex-grow flex flex-col justify-center text-center overflow-y-auto max-h-[160px] py-2">
                  <h4 className="font-label-sm text-[11px] text-secondary font-bold tracking-widest mb-md uppercase">
                    ASSOCIATED EXCERPT / ABSTRACT
                  </h4>
                  <p className="font-body-lg text-xs leading-relaxed text-on-surface px-8 font-sans">
                    {currentItem.document.summary || 'Abstract review pending indexing.'}
                  </p>
                </div>

                <div className="pt-xl border-t border-outline-variant/30 mt-auto" onClick={(e) => e.stopPropagation()}>
                  <p className="text-center font-label-sm text-[11px] text-on-surface-variant mb-md font-semibold">
                    How well did you recall this topic?
                  </p>
                  <div className="flex justify-center gap-sm flex-wrap">
                    {recallButtons.map((btn) => (
                      <button
                        key={btn.val}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleQualitySubmit(btn.val)
                        }}
                        className={`w-12 h-12 rounded-lg bg-surface-container-high border border-outline-variant/40 flex items-center justify-center font-bold transition-all text-xs cursor-pointer ${btn.hoverColor}`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-outline-variant/30 p-12 text-center h-80 flex flex-col justify-center items-center w-full max-w-[720px] aspect-[16/9] bg-surface-container/20">
            <span className="material-symbols-outlined text-primary text-4xl mb-4">
              verified
            </span>
            <h3 className="font-display-lg text-sm text-on-surface font-bold uppercase tracking-wider">Revision Completed</h3>
            <p className="text-xs text-on-surface-variant mt-2 max-w-sm leading-relaxed">
              Fantastic! You have reviewed all scheduled items. Next check will trigger when new spaced-repetition revisions fall due.
            </p>
          </div>
        )}
      </div>

      {/* Hotkeys */}
      <div className="flex justify-center items-center gap-xl text-xs font-label-sm text-on-surface-variant flex-wrap">
        <div className="flex items-center gap-xs">
          <kbd className="px-2 py-1 bg-surface-container border border-outline-variant/30 rounded text-[10px] font-mono">SPACE</kbd>
          <span>Flip card</span>
        </div>
        <div className="flex items-center gap-xs">
          <kbd className="px-2 py-1 bg-surface-container border border-outline-variant/30 rounded text-[10px] font-mono">0-5</kbd>
          <span>Rate recall</span>
        </div>
      </div>
    </div>
  )
}
