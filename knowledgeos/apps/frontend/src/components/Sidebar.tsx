// apps/frontend/src/components/Sidebar.tsx
/**
 * Navigation sidebar with links to all main sections.
 * Active state highlighting, icons from Lucide React.
 */

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Library,
  Share2,
  Sparkles,
  GraduationCap,
  Settings,
  LogOut,
  Brain,
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
  { to: '/library', label: 'Library', icon: <Library size={18} /> },
  { to: '/graph', label: 'Knowledge Graph', icon: <Share2 size={18} /> },
  { to: '/recommendations', label: 'Recommendations', icon: <Sparkles size={18} /> },
  { to: '/revision', label: 'Revision', icon: <GraduationCap size={18} /> },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[240px] flex flex-col border-r"
      style={{
        backgroundColor: 'var(--color-background-elevated)',
        borderColor: 'var(--color-surface-border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'rgba(127, 119, 221, 0.15)' }}
        >
          <Brain size={18} style={{ color: 'var(--color-accent-purple)' }} />
        </div>
        <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          KnowledgeOS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive ? 'nav-active' : 'nav-inactive'
                  }`
                }
                style={({ isActive }) => ({
                  backgroundColor: isActive ? 'rgba(29, 158, 117, 0.1)' : 'transparent',
                  color: isActive ? 'var(--color-accent-teal)' : 'var(--color-text-secondary)',
                })}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  if (!el.classList.contains('nav-active')) {
                    el.style.backgroundColor = 'var(--color-surface-hover)';
                    el.style.color = 'var(--color-text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  if (!el.classList.contains('nav-active')) {
                    el.style.backgroundColor = 'transparent';
                    el.style.color = 'var(--color-text-secondary)';
                  }
                }}
              >
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User section */}
      <div
        className="border-t px-3 py-3"
        style={{ borderColor: 'var(--color-surface-border)' }}
      >
        {/* Settings link */}
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <Settings size={18} />
          Settings
        </NavLink>

        {/* User info + logout */}
        <div className="flex items-center justify-between px-3 py-2 mt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-7 h-7 rounded-full flex-shrink-0"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium"
                style={{
                  backgroundColor: 'rgba(29, 158, 117, 0.15)',
                  color: 'var(--color-accent-teal)',
                }}
              >
                {user?.name?.charAt(0) ?? '?'}
              </div>
            )}
            <span
              className="text-xs truncate"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {user?.name ?? 'User'}
            </span>
          </div>

          <button
            onClick={logout}
            className="p-1.5 rounded-md transition-colors duration-150 flex-shrink-0"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-error)';
              e.currentTarget.style.backgroundColor = 'rgba(224, 95, 95, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-muted)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Logout"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
