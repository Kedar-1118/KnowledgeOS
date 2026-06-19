import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import UploadModal from './UploadModal'
import { useAuthStore } from '../store/authStore'

export default function Layout() {
  const { user } = useAuthStore()

  return (
    <div className="min-h-screen bg-background text-on-surface overflow-x-hidden font-display">
      <Sidebar />
      <UploadModal />

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] radial-glow opacity-60" />
        <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] radial-glow opacity-40" />
      </div>

      <header className="fixed top-0 right-0 w-[calc(100%-240px)] h-16 bg-surface/80 backdrop-blur-xl border-b border-outline-variant shadow-sm z-40 flex items-center px-gutter">
        <div className="flex items-center gap-xl flex-1">
          <div className="relative w-full max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input className="w-full bg-surface-container-high border border-outline-variant rounded-full py-1.5 pl-10 pr-4 text-on-surface focus:ring-2 focus:ring-primary/20 outline-none text-xs" placeholder="Search knowledge base..." />
          </div>
          <nav className="hidden md:flex gap-lg">
            <button className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface">Docs</button>
            <button className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface">API</button>
            <button className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface">Support</button>
          </nav>
        </div>
        <div className="flex items-center gap-md">
          <button className="px-md py-xs bg-white/5 border border-outline-variant rounded-lg font-label-sm text-primary text-xs">Upgrade</button>
          <div className="flex items-center gap-sm">
            <button className="p-2 text-on-surface-variant hover:text-on-surface"><span className="material-symbols-outlined text-[20px]">notifications</span></button>
            <button className="p-2 text-on-surface-variant hover:text-on-surface"><span className="material-symbols-outlined text-[20px]">help_outline</span></button>
          </div>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant flex-shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-xs font-mono font-bold text-primary">
                {user?.name?.[0] ?? 'A'}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="ml-[240px] pt-16 min-h-screen p-margin-desktop">
        <Outlet />
      </main>
    </div>
  )
}
