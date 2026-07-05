// apps/frontend_rebuilt/src/pages/DashboardPage.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface SyncStatus {
  isRunning: boolean;
  lastSyncAt: string | null;
  driveFolderId?: string | null;
  driveFolderUrl?: string | null;
  documents: {
    total: number;
    pending: number;
    processing: number;
    indexed: number;
    failed: number;
  };
  activeJobs: number;
}

interface DocumentItem {
  id: string;
  title: string;
  fileType: string;
  status: string;
  createdAt: string;
  fileSizeBytes: number;
}

interface ListResponse {
  documents: DocumentItem[];
}

interface DigestData {
  dueCards: number;
  recommendedReading: { id: string; title: string; fileType: string }[];
  forgottenTopics: string[];
  connections: { description: string }[];
}

interface StudyGuide {
  summary: string;
  quiz: { question: string; options: string[]; correctAnswer: string; explanation: string }[];
  roadmap: string[];
  interviewPrep: { question: string; answer: string }[];
  flashcards: { cardType: string; question: string; answer: string }[];
}

interface Bookmark {
  id: string;
  concept: string;
  notes: string;
}

interface TimelineYear {
  year: number;
  months: { month: string; events: string[] }[];
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Active sub-sections/tabs
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [timeline, setTimeline] = useState<TimelineYear[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(true);

  // Bookmarking Form states
  const [newConcept, setNewConcept] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isBookmarking, setIsBookmarking] = useState(false);

  // Agentic Workflow states
  const [studyTopic, setStudyTopic] = useState('');
  const [isCompilingGuide, setIsCompilingGuide] = useState(false);
  const [guideResult, setGuideResult] = useState<StudyGuide | null>(null);
  const [activeGuideTab, setActiveGuideTab] = useState<'summary' | 'quiz' | 'roadmap' | 'interview' | 'flashcards'>('summary');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [showInterviewAnswer, setShowInterviewAnswer] = useState<Record<number, boolean>>({});

  // Live Sync Status
  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['drive-status'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SyncStatus }>('/api/drive/status');
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  // Recently Ingested Documents
  const { data: recentData, isLoading: isRecentLoading } = useQuery<ListResponse>({
    queryKey: ['recent-documents'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ListResponse }>('/api/documents?limit=5');
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  // Synchronize Now
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/drive/sync-now');
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drive-status'] });
      void queryClient.invalidateQueries({ queryKey: ['recent-documents'] });
      fetchDigest();
    },
  });

  useEffect(() => {
    fetchDigest();
    fetchTimeline();
    fetchBookmarks();
  }, []);

  const fetchDigest = async () => {
    try {
      const res = await api.get<{ success: boolean; data: DigestData }>('/api/digest');
      if (res.data.success) {
        setDigest(res.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTimeline = async () => {
    setIsTimelineLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: TimelineYear[] }>('/api/timeline');
      if (res.data.success) {
        setTimeline(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTimelineLoading(false);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const res = await api.get<{ success: boolean; data: Bookmark[] }>('/api/bookmarks');
      if (res.data.success) {
        setBookmarks(res.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConcept.trim()) return;

    setIsBookmarking(true);
    try {
      const res = await api.post<{ success: boolean }>('/api/bookmarks', {
        concept: newConcept,
        notes: newNotes,
      });
      if (res.data.success) {
        setNewConcept('');
        setNewNotes('');
        await fetchBookmarks();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBookmarking(false);
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    try {
      const res = await api.delete(`/api/bookmarks/${id}`);
      if (res.data.success) {
        setBookmarks(bookmarks.filter(b => b.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompileStudyGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studyTopic.trim()) return;

    setIsCompilingGuide(true);
    setGuideResult(null);
    setQuizAnswers({});
    setShowInterviewAnswer({});
    setActiveGuideTab('summary');

    try {
      const res = await api.post<{ success: boolean; data: StudyGuide }>('/api/workflows/study-guide', {
        topic: studyTopic,
      });
      if (res.data.success) {
        setGuideResult(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCompilingGuide(false);
    }
  };

  const greeting = getGreeting();
  const indexed = syncStatus?.documents.indexed ?? 0;
  const total = syncStatus?.documents.total ?? 0;
  const pending = syncStatus?.documents.pending ?? 0;
  const failed = syncStatus?.documents.failed ?? 0;
  const processing = syncStatus?.documents.processing ?? 0;

  const healthRatio = total > 0 ? Math.round((indexed / total) * 100) : 0;
  const strokeDashoffset = 251.32 - (251.32 * (healthRatio / 100));

  const isSyncing = syncStatus?.isRunning || syncMutation.isLoading;

  return (
    <div className="space-y-6 select-none text-[#dae2fd]">
      <header className="flex flex-col gap-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display-lg text-display-lg font-semibold text-on-surface text-white">
            {greeting}, {user?.name?.split(' ')[0] ?? 'Alex'}.
          </h2>
          <p className="text-on-surface-variant font-body-lg text-sm text-slate-400">Here's a snapshot of your intelligence network today.</p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={isSyncing}
          className="px-lg py-sm bg-primary text-on-primary font-label-sm text-xs rounded hover:opacity-90 transition-all border-t border-white/10 active:scale-95 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          {isSyncing ? 'Syncing...' : 'Sync drive'}
        </button>
      </header>

      {/* Overview Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-lg">
        <div className="glass-panel p-lg rounded-xl flex flex-col gap-sm bg-[#090e1a]/40 border border-white/5 hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider text-[11px] font-bold text-slate-400">Documents Indexed</span>
            <span className="material-symbols-outlined text-primary">description</span>
          </div>
          <div className="text-headline-lg font-display-lg text-on-surface text-3xl font-bold text-white">{indexed}</div>
          <div className="text-secondary font-label-sm text-[11px] font-bold text-primary">Files cataloged: {total}</div>
        </div>

        <div className="glass-panel p-lg rounded-xl flex flex-col gap-sm bg-[#090e1a]/40 border border-white/5 hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider text-[11px] font-bold text-slate-400">Sync Coverage</span>
            <span className="material-symbols-outlined text-primary">database</span>
          </div>
          <div className="text-headline-lg font-display-lg text-on-surface text-3xl font-bold text-white">{healthRatio}%</div>
          <div className="flex items-center gap-xs">
            <div className="h-1 flex-1 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${healthRatio}%` }}></div>
            </div>
            <span className="text-on-surface-variant font-label-sm text-[11px] font-bold text-slate-400">{healthRatio}%</span>
          </div>
        </div>

        <div className="glass-panel p-lg rounded-xl flex flex-col gap-sm bg-[#090e1a]/40 border border-white/5 hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider text-[11px] font-bold text-slate-400">Processing Queue</span>
            <span className="material-symbols-outlined text-primary">bolt</span>
          </div>
          <div className="text-headline-lg font-display-lg text-on-surface text-3xl font-bold text-white">{processing}</div>
          <div className="text-on-surface-variant font-label-sm text-[11px] font-bold text-slate-400">Pending parser: {pending}</div>
        </div>

        <div className="glass-panel p-lg rounded-xl flex flex-col gap-sm bg-[#090e1a]/40 border border-white/5 hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider text-[11px] font-bold text-slate-400">System Status</span>
            <div className={`w-2 h-2 rounded-full pulse-dot ${failed > 0 ? 'bg-error' : 'bg-secondary'}`}></div>
          </div>
          <div className="text-headline-lg font-display-lg text-on-surface text-3xl font-bold text-white">
            {failed > 0 ? 'Degraded' : 'Active'}
          </div>
          <div className="text-secondary font-label-sm text-[11px] font-bold text-primary">
            {failed > 0 ? `${failed} indexing faults` : 'All clusters operational'}
          </div>
        </div>
      </section>

      {/* Main Stats and Recent docs Section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-lg items-stretch">
        <section className="xl:col-span-4 glass-panel p-xl rounded-xl flex flex-col items-center justify-center gap-lg bg-[#090e1a]/40 border border-white/5">
          <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest text-[11px] font-bold self-start text-slate-400">Knowledge Coverage</h3>
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle className="text-slate-800" cx="50" cy="50" fill="none" r="40" stroke="currentColor" strokeWidth="8"></circle>
              <circle
                className="text-primary"
                cx="50"
                cy="50"
                fill="none"
                r="40"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="8"
                style={{ strokeDasharray: '251.32', strokeDashoffset: strokeDashoffset }}
              ></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="font-display-lg text-display-lg text-on-surface text-3xl font-bold text-white">{healthRatio}%</span>
              <span className="font-label-sm text-on-surface-variant text-[10px] font-bold mt-1 text-primary">OPTIMIZED</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-md w-full pt-md">
            <div className="text-center p-md bg-white/5 border border-white/10 rounded-lg">
              <div className="text-on-surface font-semibold text-sm text-white">{total}</div>
              <div className="text-label-sm text-on-surface-variant text-[10px] font-bold text-slate-400">Sources</div>
            </div>
            <div className="text-center p-md bg-white/5 border border-white/10 rounded-lg">
              <div className="text-on-surface font-semibold text-sm text-white">{indexed}</div>
              <div className="text-label-sm text-on-surface-variant text-[10px] font-bold text-slate-400">Indexed</div>
            </div>
          </div>
        </section>

        <section className="xl:col-span-8 glass-panel rounded-xl overflow-hidden flex flex-col justify-between bg-[#090e1a]/40 border border-white/5">
          <div>
            <div className="p-lg border-b border-white/5 flex items-center justify-between">
              <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest text-[11px] font-bold text-slate-400">Recent Documents</h3>
              <button onClick={() => navigate('/library')} className="text-primary font-label-sm hover:underline text-xs cursor-pointer font-bold">
                View All
              </button>
            </div>
            {isRecentLoading ? (
              <div className="p-lg space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-10 w-full bg-white/5 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentData && recentData.documents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-label-sm text-on-surface-variant border-b border-white/5 text-[10px] font-bold text-slate-400">
                      <th className="p-lg font-medium">FILENAME</th>
                      <th className="p-lg font-medium">FORMAT</th>
                      <th className="p-lg font-medium">SIZE</th>
                      <th className="p-lg font-medium">STATUS</th>
                      <th className="p-lg font-medium text-right">INGESTED</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {recentData.documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-lg">
                          <div className="flex items-center gap-md min-w-0 max-w-xs sm:max-w-md">
                            <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center text-primary flex-shrink-0">
                              <span className="material-symbols-outlined text-[18px]">
                                {doc.fileType === 'PDF' ? 'picture_as_pdf' : doc.fileType === 'IMAGE' ? 'image' : 'description'}
                              </span>
                            </div>
                            <span className="text-on-surface font-medium truncate block text-slate-300">{doc.title}</span>
                          </div>
                        </td>
                        <td className="p-lg text-on-surface-variant font-code text-[11px] font-bold text-slate-400">{doc.fileType}</td>
                        <td className="p-lg text-on-surface-variant font-mono text-[11px] text-slate-400">{formatBytes(doc.fileSizeBytes)}</td>
                        <td className="p-lg">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase ${
                            doc.status === 'INDEXED' ? 'bg-secondary/10 text-secondary' :
                            doc.status === 'PROCESSING' ? 'bg-primary/25 text-primary animate-pulse' :
                            doc.status === 'PENDING' ? 'bg-amber-400/10 text-amber-400' : 'bg-error/10 text-error'
                          }`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="p-lg text-right text-on-surface-variant font-mono text-[11px] text-slate-400">{formatTime(doc.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-on-surface-variant text-sm">
                No indexed files in your directory yet. Try syncing.
              </div>
            )}
          </div>

          <div className="p-lg border-t border-white/5 flex items-center justify-between text-xs text-on-surface-variant bg-black/10">
            <span>Automatic Sync Listener: <span className="text-secondary font-bold">Listening</span></span>
            <span className="font-mono text-[11px]">{syncStatus?.lastSyncAt ? `Last run: ${formatTime(syncStatus.lastSyncAt)}` : ''}</span>
          </div>
        </section>
      </div>

      {/* DAILY DIGEST & BOOKMARKS ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-lg">
        {/* Daily Digest */}
        {digest && (
          <section className="glass-panel p-lg rounded-xl flex flex-col gap-md bg-[#090e1a]/40 border border-white/5">
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">auto_stories</span>
              Daily Knowledge Digest
            </h3>

            <div className="grid grid-cols-2 gap-md">
              <div className="bg-white/5 border border-white/10 rounded-xl p-md">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Cards Due Today</span>
                <span className="text-2xl font-bold text-white block mt-xs">{digest.dueCards} cards</span>
                <button onClick={() => navigate('/revision')} className="text-primary text-[10px] font-bold hover:underline mt-sm block">
                  Revise Now
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-md">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Forgotten Topics</span>
                <div className="flex flex-wrap gap-xs mt-sm">
                  {digest.forgottenTopics.map((topic) => (
                    <span key={topic} className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">{topic}</span>
                  ))}
                  {digest.forgottenTopics.length === 0 && <span className="text-[9px] text-slate-500 italic">None flagged!</span>}
                </div>
              </div>
            </div>

            <div className="space-y-sm mt-xs">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recommended Readings</h4>
              <div className="space-y-xs">
                {digest.recommendedReading.map(doc => (
                  <div key={doc.id} className="bg-white/5 border border-white/10 rounded-lg p-sm flex items-center justify-between text-xs cursor-pointer hover:bg-white/10" onClick={() => navigate('/library')}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-400 text-sm">description</span>
                      <span className="font-medium text-slate-300 truncate max-w-[200px]">{doc.title}</span>
                    </div>
                    <span className="text-[9px] font-bold uppercase text-primary font-mono">{doc.fileType}</span>
                  </div>
                ))}
                {digest.recommendedReading.length === 0 && <p className="text-[10px] text-slate-500 italic">No recommendations right now.</p>}
              </div>
            </div>

            {digest.connections.length > 0 && (
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-sm text-[10px] leading-relaxed text-slate-300">
                <h5 className="font-bold text-primary uppercase mb-1">Graph Connections Decoded:</h5>
                <ul className="list-disc list-inside space-y-0.5">
                  {digest.connections.map((conn, idx) => (
                    <li key={idx}>{conn.description}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Semantic Bookmarks */}
        <section className="glass-panel p-lg rounded-xl flex flex-col gap-md bg-[#090e1a]/40 border border-white/5">
          <div className="flex justify-between items-center">
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">bookmark</span>
              Semantic Bookmarks
            </h3>
            <span className="text-[9px] text-slate-500 font-bold">{bookmarks.length} bookmarked</span>
          </div>

          {/* Quick Bookmark form */}
          <form onSubmit={handleAddBookmark} className="flex gap-sm items-end border-b border-white/5 pb-md">
            <div className="flex-1 space-y-xs">
              <input
                type="text"
                placeholder="Topic / Concept"
                value={newConcept}
                onChange={e => setNewConcept(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white focus:outline-none"
                disabled={isBookmarking}
              />
              <input
                type="text"
                placeholder="Study Notes..."
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white focus:outline-none"
                disabled={isBookmarking}
              />
            </div>
            <button
              type="submit"
              disabled={isBookmarking || !newConcept.trim()}
              className="bg-primary text-on-primary px-md py-sm rounded-lg text-xs font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer h-10 flex items-center"
            >
              Add
            </button>
          </form>

          {/* Bookmarks List */}
          <div className="flex-1 overflow-y-auto space-y-sm max-h-[220px] pr-xs">
            {bookmarks.map((b) => (
              <div key={b.id} className="bg-white/5 border border-white/10 rounded-xl p-sm flex items-start justify-between text-xs">
                <div className="min-w-0 flex-1 pr-sm">
                  <h4 className="font-bold text-white">{b.concept}</h4>
                  <p className="text-[10px] text-slate-400 leading-normal mt-0.5 whitespace-pre-wrap">{b.notes || 'No notes added.'}</p>
                </div>
                <button
                  onClick={() => handleDeleteBookmark(b.id)}
                  className="text-slate-500 hover:text-red-400 p-1"
                >
                  <span className="material-symbols-outlined text-xs">delete</span>
                </button>
              </div>
            ))}
            {bookmarks.length === 0 && (
              <p className="text-slate-500 text-xs italic text-center py-8">No semantic bookmarks cataloged yet.</p>
            )}
          </div>
        </section>
      </div>

      {/* INTERACTIVE STUDY GUIDE WORKFLOW SECTION */}
      <section className="glass-panel p-lg rounded-xl flex flex-col gap-md bg-[#090e1a]/40 border border-white/5">
        <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest text-[11px] font-bold text-slate-400 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">settings_suggest</span>
          Agentic Workflow: Complete Study Guide compiler
        </h3>
        <p className="text-xs text-slate-400 max-w-[600px] leading-relaxed">
          Input a learning topic. The AI Curriculum Director will synthesize a full learning suite including summaries, roadmap checklists, quizzes, and flashcard revisions.
        </p>

        <form onSubmit={handleCompileStudyGuide} className="flex gap-sm max-w-md">
          <input
            type="text"
            placeholder="e.g. Distributed Database consensus (Raft/Paxos)"
            value={studyTopic}
            onChange={e => setStudyTopic(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-sm text-xs text-white focus:outline-none"
            disabled={isCompilingGuide}
          />
          <button
            type="submit"
            disabled={isCompilingGuide || !studyTopic.trim()}
            className="bg-primary text-on-primary px-md py-xs rounded-lg text-xs font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isCompilingGuide ? (
              <>
                <div className="w-3 h-3 rounded-full border border-white/35 border-t-white animate-spin" />
                Compiling...
              </>
            ) : 'Compile Suite'}
          </button>
        </form>

        {guideResult && (
          <div className="mt-md border border-white/10 rounded-2xl bg-black/10 p-md space-y-md">
            {/* Guide Tabs */}
            <div className="flex border-b border-white/5 gap-sm flex-wrap">
              {(['summary', 'quiz', 'roadmap', 'interview', 'flashcards'] as const).map(tab => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActiveGuideTab(tab)}
                  className={`px-sm pb-sm border-b-2 text-xs font-bold uppercase tracking-wider cursor-pointer ${
                    activeGuideTab === tab ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Guide Contents */}
            <div className="text-xs text-slate-300 min-h-[140px]">
              {/* SUMMARY */}
              {activeGuideTab === 'summary' && (
                <div className="space-y-sm leading-relaxed">
                  <h4 className="font-bold text-white uppercase text-[10px] tracking-wider">Concept Summary Overview</h4>
                  <p>{guideResult.summary}</p>
                </div>
              )}

              {/* QUIZ */}
              {activeGuideTab === 'quiz' && (
                <div className="space-y-lg">
                  {guideResult.quiz.map((q, qidx) => {
                    const chosen = quizAnswers[qidx];
                    return (
                      <div key={qidx} className="space-y-sm bg-white/5 border border-white/10 rounded-xl p-sm">
                        <h4 className="font-semibold text-white">Q{qidx + 1}: {q.question}</h4>
                        <div className="grid grid-cols-2 gap-sm">
                          {q.options.map(opt => (
                            <button
                              type="button"
                              key={opt}
                              onClick={() => setQuizAnswers({ ...quizAnswers, [qidx]: opt })}
                              className={`p-sm text-left rounded-lg text-xs font-medium transition-all ${
                                chosen === opt ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-[#090e1a]/60 hover:bg-white/5 border border-white/5 text-slate-300'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        {chosen && (
                          <div className="border-t border-white/5 pt-sm mt-xs">
                            <span className={`font-bold text-[10px] uppercase block ${chosen === q.correctAnswer ? 'text-emerald-400' : 'text-red-400'}`}>
                              {chosen === q.correctAnswer ? 'Correct' : 'Incorrect (Answer: ' + q.correctAnswer + ')'}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ROADMAP */}
              {activeGuideTab === 'roadmap' && (
                <div className="space-y-sm">
                  <h4 className="font-bold text-white uppercase text-[10px] tracking-wider mb-sm">Conceptual Roadmap Steps</h4>
                  <div className="space-y-xs">
                    {guideResult.roadmap.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-sm bg-white/5 border border-white/5 rounded-lg p-sm">
                        <span className="font-mono text-primary font-bold">0{idx + 1}</span>
                        <span className="font-medium text-slate-300">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* INTERVIEW */}
              {activeGuideTab === 'interview' && (
                <div className="space-y-md">
                  <h4 className="font-bold text-white uppercase text-[10px] tracking-wider mb-sm">Interview Q&A Drills</h4>
                  {guideResult.interviewPrep.map((item, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-sm space-y-xs">
                      <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowInterviewAnswer({ ...showInterviewAnswer, [idx]: !showInterviewAnswer[idx] })}>
                        <h4 className="font-semibold text-white truncate max-w-[85%]">Question: {item.question}</h4>
                        <span className="material-symbols-outlined text-slate-400 text-xs">{showInterviewAnswer[idx] ? 'expand_less' : 'expand_more'}</span>
                      </div>
                      {showInterviewAnswer[idx] && (
                        <p className="border-t border-white/5 pt-sm text-slate-400 text-[10px] leading-relaxed whitespace-pre-wrap">{item.answer}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* FLASHCARDS */}
              {activeGuideTab === 'flashcards' && (
                <div className="space-y-md">
                  <h4 className="font-bold text-white uppercase text-[10px] tracking-wider mb-sm">Revision Decks Draft</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                    {guideResult.flashcards.map((card, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-sm space-y-xs">
                        <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 border border-primary/20 rounded font-bold uppercase tracking-wider inline-block">{card.cardType}</span>
                        <h5 className="font-semibold text-white">Q: {card.question}</h5>
                        <p className="text-[10px] text-slate-400 border-t border-white/5 pt-xs mt-xs">A: {card.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* STUDY TIMELINE SECTION */}
      <section className="glass-panel p-lg rounded-xl flex flex-col gap-md bg-[#090e1a]/40 border border-white/5">
        <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest text-[11px] font-bold text-slate-400 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">schedule</span>
          Chronological Study Timeline
        </h3>

        {isTimelineLoading ? (
          <div className="py-xl flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full" />
          </div>
        ) : timeline.length > 0 ? (
          <div className="space-y-lg relative border-l border-white/5 pl-lg ml-xs py-xs">
            {timeline.map((yr) => (
              <div key={yr.year} className="space-y-md relative">
                {/* Year Marker */}
                <div className="absolute -left-[30px] top-0 bg-[#0b1326] border border-white/20 rounded-full px-2 py-0.5 text-[10px] font-bold text-primary">
                  {yr.year}
                </div>

                <div className="space-y-md pt-lg">
                  {yr.months.map((m) => (
                    <div key={m.month} className="space-y-xs">
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest font-mono">{m.month}</h4>
                      <div className="space-y-1">
                        {m.events.map((evt, idx) => (
                          <div key={idx} className="text-xs text-slate-300 flex items-center gap-sm bg-white/[0.02] border border-white/5 rounded-lg px-sm py-xs">
                            <span className="w-1.5 h-1.5 bg-secondary rounded-full" />
                            <span className="font-medium truncate max-w-full">{evt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-xs italic text-center py-6">No study events cataloged in your timeline yet.</p>
        )}
      </section>

      {isSyncing && (
        <div className="fixed bottom-10 right-10 w-64 glass-panel rounded-xl p-md border border-primary/20 shadow-xl z-30 flex flex-col gap-sm animate-fade-in bg-[#090e1a]/95 text-[#dae2fd]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-[20px] animate-spin">
                sync
              </span>
              <span className="font-label-sm font-bold text-on-surface text-xs text-white">Drive Ingest Sync</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary pulse-dot"></span>
          </div>
          <div className="text-body-md text-on-surface-variant text-xs text-slate-400">Syncing Drive documents into vector index...</div>
          <div className="flex items-end justify-between text-[10px] font-mono">
            <div className="text-primary">{indexed} / {total} docs</div>
            <div className="text-on-surface-variant">{healthRatio}%</div>
          </div>
          <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${healthRatio}%` }}></div>
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
