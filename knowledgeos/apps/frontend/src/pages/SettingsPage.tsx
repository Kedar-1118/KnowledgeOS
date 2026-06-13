// apps/frontend/src/pages/SettingsPage.tsx
/**
 * Settings Page — User profile, Drive connection status, and preferences.
 */

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
} from 'lucide-react';

import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface SyncStatus {
  isRunning: boolean;
  lastSyncAt: string | null;
  documents: {
    total: number;
    indexed: number;
  };
}

export function SettingsPage() {
  const { user } = useAuthStore();

  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['drive-status'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SyncStatus }>('/api/drive/status');
      return res.data.data;
    },
  });

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Settings
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Manage your account and preferences
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Profile */}
        <SettingsSection
          icon={<User size={18} />}
          title="Profile"
          description="Your Google account information"
        >
          <div className="flex items-center gap-4 p-4">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-14 h-14 rounded-full" />
            ) : (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-medium"
                style={{ backgroundColor: 'rgba(29,158,117,0.15)', color: 'var(--color-accent-teal)' }}
              >
                {user?.name?.charAt(0) ?? '?'}
              </div>
            )}
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {user?.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {user?.email}
              </p>
            </div>
          </div>
        </SettingsSection>

        {/* Drive Connection */}
        <SettingsSection
          icon={<HardDrive size={18} />}
          title="Google Drive"
          description="Drive sync status and document statistics"
        >
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Connection Status
              </span>
              <span className="flex items-center gap-1.5 text-sm">
                <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
                <span style={{ color: 'var(--color-success)' }}>Connected</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Total Documents
              </span>
              <span
                className="text-sm font-mono"
                style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
              >
                {syncStatus?.documents.total ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Indexed
              </span>
              <span
                className="text-sm font-mono"
                style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
              >
                {syncStatus?.documents.indexed ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Last Sync
              </span>
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {syncStatus?.lastSyncAt
                  ? new Date(syncStatus.lastSyncAt).toLocaleString()
                  : 'Never'}
              </span>
            </div>
          </div>
        </SettingsSection>

        {/* Preferences */}
        <SettingsSection
          icon={<Palette size={18} />}
          title="Appearance"
          description="Theme and display preferences"
        >
          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Theme
              </span>
              <span
                className="text-sm px-3 py-1 rounded-md"
                style={{
                  backgroundColor: 'rgba(127,119,221,0.1)',
                  color: 'var(--color-accent-purple)',
                }}
              >
                Dark (Default)
              </span>
            </div>
          </div>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection
          icon={<Bell size={18} />}
          title="Notifications"
          description="Review reminders and sync alerts"
        >
          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Daily review reminders
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <AlertCircle size={12} /> Coming soon
              </span>
            </div>
          </div>
        </SettingsSection>

        {/* Privacy */}
        <SettingsSection
          icon={<Shield size={18} />}
          title="Privacy & Data"
          description="How your data is handled"
        >
          <div className="p-4">
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              KnowledgeOS only reads files from your <code
                className="px-1 py-0.5 rounded text-xs"
                style={{
                  backgroundColor: 'rgba(127,119,221,0.1)',
                  color: 'var(--color-accent-purple)',
                  fontFamily: 'var(--font-mono)',
                }}
              >KnowledgeOS/</code> Google Drive folder.
              Your data is processed locally and stored securely.
              Embeddings are stored in Qdrant and are not shared with third parties.
            </p>
          </div>
        </SettingsSection>
      </div>

      {/* Version info */}
      <div className="mt-8 text-center">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          KnowledgeOS v0.1.0 · Phase 1-5 Complete
        </p>
      </div>
    </div>
  );
}

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-surface-border)',
      }}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--color-surface-border)' }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'rgba(29,158,117,0.1)', color: 'var(--color-accent-teal)' }}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
