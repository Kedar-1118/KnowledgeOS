// apps/frontend_rebuilt/src/pages/ResearchPage.tsx
import React, { useState } from 'react';
import { api } from '../lib/api';

export default function ResearchPage() {
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [sourcesCount, setSourcesCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsGenerating(true);
    setReport(null);
    setError(null);
    setSaveStatus('idle');

    // Auto-generate a title if none is provided
    const researchTitle = title.trim() || `Research on ${query.slice(0, 30)}${query.length > 30 ? '...' : ''}`;
    if (!title.trim()) {
      setTitle(researchTitle);
    }

    try {
      const res = await api.post<{ success: boolean; data: { report: string; sourcesCount: number } }>('/api/research/generate', { query });
      if (res.data.success) {
        setReport(res.data.data.report);
        setSourcesCount(res.data.data.sourcesCount);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Research compilation failed. Ensure search is functional.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToOS = async () => {
    if (!report || !title) return;
    setSaveStatus('saving');
    try {
      const res = await api.post<{ success: boolean }>('/api/research/save', {
        title,
        markdown: report
      });
      if (res.data.success) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-60px)] bg-[#0b1326] text-[#dae2fd]">
      {/* Sidebar Inputs */}
      <div className="w-[320px] border-r border-white/5 bg-[#090e1a] p-lg flex flex-col gap-md">
        <div>
          <h2 className="font-display font-bold text-xs uppercase tracking-widest text-primary mb-sm">Research Agent</h2>
          <p className="text-xs text-slate-400 mb-md leading-relaxed">
            Specify a topic or prompt. The Research Agent will compile local knowledge, check for contradictions, highlight missing details, and generate a markdown report.
          </p>

          <form onSubmit={handleGenerate} className="flex flex-col gap-sm">
            <div className="flex flex-col gap-xs">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Topic / Query</label>
              <textarea
                placeholder="e.g. Compare PostgreSQL indexes to Qdrant vector index storage details"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={4}
                className="bg-white/5 border border-white/10 rounded-xl px-sm py-sm text-xs focus:outline-none focus:border-primary/50 text-on-surface resize-none"
                disabled={isGenerating}
              />
            </div>

            <div className="flex flex-col gap-xs">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Report Title</label>
              <input
                type="text"
                placeholder="Auto-generated if blank"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white/5 border border-white/10 rounded px-sm py-xs text-xs focus:outline-none focus:border-primary/50 text-on-surface"
                disabled={isGenerating}
              />
            </div>

            <button
              type="submit"
              className="bg-primary text-on-primary py-sm rounded-lg text-xs font-bold hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all"
              disabled={isGenerating || !query.trim()}
            >
              {isGenerating ? (
                <>
                  <div className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin" />
                  Compiling...
                </>
              ) : 'Start Research'}
            </button>
          </form>
          {error && <p className="text-[10px] text-red-400 mt-2 font-medium leading-relaxed">{error}</p>}
        </div>

        {report && (
          <>
            <hr className="border-white/5" />
            <div className="flex flex-col gap-xs">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-xs">Actions</h3>
              <button
                onClick={handleSaveToOS}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                className={`py-xs rounded text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  saveStatus === 'saved'
                    ? 'bg-emerald-500/25 border border-emerald-500/30 text-emerald-400'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
                }`}
              >
                <span className="material-symbols-outlined text-xs">save</span>
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved to Library' : 'Save to Library'}
              </button>
              <button
                onClick={handleDownload}
                className="bg-white/5 border border-white/10 hover:bg-white/10 py-xs rounded text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all text-white"
              >
                <span className="material-symbols-outlined text-xs">download</span>
                Export Markdown
              </button>
            </div>
          </>
        )}
      </div>

      {/* Report Viewer */}
      <div className="flex-1 p-2xl overflow-y-auto">
        {report ? (
          <div className="max-w-[800px] mx-auto space-y-xl bg-[#090e1a]/40 border border-white/5 rounded-2xl p-2xl">
            <div className="flex justify-between items-center pb-md border-b border-white/5">
              <div>
                <h1 className="text-xl font-bold font-display text-white">{title}</h1>
                <p className="text-xs text-slate-400 mt-xs">Generated by AI Research Agent utilizing local knowledge</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                  {sourcesCount} sources cited
                </span>
              </div>
            </div>

            {/* Render Markdown content */}
            <div className="prose prose-invert max-w-none text-xs text-slate-300 space-y-md leading-relaxed whitespace-pre-wrap font-mono">
              {report}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-[400px] mx-auto gap-md py-20">
            <span className="material-symbols-outlined text-4xl text-primary/50">science</span>
            <div>
              <h2 className="text-sm font-semibold text-white">AI Research Agent Workspace</h2>
              <p className="text-xs text-slate-400 mt-xs leading-relaxed">
                Start research in the sidebar. The agent will fetch relevant documents, resolve conflicts, and synthesize a polished report.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
