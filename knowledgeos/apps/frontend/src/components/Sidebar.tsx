// apps/frontend/src/components/Sidebar.tsx
/**
 * Navigation sidebar with links to all main sections.
 * Active state highlighting, icons from Lucide React.
 */

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  MessageSquare,
  Library,
  Share2,
  Sparkles,
  GraduationCap,
  Settings,
  LogOut,
  Brain,
  CheckCircle2,
} from 'lucide-react';

import { useAuthStore } from '../store/authStore';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/search', label: 'Search', icon: <Search size={18} /> },
  { to: '/ask', label: 'Ask My Knowledge', icon: <MessageSquare size={18} /> },
  { to: '/library', label: 'Library', icon: <Library size={18} /> },
  { to: '/graph', label: 'Knowledge Graph', icon: <Share2 size={18} /> },
  { to: '/recommendations', label: 'Recommendations', icon: <Sparkles size={18} /> },
  { to: '/revision', label: 'Revision Deck', icon: <GraduationCap size={18} /> },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();

  return (
    <aside className="w-[240px] h-screen sticky top-0 flex flex-col border-r border-surface-border bg-background-elevated select-none z-30 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-6 border-b border-surface-border">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-purple/10 border border-accent-purple/20 text-accent-purple shadow-[0_0_15px_rgba(99,102,241,0.15)]">
          <Brain size={18} className="animate-pulse" />
        </div>
        <span className="text-sm font-bold tracking-tight text-text-primary font-sans">
          KnowledgeOS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 group relative ${
                isActive
                  ? 'bg-surface text-text-primary border border-surface-border shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover/50 border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-accent-teal' : 'text-text-muted group-hover:text-text-secondary'}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.75 rounded-r bg-accent-teal" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Connection status widget */}
      <div className="mx-4 my-2 p-3.5 rounded-xl border border-surface-border bg-surface/30">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
          </span>
          <span className="text-[9px] font-bold tracking-wider text-text-secondary uppercase">
            Drive Connector
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10px] text-text-muted">Status:</span>
          <span className="text-[10px] font-semibold text-success flex items-center gap-1">
            <CheckCircle2 size={10} /> Active
          </span>
        </div>
      </div>

      {/* User section */}
      <div className="border-t border-surface-border px-4 py-4 bg-background-elevated">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 group ${
              isActive
                ? 'bg-surface text-text-primary border border-surface-border'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover/50'
            }`
          }
        >
          <Settings size={16} className="text-text-muted group-hover:text-text-secondary group-hover:rotate-45 transition-transform duration-300" />
          <span>Settings</span>
        </NavLink>

        <div className="flex items-center justify-between mt-3 px-3 py-2 bg-surface/50 border border-surface-border rounded-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-6.5 h-6.5 rounded-full border border-surface-border flex-shrink-0"
              />
            ) : (
              <div className="w-6.5 h-6.5 rounded-full bg-accent-purple/10 border border-accent-purple/20 text-accent-purple flex items-center justify-center flex-shrink-0 text-xs font-bold font-mono">
                {user?.name?.charAt(0) ?? '?'}
              </div>
            )}
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[11px] font-bold text-text-primary truncate">
                {user?.name ?? 'User'}
              </span>
              <span className="text-[9px] text-text-muted truncate">
                {user?.email ?? 'signed in'}
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-1.5 rounded-lg hover:text-error hover:bg-error/10 text-text-muted transition-colors duration-200 flex-shrink-0"
            title="Logout"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
