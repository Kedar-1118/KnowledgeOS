// apps/frontend/src/components/Sidebar.tsx
/**
 * Sidebar — Clean navigation sidebar with active link indicators,
 * live ingestion pipeline statuses, and user session management.
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

interface SyncStatus {
  isRunning: boolean;
  documents: {
    total: number;
    indexed: number;
    processing: number;
  };
}

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const mainNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/library', label: 'Library', icon: 'folder_open' },
  { to: '/search', label: 'Search', icon: 'search' },
  { to: '/ask', label: 'Q&A', icon: 'smart_toy' },
  { to: '/graph', label: 'Knowledge Graph', icon: 'hub' },
  { to: '/recommendations', label: 'Recommendations', icon: 'sparkles' },
  { to: '/revision', label: 'Revision', icon: 'psychology' },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Retrieve live connector stats
  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['drive-status'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SyncStatus }>('/api/drive/status');
      return res.data.data;
    },
    refetchInterval: 15000,
  });

  // Trigger sync manually via New Ingestion button
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/drive/sync-now');
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drive-status'] });
    },
  });

  const isSyncing = syncStatus?.isRunning || syncMutation.isPending;
  const processingCount = syncStatus?.documents.processing ?? 0;

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-surface-container-lowest border-r border-outline-variant flex flex-col py-lg z-50 select-none">
      {/* Brand Title */}
      <div className="px-lg mb-2xl">
        <h1 
          className="font-display-lg text-headline-lg font-bold text-primary tracking-tight cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          Nexus AI
        </h1>
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mt-xs">
          Enterprise Suite
        </p>
      </div>

      {/* Main Nav Links */}
      <nav className="flex-1 px-md space-y-xs overflow-y-auto">
        {mainNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-md px-4 py-2 transition-transform active:scale-[0.98] ${
                isActive
                  ? 'bg-white/5 border-l-2 border-primary text-primary font-medium'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            <span className="text-xs font-semibold">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Dynamic Sync Status Widget */}
      <div className="mx-4 my-2 p-3 rounded-lg border border-outline-variant bg-surface/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isSyncing ? 'animate-ping bg-secondary' : processingCount > 0 ? 'animate-ping bg-tertiary' : 'bg-secondary'
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isSyncing ? 'bg-secondary' : processingCount > 0 ? 'bg-tertiary' : 'bg-secondary'
              }`} />
            </span>
            <span className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">
              Drive Sync
            </span>
          </div>
          {isSyncing && (
            <span className="material-symbols-outlined text-xs text-primary animate-spin">
              sync
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-on-surface-variant">
          <span>
            {isSyncing ? 'Fetching...' : processingCount > 0 ? `Parsing ${processingCount}` : 'Idle & Synced'}
          </span>
          <span className="font-mono text-[10px] font-semibold text-primary">
            {syncStatus?.documents.indexed ?? 0} Ingested
          </span>
        </div>
      </div>

      {/* Bottom Controls / Config */}
      <div className="mt-auto px-md pt-lg border-t border-outline-variant/30 flex flex-col gap-xs">
        <button
          onClick={() => syncMutation.mutate()}
          disabled={isSyncing}
          className="bg-primary text-on-primary-fixed font-bold py-sm rounded px-md mb-md hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>{isSyncing ? 'Syncing...' : 'New Ingestion'}</span>
        </button>

        <NavLink
          to="/status"
          className={({ isActive }) =>
            `flex items-center gap-md px-4 py-2 transition-transform active:scale-[0.98] ${
              isActive
                ? 'bg-white/5 border-l-2 border-primary text-primary font-medium'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors'
            }`
          }
        >
          <div className="relative flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">sensors</span>
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-secondary rounded-full pulse-dot"></span>
          </div>
          <span className="text-xs font-semibold">Status</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-md px-4 py-2 transition-transform active:scale-[0.98] ${
              isActive
                ? 'bg-white/5 border-l-2 border-primary text-primary font-medium'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors'
            }`
          }
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="text-xs font-semibold">Settings</span>
        </NavLink>

        {/* User Session Profile & Logout */}
        <div className="flex items-center justify-between px-3 py-2 bg-white/5 border border-outline-variant rounded-xl mt-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-outline-variant flex-shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center text-xs font-mono font-bold text-primary">
                  {user?.name?.charAt(0) ?? '?'}
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[10px] font-bold text-on-surface truncate">
                {user?.name ?? 'Alex'}
              </span>
              <span className="text-[9px] text-on-surface-variant truncate">
                {user?.email ?? 'alex@enterprise.ai'}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1 rounded-lg hover:text-error hover:bg-error/10 text-on-surface-variant transition-colors cursor-pointer flex-shrink-0"
            title="Logout"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
