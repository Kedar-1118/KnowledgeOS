import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useUploadStore } from '../store/uploadStore'
import { useSpaceStore } from '../store/spaceStore'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/library', label: 'Library', icon: 'folder_open' },
  { to: '/search', label: 'Search', icon: 'search' },
  { to: '/ask', label: 'Q&A', icon: 'smart_toy' },
  { to: '/graph', label: 'Graph', icon: 'hub' },
  { to: '/recommendations', label: 'Recommendations', icon: 'recommend' },
  { to: '/revision', label: 'Revision', icon: 'psychology' },
  { to: '/roadmaps', label: 'Roadmaps', icon: 'map' },
  { to: '/mentor', label: 'AI Mentor', icon: 'school' },
  { to: '/research', label: 'Research', icon: 'science' },
  { to: '/compare', label: 'Compare', icon: 'compare' },
  { to: '/analytics', label: 'Analytics', icon: 'analytics' }
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { openUpload } = useUploadStore()
  const { spaces, selectedSpaceId, setSelectedSpaceId, fetchSpaces, createSpace } = useSpaceStore()

  const [isOpen, setIsOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [spaceName, setSpaceName] = useState('')
  const [spaceType, setSpaceType] = useState<'PERSONAL' | 'TEAM' | 'ORGANIZATION'>('TEAM')

  useEffect(() => {
    fetchSpaces()
  }, [fetchSpaces])

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!spaceName.trim()) return
    await createSpace(spaceName, spaceType)
    setSpaceName('')
    setShowCreate(false)
  }

  const activeSpace = selectedSpaceId === 'personal'
    ? { name: 'Personal Space', type: 'PERSONAL' }
    : spaces.find(s => s.id === selectedSpaceId)

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-surface-container-lowest border-r border-outline-variant flex flex-col py-lg z-50 select-none">
      <div className="px-lg mb-md">
        <h1 className="font-display-lg text-display-lg font-bold text-primary tracking-tight cursor-pointer" onClick={() => navigate('/dashboard')}>Nexus AI</h1>
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mt-xs">Enterprise Suite</p>
      </div>

      {/* Shared Spaces Selector */}
      <div className="px-md mb-lg relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between px-3 py-2 bg-white/5 border border-outline-variant hover:bg-white/10 rounded-xl cursor-pointer transition-all text-xs font-semibold text-white"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="material-symbols-outlined text-primary text-[18px]">
              {activeSpace?.type === 'PERSONAL' ? 'person' : activeSpace?.type === 'ORGANIZATION' ? 'corporate_fare' : 'group'}
            </span>
            <span className="truncate">{activeSpace?.name ?? 'Personal Space'}</span>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-xs">unfold_more</span>
        </div>

        {isOpen && (
          <div className="absolute left-md right-md mt-1 bg-[#090e1a] border border-outline-variant rounded-xl shadow-2xl p-sm space-y-sm z-50 max-h-[220px] overflow-y-auto">
            <div className="space-y-xs">
              <div
                onClick={() => { setSelectedSpaceId('personal'); setIsOpen(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-medium ${
                  selectedSpaceId === 'personal' ? 'bg-primary/20 text-primary' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">person</span>
                <span>Personal Space</span>
              </div>

              {spaces.map(s => (
                <div
                  key={s.id}
                  onClick={() => { setSelectedSpaceId(s.id); setIsOpen(false); }}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer text-xs font-medium ${
                    selectedSpaceId === s.id ? 'bg-primary/20 text-primary' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="material-symbols-outlined text-[16px]">
                      {s.type === 'ORGANIZATION' ? 'corporate_fare' : 'group'}
                    </span>
                    <span className="truncate">{s.name}</span>
                  </div>
                </div>
              ))}
            </div>

            <hr className="border-white/5" />

            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-primary rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">add</span>
                Create Space
              </button>
            ) : (
              <form onSubmit={handleCreateSpace} className="p-xs space-y-xs">
                <input
                  type="text"
                  placeholder="Space Name"
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  className="w-full bg-white/5 border border-outline-variant rounded p-1 text-[10px] focus:outline-none focus:border-primary/50 text-white"
                  autoFocus
                />
                <select
                  value={spaceType}
                  onChange={(e) => setSpaceType(e.target.value as any)}
                  className="w-full bg-[#090e1a] border border-outline-variant rounded p-1 text-[10px] text-slate-300"
                >
                  <option value="TEAM">Team</option>
                  <option value="ORGANIZATION">Organization</option>
                </select>
                <div className="flex gap-1">
                  <button type="submit" className="flex-1 bg-primary text-on-primary rounded text-[9px] font-bold py-0.5 hover:brightness-110">Add</button>
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-white/5 text-slate-400 rounded text-[9px] py-0.5">Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 px-md space-y-xs overflow-y-auto pr-xs">
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
          <button onClick={logout} className="hidden hover:block p-1 rounded-lg hover:text-error hover:bg-error/10 text-xs font-semibold cursor-pointer transition-colors">Logout</button>
        </div>
      </div>
    </aside>
  )
}
