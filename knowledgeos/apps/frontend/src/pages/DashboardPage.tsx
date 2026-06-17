// apps/frontend/src/pages/DashboardPage.tsx
/**
 * DashboardPage — Premium Bento Grid Dashboard.
 * Focuses on real-time data ingestion stats and actual index history.
 */

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

export function DashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ─── Query: Live Sync Status ───
  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['drive-status'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SyncStatus }>('/api/drive/status');
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  // ─── Query: Recently Ingested Documents ───
  const { data: recentData, isLoading: isRecentLoading } = useQuery<ListResponse>({
    queryKey: ['recent-documents'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ListResponse }>('/api/documents?limit=5');
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  // ─── Mutation: Synchronize Now ───
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/drive/sync-now');
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drive-status'] });
      void queryClient.invalidateQueries({ queryKey: ['recent-documents'] });
    },
  });

  const greeting = getGreeting();
  const indexed = syncStatus?.documents.indexed ?? 0;
  const total = syncStatus?.documents.total ?? 0;
  const pending = syncStatus?.documents.pending ?? 0;
  const failed = syncStatus?.documents.failed ?? 0;
  const processing = syncStatus?.documents.processing ?? 0;

  const healthRatio = total > 0 ? Math.round((indexed / total) * 100) : 0;
  const strokeDashoffset = 251.32 - (251.32 * (healthRatio / 100));

  const isSyncing = syncStatus?.isRunning || syncMutation.isPending;

  return (
    <div className="space-y-2xl animate-fade-in select-none">
      {/* Greeting Header */}
      <header className="flex flex-col gap-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-xs">
          <h2 className="font-display-lg text-display-lg font-semibold text-on-surface">
            {greeting}, {user?.name?.split(' ')[0] ?? 'Alex'}.
          </h2>
          <p className="text-on-surface-variant font-body-lg text-sm">Here's a snapshot of your intelligence network today.</p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={isSyncing}
          className="px-lg py-sm bg-primary-container text-on-primary-container font-label-sm text-xs rounded hover:opacity-90 transition-all border-t border-white/10 active:scale-95 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          {isSyncing ? 'Syncing...' : 'Sync drive'}
        </button>
      </header>

      {/* Key Stat Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-lg">
        <div className="glass-surface p-lg rounded-xl flex flex-col gap-sm group hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider text-[11px] font-bold">Documents Indexed</span>
            <span className="material-symbols-outlined text-primary">description</span>
          </div>
          <div className="text-headline-lg font-display-lg text-on-surface text-3xl font-bold">{indexed}</div>
          <div className="text-secondary font-label-sm text-[11px] font-bold">Files cataloged: {total}</div>
        </div>

        <div className="glass-surface p-lg rounded-xl flex flex-col gap-sm group hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider text-[11px] font-bold">Sync Coverage</span>
            <span className="material-symbols-outlined text-primary">database</span>
          </div>
          <div className="text-headline-lg font-display-lg text-on-surface text-3xl font-bold">{healthRatio}%</div>
          <div className="flex items-center gap-xs">
            <div className="h-1 flex-1 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${healthRatio}%` }}></div>
            </div>
            <span className="text-on-surface-variant font-label-sm text-[11px] font-bold">{healthRatio}%</span>
          </div>
        </div>

        <div className="glass-surface p-lg rounded-xl flex flex-col gap-sm group hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider text-[11px] font-bold">Processing Queue</span>
            <span className="material-symbols-outlined text-primary">bolt</span>
          </div>
          <div className="text-headline-lg font-display-lg text-on-surface text-3xl font-bold">{processing}</div>
          <div className="text-on-surface-variant font-label-sm text-[11px] font-bold">Pending parser: {pending}</div>
        </div>

        <div className="glass-surface p-lg rounded-xl flex flex-col gap-sm group hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider text-[11px] font-bold">System Status</span>
            <div className={`w-2 h-2 rounded-full pulse-dot ${failed > 0 ? 'bg-error' : 'bg-secondary'}`}></div>
          </div>
          <div className="text-headline-lg font-display-lg text-on-surface text-3xl font-bold">
            {failed > 0 ? 'Degraded' : 'Active'}
          </div>
          <div className="text-secondary font-label-sm text-[11px] font-bold">
            {failed > 0 ? `${failed} indexing faults` : 'All clusters operational'}
          </div>
        </div>
      </section>

      {/* Main Bento Row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-lg items-stretch">
        {/* Coverage Gauge card */}
        <section className="xl:col-span-4 glass-surface p-xl rounded-xl flex flex-col items-center justify-center gap-lg">
          <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest text-[11px] font-bold self-start">Knowledge Coverage</h3>
          <div className="relative w-60 h-60 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle className="text-surface-container-high" cx="50" cy="50" fill="none" r="40" stroke="currentColor" strokeWidth="8"></circle>
              <circle
                className="text-primary gauge-path"
                cx="50"
                cy="50"
                fill="none"
                r="40"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="8"
                style={{ strokeDashoffset: strokeDashoffset }}
              ></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="font-display-xl text-display-lg text-on-surface text-3xl font-bold">{healthRatio}%</span>
              <span className="font-label-sm text-on-surface-variant text-[10px] font-bold mt-1">OPTIMIZED</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-md w-full pt-md">
            <div className="text-center p-md bg-surface-container-low rounded-lg">
              <div className="text-on-surface font-semibold text-sm">{total}</div>
              <div className="text-label-sm text-on-surface-variant text-[10px] font-bold">Sources</div>
            </div>
            <div className="text-center p-md bg-surface-container-low rounded-lg">
              <div className="text-on-surface font-semibold text-sm">{indexed}</div>
              <div className="text-label-sm text-on-surface-variant text-[10px] font-bold">Indexed</div>
            </div>
          </div>
        </section>

        {/* Recent Document Logs table */}
        <section className="xl:col-span-8 glass-surface rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-lg border-b border-outline-variant flex items-center justify-between">
              <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest text-[11px] font-bold">Recent Documents</h3>
              <button onClick={() => navigate('/library')} className="text-primary font-label-sm hover:underline text-xs cursor-pointer font-bold">
                View All
              </button>
            </div>
            {isRecentLoading ? (
              <div className="p-lg space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : recentData && recentData.documents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-label-sm text-on-surface-variant border-b border-outline-variant/30 text-[10px] font-bold">
                      <th className="p-lg font-medium">FILENAME</th>
                      <th className="p-lg font-medium">FORMAT</th>
                      <th className="p-lg font-medium">SIZE</th>
                      <th className="p-lg font-medium">STATUS</th>
                      <th className="p-lg font-medium text-right">INGESTED</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-xs">
                    {recentData.documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-lg">
                          <div className="flex items-center gap-md min-w-0 max-w-xs sm:max-w-md">
                            <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-primary flex-shrink-0">
                              <span className="material-symbols-outlined text-[18px]">
                                {doc.fileType === 'PDF' ? 'picture_as_pdf' : doc.fileType === 'IMAGE' ? 'image' : 'description'}
                              </span>
                            </div>
                            <span className="text-on-surface font-medium truncate block">{doc.title}</span>
                          </div>
                        </td>
                        <td className="p-lg text-on-surface-variant font-code text-[11px] font-bold">{doc.fileType}</td>
                        <td className="p-lg text-on-surface-variant font-mono text-[11px]">{formatBytes(doc.fileSizeBytes)}</td>
                        <td className="p-lg">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase ${
                            doc.status === 'INDEXED' ? 'bg-secondary-container/20 text-secondary' :
                            doc.status === 'PROCESSING' ? 'bg-primary-container/20 text-primary animate-pulse' :
                            doc.status === 'PENDING' ? 'bg-amber-400/10 text-amber-400' : 'bg-error/10 text-error'
                          }`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="p-lg text-right text-on-surface-variant font-mono text-[11px]">{formatTime(doc.createdAt)}</td>
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

          <div className="p-lg border-t border-outline-variant/30 flex items-center justify-between text-xs text-on-surface-variant bg-surface-container-lowest/30">
            <span>Automatic Sync Listener: <span className="text-secondary font-bold">Listening</span></span>
            <span className="font-mono text-[11px]">{syncStatus?.lastSyncAt ? `Last run: ${formatTime(syncStatus.lastSyncAt)}` : ''}</span>
          </div>
        </section>
      </div>

      {/* Syncing Widget popup (Fixed Corner) — visible only when sync process is running */}
      {isSyncing && (
        <div className="fixed bottom-margin-desktop right-margin-desktop w-64 glass-surface rounded-xl p-md border border-primary/20 shadow-xl z-30 flex flex-col gap-sm animate-fade-in bg-surface-container-lowest">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-[20px] animate-spin" style={{ animationDuration: '3s' }}>
                sync
              </span>
              <span className="font-label-sm font-bold text-on-surface text-xs">Drive Ingest Sync</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary pulse-dot"></span>
          </div>
          <div className="text-body-md text-on-surface-variant text-xs">Syncing Drive documents into vector index...</div>
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

/* HELPER FUNCTIONS */

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