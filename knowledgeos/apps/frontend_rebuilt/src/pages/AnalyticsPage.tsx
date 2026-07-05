// apps/frontend_rebuilt/src/pages/AnalyticsPage.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Gap {
  id: string;
  topic: string;
  confidence: number;
  createdAt: string;
}

interface HeatmapItem {
  id: string;
  title: string;
  temperature: number;
  accessCount: number;
  lastAccessedAt: string;
}

interface AnalyticsData {
  summary: {
    documentsIndexed: number;
    knowledgeNodes: number;
    tagsAssigned: number;
    searchesPerformed: number;
    chatMessagesSent: number;
  };
  growthTrend: { period: string; count: number }[];
  revisionsDistribution: {
    mastered: number;
    learning: number;
    total: number;
  };
}

export default function AnalyticsPage() {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [heatmap, setHeatmap] = useState<{ hot: HeatmapItem[]; cold: HeatmapItem[]; forgotten: HeatmapItem[] } | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (reanalyzeGaps = false) => {
    if (reanalyzeGaps) setIsReanalyzing(true);
    else setIsLoading(true);

    try {
      const [gapsRes, heatmapRes, analyticsRes] = await Promise.all([
        api.get<{ success: boolean; data: Gap[] }>(`/api/gaps?reanalyze=${reanalyzeGaps}`),
        api.get<{ success: boolean; data: { hot: HeatmapItem[]; cold: HeatmapItem[]; forgotten: HeatmapItem[] } }>('/api/heatmap'),
        api.get<{ success: boolean; data: AnalyticsData }>('/api/analytics')
      ]);

      if (gapsRes.data.success) setGaps(gapsRes.data.data);
      if (heatmapRes.data.success) setHeatmap(heatmapRes.data.data);
      if (analyticsRes.data.success) setAnalytics(analyticsRes.data.data);
    } catch (e) {
      console.error('Failed to load analytics data:', e);
    } finally {
      setIsReanalyzing(false);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[calc(100vh-60px)] items-center justify-center bg-[#0b1326] text-[#dae2fd]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-slate-400 text-xs font-semibold">Compiling analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2xl bg-[#0b1326] text-[#dae2fd] min-h-[calc(100vh-60px)] space-y-2xl">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-md border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Learning Analytics & Heatmap</h1>
          <p className="text-xs text-slate-400 mt-xs font-medium">Observe retention strength, activity levels, and custom AI-detected gaps</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={isReanalyzing}
          className="bg-primary text-on-primary px-md py-xs rounded text-xs font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-all"
        >
          {isReanalyzing ? (
            <>
              <div className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin" />
              Re-analyzing...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-xs">analytics</span>
              Trigger Re-Analysis
            </>
          )}
        </button>
      </div>

      {/* Metrics Summary Row */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-md">
          {[
            { label: 'Documents Indexed', value: analytics.summary.documentsIndexed, icon: 'description' },
            { label: 'Knowledge Nodes', value: analytics.summary.knowledgeNodes, icon: 'hub' },
            { label: 'Searches Run', value: analytics.summary.searchesPerformed, icon: 'search' },
            { label: 'Chat Messages', value: analytics.summary.chatMessagesSent, icon: 'forum' },
            { label: 'Revisions Mastered', value: `${analytics.revisionsDistribution.mastered} / ${analytics.revisionsDistribution.total}`, icon: 'psychology' }
          ].map((item, idx) => (
            <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-md flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
                <p className="text-lg font-bold text-white mt-xs">{item.value}</p>
              </div>
              <span className="material-symbols-outlined text-primary text-[24px] opacity-80">{item.icon}</span>
            </div>
          ))}
        </div>
      )}

      {/* Knowledge Gaps & Revisions Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-xl">
        {/* Knowledge Gaps Card */}
        <div className="bg-[#090e1a]/40 border border-white/5 rounded-2xl p-lg flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-red-400">warning</span>
              Detected Knowledge Gaps
            </h2>
            <span className="text-[10px] font-bold text-slate-500">{gaps.length} gaps identified</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-sm max-h-[300px] pr-xs">
            {gaps.map((gap) => (
              <div key={gap.id} className="bg-white/5 border border-white/10 rounded-xl p-sm flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">{gap.topic}</h4>
                  <span className="text-[9px] text-slate-500">Identified on {new Date(gap.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-sm">
                  <span className="text-[10px] font-bold font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {Math.round(gap.confidence * 100)}% Confidence
                  </span>
                </div>
              </div>
            ))}
            {gaps.length === 0 && (
              <p className="text-slate-500 text-xs italic text-center py-8">No knowledge gaps found. Try running a query in Search or Q&A first!</p>
            )}
          </div>
        </div>

        {/* Growth & Distribution graphs placeholders */}
        <div className="bg-[#090e1a]/40 border border-white/5 rounded-2xl p-lg flex flex-col gap-md">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-emerald-400">trending_up</span>
            Retention & Study Growth
          </h2>
          <div className="flex-1 flex flex-col justify-center gap-md">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Flashcard Mastery Distribution</span>
              <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden mt-xs flex">
                {analytics && analytics.revisionsDistribution.total > 0 ? (
                  <>
                    <div
                      style={{ width: `${(analytics.revisionsDistribution.mastered / analytics.revisionsDistribution.total) * 100}%` }}
                      className="bg-emerald-500 h-full"
                      title="Mastered"
                    />
                    <div
                      style={{ width: `${(analytics.revisionsDistribution.learning / analytics.revisionsDistribution.total) * 100}%` }}
                      className="bg-primary h-full"
                      title="Learning"
                    />
                  </>
                ) : (
                  <div className="w-full bg-white/5 h-full" />
                )}
              </div>
              <div className="flex gap-md text-[10px] text-slate-400 mt-xs font-semibold">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Mastered ({analytics?.revisionsDistribution.mastered ?? 0})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Learning ({analytics?.revisionsDistribution.learning ?? 0})</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Document Ingestion Trend</span>
              <div className="flex items-end gap-sm h-20 pt-md">
                {analytics?.growthTrend.map((trend, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-xs">
                    <div
                      style={{ height: `${Math.min(100, (trend.count / (analytics.summary.documentsIndexed || 1)) * 100)}%` }}
                      className="w-full bg-primary/20 hover:bg-primary/40 border-t-2 border-primary rounded-t min-h-[4px] transition-all"
                    />
                    <span className="text-[8px] font-bold font-mono text-slate-500">{trend.period}</span>
                  </div>
                ))}
                {(!analytics?.growthTrend || analytics.growthTrend.length === 0) && (
                  <p className="text-slate-500 text-xs italic w-full text-center py-6">No ingestion trend data yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      {heatmap && (
        <div className="bg-[#090e1a]/40 border border-white/5 rounded-2xl p-lg space-y-md">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-cyan-400">thermostat</span>
            Knowledge Temperature Grid
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            {/* Hot Knowledge */}
            <div className="space-y-sm">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-xs">
                <span>🔥 Hot (Active study)</span>
                <span className="text-[10px] font-mono">{heatmap.hot.length} docs</span>
              </h3>
              <div className="space-y-xs max-h-[250px] overflow-y-auto pr-xs">
                {heatmap.hot.map(item => (
                  <div key={item.id} className="bg-white/5 border border-white/10 rounded-lg p-sm flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-[160px] text-white">{item.title}</span>
                    <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded font-mono">
                      {item.temperature}°C
                    </span>
                  </div>
                ))}
                {heatmap.hot.length === 0 && <p className="text-slate-500 text-[11px] italic">No active hot files.</p>}
              </div>
            </div>

            {/* Cold Knowledge */}
            <div className="space-y-sm">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-xs">
                <span>❄️ Cold (Stable memory)</span>
                <span className="text-[10px] font-mono">{heatmap.cold.length} docs</span>
              </h3>
              <div className="space-y-xs max-h-[250px] overflow-y-auto pr-xs">
                {heatmap.cold.map(item => (
                  <div key={item.id} className="bg-white/5 border border-white/10 rounded-lg p-sm flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-[160px] text-slate-300">{item.title}</span>
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded font-mono">
                      {item.temperature}°C
                    </span>
                  </div>
                ))}
                {heatmap.cold.length === 0 && <p className="text-slate-500 text-[11px] italic">No cold files yet.</p>}
              </div>
            </div>

            {/* Forgotten Knowledge */}
            <div className="space-y-sm">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-xs">
                <span>⚠️ Forgotten (Needs review)</span>
                <span className="text-[10px] font-mono">{heatmap.forgotten.length} docs</span>
              </h3>
              <div className="space-y-xs max-h-[250px] overflow-y-auto pr-xs">
                {heatmap.forgotten.map(item => (
                  <div key={item.id} className="bg-white/5 border border-white/10 rounded-lg p-sm flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-[160px] text-slate-400">{item.title}</span>
                    <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono">
                      {item.temperature}°C
                    </span>
                  </div>
                ))}
                {heatmap.forgotten.length === 0 && <p className="text-slate-500 text-[11px] italic">No files flagging for recall decays!</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
