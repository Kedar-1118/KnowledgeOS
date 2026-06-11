// apps/frontend/src/pages/DashboardPage.tsx
/**
 * Dashboard — Phase 1 version with sync status, recent activity, and key metrics.
 * Full dashboard with all widgets will be built in Phase 5.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FolderSync,
} from 'lucide-react';

import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface SyncStatus {
  isRunning: boolean;
  lastSyncAt: string | null;
  documents: {
    total: number;
    pending: number;
    processing: number;
    indexed: number;
    failed: number;
  };
  activeJobs: number;
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Fetch sync status (polling every 30s)
  const { data: syncStatus, isLoading } = useQuery<SyncStatus>({
    queryKey: ['drive-status'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SyncStatus }>('/api/drive/status');
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  // Sync now mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/drive/sync-now');
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drive-status'] });
    },
  });

  const greeting = getGreeting();

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-semibold mb-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {greeting}, {user?.name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Here&apos;s what&apos;s happening with your knowledge base.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Documents Indexed"
          value={syncStatus?.documents.indexed ?? 0}
          icon={<FileText size={18} />}
          color="var(--color-accent-teal)"
          loading={isLoading}
        />
        <MetricCard
          label="Processing"
          value={syncStatus?.documents.processing ?? 0}
          icon={<Loader2 size={18} className={syncStatus?.documents.processing ? 'animate-spin' : ''} />}
          color="var(--color-accent-purple)"
          loading={isLoading}
        />
        <MetricCard
          label="Pending"
          value={syncStatus?.documents.pending ?? 0}
          icon={<Clock size={18} />}
          color="var(--color-accent-amber)"
          loading={isLoading}
        />
        <MetricCard
          label="Failed"
          value={syncStatus?.documents.failed ?? 0}
          icon={<AlertCircle size={18} />}
          color="var(--color-error)"
          loading={isLoading}
        />
      </div>

      {/* Sync Status Card */}
      <div
        className="rounded-xl p-6 mb-6 card-hover"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-surface-border)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(29, 158, 117, 0.1)' }}
            >
              <FolderSync size={18} style={{ color: 'var(--color-accent-teal)' }} />
            </div>
            <div>
              <h2
                className="text-sm font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Google Drive Sync
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {syncStatus?.isRunning ? (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                      style={{ backgroundColor: 'var(--color-accent-teal)' }}
                    />
                    Syncing...
                  </span>
                ) : syncStatus?.lastSyncAt ? (
                  `Last synced ${formatRelativeTime(syncStatus.lastSyncAt)}`
                ) : (
                  'Not yet synced'
                )}
              </p>
            </div>
          </div>

          <button
            id="sync-now-button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || syncStatus?.isRunning}
            className="btn-primary"
            style={{
              opacity: syncMutation.isPending || syncStatus?.isRunning ? 0.6 : 1,
              cursor: syncMutation.isPending || syncStatus?.isRunning ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw
              size={15}
              className={syncMutation.isPending ? 'animate-spin' : ''}
            />
            {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        {/* Sync progress bars */}
        {syncStatus && syncStatus.documents.total > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Processing pipeline
              </span>
              <span
                className="text-xs font-mono"
                style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {syncStatus.documents.indexed}/{syncStatus.documents.total} indexed
              </span>
            </div>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(syncStatus.documents.indexed / syncStatus.documents.total) * 100}%`,
                  background: 'linear-gradient(90deg, var(--color-accent-teal), var(--color-accent-purple))',
                }}
              />
            </div>
          </div>
        )}

        {/* Active jobs */}
        {syncStatus && syncStatus.activeJobs > 0 && (
          <p
            className="mt-3 text-xs flex items-center gap-1.5"
            style={{ color: 'var(--color-accent-purple)' }}
          >
            <Loader2 size={12} className="animate-spin" />
            {syncStatus.activeJobs} processing job{syncStatus.activeJobs !== 1 ? 's' : ''} active
          </p>
        )}
      </div>

      {/* Getting Started Card (shown when no documents) */}
      {!isLoading && (syncStatus?.documents.total ?? 0) === 0 && (
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
              background: 'linear-gradient(135deg, rgba(127, 119, 221, 0.15), rgba(29, 158, 117, 0.15))',
            }}
          >
            <FileText size={28} style={{ color: 'var(--color-accent-purple)' }} />
          </div>
          <h3
            className="text-lg font-semibold mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            No documents yet
          </h3>
          <p
            className="text-sm mb-6 max-w-md mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Create a folder called <code
              className="px-1.5 py-0.5 rounded text-xs font-mono"
              style={{
                backgroundColor: 'rgba(127, 119, 221, 0.1)',
                color: 'var(--color-accent-purple)',
                fontFamily: 'var(--font-mono)',
              }}
            >KnowledgeOS</code> in your Google Drive and add some PDF, TXT, or Markdown files. Then click Sync Now.
          </p>
          <button
            onClick={() => syncMutation.mutate()}
            className="btn-primary"
          >
            <RefreshCw size={15} />
            Sync Now
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Metric Card Component ───

function MetricCard({
  label,
  value,
  icon,
  color,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  loading: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 card-hover"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-surface-border)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
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
      {loading ? (
        <div className="skeleton h-8 w-16" />
      ) : (
        <span
          className="text-2xl font-semibold"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

// ─── Helpers ───

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
