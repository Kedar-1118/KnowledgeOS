import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useUploadStore } from '../store/uploadStore'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/library', label: 'Library', icon: 'folder_open' },
  { to: '/search', label: 'Search', icon: 'search' },
  { to: '/ask', label: 'Q&A', icon: 'smart_toy' },
  { to: '/graph', label: 'Graph', icon: 'hub' },
  { to: '/recommendations', label: 'Recommendations', icon: 'sparkles' },
  { to: '/revision', label: 'Revision', icon: 'psychology' }
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { openUpload } = useUploadStore()

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-surface-container-lowest border-r border-outline-variant flex flex-col py-lg z-50 select-none">
      <div className="px-lg mb-2xl">
        <h1 className="font-display-lg text-display-lg font-bold text-primary tracking-tight cursor-pointer" onClick={() => navigate('/dashboard')}>Nexus AI</h1>
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mt-xs">Enterprise Suite</p>
      </div>

      <nav className="flex-1 px-md space-y-xs overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-md px-4 py-2 transition-transform active:scale-[0.98] ${isActive
                ? 'bg-white/5 border-l-2 border-primary text-primary font-medium'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            <span className="text-xs font-semibold">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-md pt-lg border-t border-outline-variant/30 flex flex-col gap-xs">
        <button 
          onClick={openUpload}
          className="bg-primary text-on-primary py-sm rounded px-md mb-md hover:brightness-110 transition-all flex items-center justify-center gap-2 text-xs font-bold cursor-pointer"
        >
          New Ingestion
        </button>

        <NavLink to="/status" className={({ isActive }) => `flex items-center gap-md px-4 py-2 ${isActive ? 'bg-white/5 border-l-2 border-primary text-primary font-medium' : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'}`}>
          <span className="material-symbols-outlined text-[20px]">sensors</span>
          <span className="text-xs font-semibold">Status</span>
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-md px-4 py-2 ${isActive ? 'bg-white/5 border-l-2 border-primary text-primary font-medium' : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'}`}>
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="text-xs font-semibold">Settings</span>
        </NavLink>

        <div className="flex items-center justify-between px-3 py-2 bg-white/5 border border-outline-variant rounded-xl mt-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-outline-variant flex-shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center text-xs font-mono font-bold text-primary">
                  {user?.name?.[0] ?? 'A'}
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[10px] font-bold text-on-surface truncate">{user?.name ?? 'Alex'}</span>
              <span className="text-[9px] text-on-surface-variant truncate">{user?.email ?? 'alex@enterprise.ai'}</span>
            </div>
          </div>
          <button onClick={logout} className="p-1 rounded-lg hover:text-error hover:bg-error/10 text-on-surface-variant transition-colors">Logout</button>
        </div>
      </div>
    </aside>
  )
}
