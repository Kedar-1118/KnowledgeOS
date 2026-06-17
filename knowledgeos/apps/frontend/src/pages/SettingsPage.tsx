// apps/frontend/src/pages/SettingsPage.tsx
/**
 * Redesigned Settings Page.
 * Implements tabbed navigation (Account, Integrations, Preferences).
 * Features interactive toggle switches, profile tags, and vector index sync status.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Settings,
  User,
  HardDrive,
  Bell,
  Shield,
  Palette,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Check,
  ExternalLink,
} from 'lucide-react';

import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface SyncStatus {
  isRunning: boolean;
  lastSyncAt: string | null;
  driveFolderId?: string | null;
  driveFolderUrl?: string | null;
  documents: {
    total: number;
    indexed: number;
  };
}

export function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'drive' | 'prefs'>('profile');

  // Preferences interactive states
  const [reminders, setReminders] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['drive-status'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SyncStatus }>('/api/drive/status');
      return res.data.data;
    },
  });

  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-6 select-none">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-text-primary uppercase tracking-wider">
          System Settings
        </h1>
        <p className="text-xs text-text-secondary mt-1">
          Configure account properties, integrations, and preferences.
        </p>
      </div>

      {/* Tabs navigation list */}
      <div className="flex bg-surface border border-surface-border rounded-xl p-1 max-w-md">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-surface-hover text-accent-teal border border-surface-border shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <User size={13} />
          <span>Account Profile</span>
        </button>
        <button
          onClick={() => setActiveTab('drive')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'drive'
              ? 'bg-surface-hover text-accent-teal border border-surface-border shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <HardDrive size={13} />
          <span>Google Drive</span>
        </button>
        <button
          onClick={() => setActiveTab('prefs')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'prefs'
              ? 'bg-surface-hover text-accent-teal border border-surface-border shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Palette size={13} />
          <span>Preferences</span>
        </button>
      </div>

      {/* Content panes based on activeTab */}
      <div className="bg-surface rounded-2xl border border-surface-border p-6 shadow-sm min-h-[300px] flex flex-col justify-between">
        
        {/* TAB 1: Profile and Account details */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-surface-border pb-4">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Google Authorized Account
              </h3>
              <p className="text-[11px] text-text-muted mt-1">
                Account properties synced during authorization.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-background-elevated p-4 rounded-xl border border-surface-border max-w-xl">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-12 h-12 rounded-full border border-surface-border" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-accent-purple/10 border border-accent-purple/20 text-accent-purple flex items-center justify-center text-sm font-bold font-mono">
                  {user?.name?.charAt(0) ?? '?'}
                </div>
              )}
              <div className="leading-tight">
                <span className="text-xs font-bold text-text-primary block">
                  {user?.name || 'Authorized User'}
                </span>
                <p className="text-[11px] text-text-secondary mt-1">
                  {user?.email || 'No email synced'}
                </p>
                <span className="text-[9px] font-bold text-success bg-success/5 border border-success/15 px-2 py-0.5 rounded-full inline-block mt-2">
                  Active Member
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Google Drive syncing details */}
        {activeTab === 'drive' && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-surface-border pb-4">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Google Drive Synchronization
              </h3>
              <p className="text-[11px] text-text-muted mt-1">
                Vector space parameters and cloud indexing statistics.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-surface-border bg-background-elevated space-y-3">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                  Connector Parameters
                </span>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Connection Status:</span>
                    <span className="font-semibold text-success flex items-center gap-1">
                      <CheckCircle2 size={12} /> Syncing
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Indexed Documents:</span>
                    <span className="font-mono text-text-primary font-bold">
                      {syncStatus?.documents.indexed ?? 0} files
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Total Folder Files:</span>
                    <span className="font-mono text-text-primary font-bold">
                      {syncStatus?.documents.total ?? 0} files
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Last Sync Run:</span>
                    <span className="text-text-primary font-medium">
                      {syncStatus?.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data disclaimer details */}
              <div className="p-4 rounded-xl border border-surface-border bg-background-elevated flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">
                    Repository Folder Context
                  </span>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    The platform scans only the document catalog located under the <code className="px-1.5 py-0.5 rounded bg-accent-purple/10 border border-accent-purple/20 text-accent-purple font-mono text-[10px]">KnowledgeOS/</code> root workspace folder inside Google Drive.
                  </p>
                  {syncStatus?.driveFolderUrl && (
                    <a
                      href={syncStatus.driveFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-accent-teal hover:text-accent-teal/80 underline font-bold mt-3 cursor-pointer"
                    >
                      <ExternalLink size={12} />
                      Open KnowledgeOS folder
                    </a>
                  )}
                </div>
                <div className="text-[10px] text-text-muted flex items-center gap-1.5 mt-4">
                  <Shield size={12} className="text-accent-teal" /> Read-only sync credentials.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Preferences and configurations checkboxes */}
        {activeTab === 'prefs' && (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-surface-border pb-4">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Preferences Configurations
              </h3>
              <p className="text-[11px] text-text-muted mt-1">
                Customize workspace display layouts and ingestion runs.
              </p>
            </div>

            <div className="space-y-4 max-w-xl">
              {/* Reminder switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-surface-border bg-background-elevated">
                <div className="leading-tight">
                  <span className="text-xs font-bold text-text-primary">
                    Daily review email reminders
                  </span>
                  <p className="text-[10px] text-text-muted mt-1">
                    Send spaced repetition study cards schedule warnings.
                  </p>
                </div>
                <button
                  onClick={() => setReminders(!reminders)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                    reminders ? 'bg-accent-teal justify-end' : 'bg-surface-border justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-background shadow-md block" />
                </button>
              </div>

              {/* Auto Ingest Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-surface-border bg-background-elevated">
                <div className="leading-tight">
                  <span className="text-xs font-bold text-text-primary">
                    Continuous sync listener
                  </span>
                  <p className="text-[10px] text-text-muted mt-1">
                    Auto-trigger parsing algorithms on file uploads inside Google Drive.
                  </p>
                </div>
                <button
                  onClick={() => setAutoSync(!autoSync)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                    autoSync ? 'bg-accent-teal justify-end' : 'bg-surface-border justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-background shadow-md block" />
                </button>
              </div>

              {/* Compact Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-surface-border bg-background-elevated">
                <div className="leading-tight">
                  <span className="text-xs font-bold text-text-primary">
                    Compact list view rendering
                  </span>
                  <p className="text-[10px] text-text-muted mt-1">
                    Squeeze padding layouts inside document tables.
                  </p>
                </div>
                <button
                  onClick={() => setCompactMode(!compactMode)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                    compactMode ? 'bg-accent-teal justify-end' : 'bg-surface-border justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-background shadow-md block" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer specifications info */}
        <div className="border-t border-surface-border pt-4 mt-8 flex items-center justify-between text-[10px] text-text-muted flex-shrink-0">
          <span>KnowledgeOS v0.1.0 · Product Engine Logs Verified</span>
          <span className="flex items-center gap-1 text-accent-teal">
            <Check size={11} /> Vector Space Active
          </span>
        </div>

      </div>
    </div>
  );
}
