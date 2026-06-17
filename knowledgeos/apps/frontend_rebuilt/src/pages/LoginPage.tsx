import React from 'react'

export default function LoginPage() {
  const handleGoogleLogin = () => {
    window.location.href = '/auth/google'
  }

  return (
    <div className="font-body-md text-body-md bg-background text-on-surface overflow-x-hidden min-h-screen relative select-none">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] radial-glow opacity-60"></div>
        <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] radial-glow opacity-40"></div>
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center h-16 px-gutter bg-surface/80 backdrop-blur-xl border-b border-outline-variant shadow-sm">
        <div className="flex items-center gap-xl">
          <span className="font-display-lg text-display-lg tracking-tight text-on-surface font-bold">Nexus AI</span>
          <nav className="hidden md:flex gap-lg items-center">
            <span className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-opacity cursor-pointer">Docs</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-opacity cursor-pointer">API</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-opacity cursor-pointer">Support</span>
          </nav>
        </div>
        <div className="flex items-center gap-md">
          <button onClick={handleGoogleLogin} className="flex items-center px-4 py-1.5 bg-white/5 border border-outline-variant text-on-surface font-label-sm text-label-sm rounded hover:bg-white/10 transition-all text-xs font-bold">Sign In</button>
          <button onClick={handleGoogleLogin} className="px-lg py-sm bg-primary-container text-on-primary-container font-label-sm text-label-sm rounded hover:opacity-90 transition-all border-t border-white/10 cursor-pointer">Book a Demo</button>
        </div>
      </header>

      <main className="relative z-10 pt-32">
        <section className="max-w-7xl mx-auto px-margin-desktop text-center mb-32">
          <div className="inline-flex items-center gap-sm px-md py-xs rounded-full bg-surface-container-high border border-outline-variant mb-xl animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary pulse-dot"></span>
            <span className="font-label-sm text-label-sm text-on-secondary-container">V2.0 Now Available</span>
          </div>
          <h1 className="font-display-xl text-display-xl hero-gradient-text mb-lg max-w-4xl mx-auto leading-tight">The Intelligence Layer for your Knowledge Base</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-2xl">Orchestrate, analyze, and visualize your documents with an enterprise-grade AI suite built for speed and precision.</p>
          <div className="flex justify-center gap-md mb-3xl">
            <button onClick={handleGoogleLogin} className="px-xl py-md bg-primary-container text-on-primary-container font-label-sm text-label-sm rounded-lg hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all border-t border-white/20 active:scale-95 flex items-center font-bold text-xs">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2 inline-block"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google Workspace
            </button>
            <button onClick={handleGoogleLogin} className="px-xl py-md bg-transparent border border-outline-variant text-on-surface font-label-sm text-label-sm rounded-lg hover:bg-white/5 transition-all active:scale-95 text-xs font-bold">View Enterprise Pricing</button>
          </div>
        </section>
      </main>
    </div>
  )
}
