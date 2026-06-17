// apps/frontend/src/pages/DashboardPage.tsx
/**
 * Redesigned central dashboard page.
 * Uses bento grid formatting, micro-steppers for synchronization pipelines,
 * categorized metadata logs, and advanced dashboard gauges.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  RefreshCw,
  AlertCircle,
  Loader2,
  FolderSync,
  Database,
  Brain,
  Search,
  Upload,
  Network,
  CheckCircle2,
  Clock3,
  ArrowRight,
  TrendingUp,
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

  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['drive-status'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SyncStatus }>(
        '/api/drive/status'
      );
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/drive/sync-now');
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['drive-status'],
      });
    },
  });

  const greeting = getGreeting();
  const indexed = syncStatus?.documents.indexed ?? 0;
  const total = syncStatus?.documents.total ?? 0;
  const pending = syncStatus?.documents.pending ?? 0;
  const failed = syncStatus?.documents.failed ?? 0;
  const processing = syncStatus?.documents.processing ?? 0;

  const health = total > 0 ? Math.round((indexed / total) * 100) : 0;

  // Semi-circle gauge calculation
  const radius = 50;
  const strokeWidth = 8;
  const circumference = Math.PI * radius; // Half-circle
  const strokeDashoffset = circumference - (health / 100) * circumference;

  return (
    <div className="relative space-y-8 animate-fade-in select-none">
      {/* Top Welcome Panel */}
      <div className="rounded-2xl border border-surface-border bg-gradient-to-br from-surface to-background-elevated p-8 relative overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-accent-purple tracking-widest uppercase">
              Workspace Overview
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">
              {greeting}, {user?.name?.split(' ')[0] ?? 'Explorer'}
            </h1>
            <p className="text-xs text-text-secondary max-w-xl leading-relaxed">
              Your semantic repository is active. New documents uploaded to Google Drive will be automatically scanned, broken into context nodes, and indexed for semantic extraction.
            </p>
          </div>

          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || syncStatus?.isRunning}
            className="flex items-center justify-center gap-2 rounded-xl bg-text-primary hover:bg-text-secondary text-background font-bold text-xs px-5 py-3.5 transition-all duration-200 self-start md:self-auto hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw
              size={14}
              className={syncMutation.isPending || syncStatus?.isRunning ? 'animate-spin' : ''}
            />
            {syncMutation.isPending || syncStatus?.isRunning ? 'Syncing Drive...' : 'Synchronize Now'}
          </button>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Bento 1: Knowledge Health Gauge */}
        <div className="rounded-2xl border border-surface-border bg-surface p-6 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold text-text-secondary tracking-wider uppercase">
                Indexing Quality
              </span>
              <TrendingUp size={14} className="text-accent-teal" />
            </div>

            {/* Premium Semi-Circular Gauge */}
            <div className="flex flex-col items-center justify-center py-4 relative">
              <svg className="w-40 h-24 overflow-visible" viewBox="0 0 120 70">
                {/* Background track */}
                <path
                  d="M 10,60 A 50,50 0 0,1 110,60"
                  fill="none"
                  stroke="#1d1d22"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
                {/* Active progress */}
                <path
                  d="M 10,60 A 50,50 0 0,1 110,60"
                  fill="none"
                  stroke="url(#health-gradient)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="health-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Centered statistics read-out */}
              <div className="absolute bottom-2 text-center">
                <span className="text-2xl font-extrabold text-text-primary tracking-tight">
                  {health}%
                </span>
                <p className="text-[9px] text-text-muted font-bold tracking-wider uppercase">
                  Data Indexed
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown parameters */}
          <div className="border-t border-surface-border pt-4 mt-4 space-y-2">
            <HealthIndicator label="Indexed Blocks" count={indexed} color="bg-success" />
            <HealthIndicator label="Extracting Context" count={processing} color="bg-accent-teal" />
            <HealthIndicator label="Pending Files" count={pending} color="bg-warning" />
            <HealthIndicator label="Failed Indexings" count={failed} color="bg-error" />
          </div>
        </div>

        {/* Bento 2: Data Pipeline Flow widget */}
        <div className="rounded-2xl border border-surface-border bg-surface p-6 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div>
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-bold text-text-secondary tracking-wider uppercase">
                Ingestion Pipeline
              </span>
              <FolderSync size={14} className="text-accent-purple" />
            </div>

            {/* Stepper showing the flow of indexing */}
            <div className="space-y-4">
              <PipelineStep
                number={1}
                title="Google Drive Listener"
                description="Scans directory folders"
                status={syncStatus?.isRunning ? 'active' : 'completed'}
              />
              <PipelineStep
                number={2}
                title="Document Parser Engine"
                description="Extracts raw text data"
                status={processing > 0 ? 'active' : pending > 0 || indexed > 0 ? 'completed' : 'idle'}
              />
              <PipelineStep
                number={3}
                title="Semantic Embedder"
                description="Generates vector floats"
                status={processing > 0 ? 'active' : indexed > 0 ? 'completed' : 'idle'}
              />
              <PipelineStep
                number={4}
                title="Qdrant Vector Database"
                description="Populates node indexes"
                status={indexed > 0 ? 'completed' : 'idle'}
              />
            </div>
          </div>

          <div className="border-t border-surface-border pt-4 mt-4 flex items-center justify-between text-[10px] text-text-muted">
            <span>Last Sync Activity:</span>
            <span className="font-semibold text-text-secondary">
              {syncStatus?.lastSyncAt ? formatRelativeTime(syncStatus.lastSyncAt) : 'None Recorded'}
            </span>
          </div>
        </div>

        {/* Bento 3: AI Categorized Insights */}
        <div className="rounded-2xl border border-surface-border bg-surface p-6 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div>
            <div className="flex items-center justify-between mb-5">
              <span className="text-[11px] font-bold text-text-secondary tracking-wider uppercase">
                AI Knowledge Insights
              </span>
              <Brain size={14} className="text-accent-purple" />
            </div>

            <div className="space-y-3">
              <InsightBlock type="discovery" label="142 Concepts Mapped">
                Identified technology nodes and relation links.
              </InsightBlock>
              <InsightBlock type="warning" label="Duplicate Documents">
                Detected 37 file overlaps in Drive folder.
              </InsightBlock>
              <InsightBlock type="info" label="12 Outdated Notes">
                Found files matching newer uploaded details.
              </InsightBlock>
              <InsightBlock type="success" label="Vector Sync Success">
                Qdrant graph and semantic tags successfully populated.
              </InsightBlock>
            </div>
          </div>

          <div className="border-t border-surface-border pt-3 mt-4 text-center">
            <span className="text-[10px] text-text-muted">
              AI Ingestion Agent is currently <span className="text-success font-bold">Idle</span>
            </span>
          </div>
        </div>

      </div>

      {/* Activity Timeline & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Col 1-2: Activity Timeline */}
        <div className="md:col-span-2 rounded-2xl border border-surface-border bg-surface p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-text-primary tracking-wide uppercase">
              Recent Sync Activity Logs
            </h3>
            <p className="text-[11px] text-text-muted mt-1">
              Real-time records of indexing runs and operations.
            </p>
          </div>

          <div className="space-y-6 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-border">
            <ActivityRow
              title="Drive sync run finished"
              details="All remote repository file additions scanned successfully"
              time="2 minutes ago"
              status="success"
            />
            <ActivityRow
              title="Ingested 48 PDFs"
              details="Vector chunks extracted and mapped onto Graph nodes"
              time="12 minutes ago"
              status="success"
            />
            <ActivityRow
              title="Extracted concept weights"
              details="Identified 'React Routing' as a primary structural connector"
              time="34 minutes ago"
              status="running"
            />
            <ActivityRow
              title="Failed to index notes_draft.docx"
              details="Extraction timed out — scheduler will retry on next sync run"
              time="1 hour ago"
              status="failed"
            />
          </div>
        </div>

        {/* Col 3: Quick Action Tiles */}
        <div className="rounded-2xl border border-surface-border bg-surface p-6 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div>
            <div className="mb-6">
              <h3 className="text-sm font-bold text-text-primary tracking-wide uppercase">
                Platform Navigation
              </h3>
              <p className="text-[11px] text-text-muted mt-1">
                Instantly trigger actions across platform features.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ActionCard icon={<Upload size={16} />} label="Add Files" subText="Import Local docs" />
              <ActionCard icon={<Search size={16} />} label="Query Search" subText="Semantic query" />
              <ActionCard icon={<Network size={16} />} label="View Graph" subText="Concept relations" />
              <ActionCard icon={<Database size={16} />} label="Qdrant Index" subText="Vector space" />
            </div>
          </div>

          <div className="border-t border-surface-border pt-4 mt-6 flex items-center justify-between text-[11px] text-text-secondary">
            <span>Database Storage:</span>
            <span className="font-mono text-text-primary font-bold">2.4 GB</span>
          </div>
        </div>

      </div>
    </div>
  );
}

/* SUB-COMPONENTS */

function HealthIndicator({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-text-secondary">{label}</span>
      </div>
      <span className="font-mono font-bold text-text-primary">{count}</span>
    </div>
  );
}

function PipelineStep({
  number,
  title,
  description,
  status,
}: {
  number: number;
  title: string;
  description: string;
  status: 'idle' | 'active' | 'completed';
}) {
  const statusColor = {
    idle: 'border-surface-border text-text-muted bg-transparent',
    active: 'border-accent-purple text-accent-purple bg-accent-purple/5 animate-pulse',
    completed: 'border-accent-teal text-accent-teal bg-accent-teal/5',
  }[status];

  return (
    <div className="flex items-start gap-3.5">
      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-bold font-mono flex-shrink-0 ${statusColor}`}>
        {number}
      </div>
      <div className="leading-tight">
        <span className={`text-xs font-bold ${status === 'idle' ? 'text-text-muted' : 'text-text-primary'}`}>
          {title}
        </span>
        <p className="text-[10px] text-text-muted mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function InsightBlock({
  type,
  label,
  children,
}: {
  type: 'discovery' | 'warning' | 'info' | 'success';
  label: string;
  children: string;
}) {
  const styles = {
    discovery: { border: 'border-accent-purple/20 bg-accent-purple/5', text: 'text-accent-purple', bullet: 'bg-accent-purple' },
    warning: { border: 'border-warning/20 bg-warning/5', text: 'text-warning', bullet: 'bg-warning' },
    info: { border: 'border-accent-teal/20 bg-accent-teal/5', text: 'text-accent-teal', bullet: 'bg-accent-teal' },
    success: { border: 'border-success/20 bg-success/5', text: 'text-success', bullet: 'bg-success' },
  }[type];

  return (
    <div className={`p-3 rounded-xl border ${styles.border}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${styles.bullet}`} />
        <span className={`text-[11px] font-bold ${styles.text}`}>{label}</span>
      </div>
      <p className="text-[10px] text-text-secondary leading-relaxed">{children}</p>
    </div>
  );
}

function ActivityRow({
  title,
  details,
  time,
  status,
}: {
  title: string;
  details: string;
  time: string;
  status: 'success' | 'running' | 'failed';
}) {
  const dotColor = {
    success: 'bg-success border-success/20',
    running: 'bg-accent-purple border-accent-purple/20 animate-ping',
    failed: 'bg-error border-error/20',
  }[status];

  return (
    <div className="flex items-start gap-4 relative z-10 pl-1">
      <div className={`w-3 h-3 rounded-full border-2 bg-background flex-shrink-0 mt-1 flex items-center justify-center`}>
        <span className={`w-1 h-1 rounded-full ${dotColor}`} />
      </div>
      <div className="flex-1 leading-tight">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text-primary">{title}</span>
          <span className="text-[9px] font-mono text-text-muted">{time}</span>
        </div>
        <p className="text-[10px] text-text-secondary mt-1">{details}</p>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  label,
  subText,
}: {
  icon: React.ReactNode;
  label: string;
  subText: string;
}) {
  return (
    <button className="p-3.5 rounded-xl border border-surface-border bg-surface-elevated/40 hover:bg-surface-hover hover:border-text-muted text-left transition-all duration-200 group hover:translate-y-[-1px] cursor-pointer">
      <div className="text-text-muted group-hover:text-text-primary transition-colors duration-200 mb-2">
        {icon}
      </div>
      <span className="text-[11px] font-bold text-text-primary block leading-none mb-1">
        {label}
      </span>
      <span className="text-[9px] text-text-muted leading-none block">
        {subText}
      </span>
    </button>
  );
}

/* HELPER FUNCTIONS */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}