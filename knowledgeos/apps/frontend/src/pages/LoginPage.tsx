// apps/frontend/src/pages/LoginPage.tsx
/**
 * LoginPage — A premium flagship landing page entry point for KnowledgeOS / Nexus AI.
 * Provides authorization via Google Workspace OAuth for any primary action triggers.
 */

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2 inline-block">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const error = searchParams.get('error');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleLogin = () => {
    window.location.href = '/auth/google';
  };

  return (
    <div className="font-body-md text-body-md bg-background text-on-surface overflow-x-hidden min-h-screen relative select-none">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] radial-glow opacity-60"></div>
        <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] radial-glow opacity-40"></div>
      </div>

      {/* TopNavBar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center h-16 px-gutter bg-surface/80 dark:bg-surface/80 backdrop-blur-xl border-b border-outline-variant shadow-sm transition-all duration-300">
        <div className="flex items-center gap-xl">
          <span className="font-display-lg text-headline-lg tracking-tight text-on-surface font-bold">Nexus AI</span>
          <nav className="hidden md:flex gap-lg items-center">
            <span className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-opacity cursor-pointer">Docs</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-opacity cursor-pointer">API</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-opacity cursor-pointer">Support</span>
          </nav>
        </div>
        <div className="flex items-center gap-md">
          <button
            onClick={handleGoogleLogin}
            className="flex items-center px-4 py-1.5 bg-white/5 border border-outline-variant text-on-surface font-label-sm text-label-sm rounded hover:bg-white/10 transition-all cursor-pointer text-xs font-bold"
          >
            Sign In
          </button>
          <button
            onClick={handleGoogleLogin}
            className="px-lg py-sm bg-primary-container text-on-primary-container font-label-sm text-label-sm rounded hover:opacity-90 transition-all border-t border-white/10 cursor-pointer"
          >
            Book a Demo
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 pt-32">
        {/* Error Alert Display */}
        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 rounded-xl border border-error/25 bg-error/10 text-error text-xs font-bold text-center animate-fade-in shadow-xl relative z-20">
            <span className="material-symbols-outlined text-[16px] mr-2 align-middle">error</span>
            {error === 'auth_failed'
              ? 'Authentication failed. Please verify credentials.'
              : error === 'missing_token'
              ? 'Session token expired or missing. Please sign in again.'
              : 'An unexpected authentication error occurred.'}
          </div>
        )}

        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-margin-desktop text-center mb-32">
          <div className="inline-flex items-center gap-sm px-md py-xs rounded-full bg-surface-container-high border border-outline-variant mb-xl animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary pulse-dot"></span>
            <span className="font-label-sm text-label-sm text-on-secondary-container">V2.0 Now Available</span>
          </div>
          <h1 className="font-display-xl text-display-xl hero-gradient-text mb-lg max-w-4xl mx-auto leading-tight">
            The Intelligence Layer for your Knowledge Base
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-2xl">
            Orchestrate, analyze, and visualize your documents with an enterprise-grade AI suite built for speed and precision.
          </p>
          <div className="flex justify-center gap-md mb-3xl">
            <button
              onClick={handleGoogleLogin}
              className="px-xl py-md bg-primary-container text-on-primary-container font-label-sm text-label-sm rounded-lg hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all border-t border-white/20 cursor-pointer active:scale-95 flex items-center font-bold text-xs"
            >
              <GoogleIcon />
              Continue with Google Workspace
            </button>
            <button
              onClick={handleGoogleLogin}
              className="px-xl py-md bg-transparent border border-outline-variant text-on-surface font-label-sm text-label-sm rounded-lg hover:bg-white/5 transition-all cursor-pointer active:scale-95 text-xs font-bold"
            >
              View Enterprise Pricing
            </button>
          </div>

          {/* Hero Visual: Dashboard Preview */}
          <div className="relative group mt-2xl max-w-5xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-secondary/30 rounded-xl blur-2xl opacity-20 group-hover:opacity-30 transition duration-1000"></div>
            <div className="relative glass-panel rounded-xl overflow-hidden shadow-2xl p-sm bg-surface-container-lowest/50">
              <div className="bg-surface-dim rounded-lg border border-outline-variant aspect-[16/10] overflow-hidden relative">
                {/* Mockup Dashboard image or layout */}
                <div className="flex h-full text-left">
                  {/* Mock Sidebar */}
                  <div className="w-48 border-r border-outline-variant p-md hidden sm:flex flex-col gap-md bg-surface-container-lowest">
                    <div className="h-4 w-24 bg-surface-variant rounded-full mb-lg"></div>
                    <div className="h-3 w-full bg-surface-variant/50 rounded-full"></div>
                    <div className="h-3 w-4/5 bg-surface-variant/50 rounded-full"></div>
                    <div className="h-3 w-full bg-primary/20 rounded-full"></div>
                    <div className="mt-auto h-12 w-full bg-surface-variant/30 rounded-lg"></div>
                  </div>
                  {/* Mock Main Area */}
                  <div className="flex-grow p-lg flex flex-col gap-lg bg-background">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-xs">
                        <div className="h-6 w-32 bg-on-surface/10 rounded-full"></div>
                        <div className="h-3 w-20 bg-on-surface-variant/20 rounded-full"></div>
                      </div>
                      <div className="h-8 w-24 bg-primary-container/20 border border-primary/30 rounded"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-md flex-1">
                      {/* Coverage */}
                      <div className="col-span-2 glass-panel rounded-lg flex items-center justify-center relative overflow-hidden bg-surface-container">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-32 h-32 rounded-full border-[10px] border-surface-variant/30"></div>
                          <div className="absolute w-32 h-32 rounded-full border-[10px] border-primary border-r-transparent border-b-transparent rotate-[45deg]"></div>
                          <span className="font-display-lg text-display-lg text-primary text-2xl font-bold">84%</span>
                        </div>
                        <div className="absolute bottom-md left-md">
                          <span className="font-label-sm text-label-sm text-on-surface-variant text-[10px] font-bold">KNOWLEDGE COVERAGE</span>
                        </div>
                      </div>
                      {/* Logs */}
                      <div className="col-span-1 glass-panel rounded-lg p-md overflow-hidden bg-surface-container">
                        <div className="h-3 w-16 bg-surface-variant/50 rounded-full mb-md"></div>
                        <div className="flex flex-col gap-sm">
                          <div className="flex items-center gap-xs">
                            <div className="w-1 h-1 rounded-full bg-secondary"></div>
                            <div className="h-2 flex-1 bg-surface-variant/20 rounded-full"></div>
                          </div>
                          <div className="flex items-center gap-xs">
                            <div className="w-1 h-1 rounded-full bg-secondary"></div>
                            <div className="h-2 flex-1 bg-surface-variant/20 rounded-full"></div>
                          </div>
                          <div className="flex items-center gap-xs">
                            <div className="w-1 h-1 rounded-full bg-primary"></div>
                            <div className="h-2 flex-1 bg-surface-variant/20 rounded-full"></div>
                          </div>
                          <div className="h-2 w-1/2 bg-surface-variant/10 rounded-full mt-lg"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="border-y border-outline-variant bg-surface-container-lowest/50 py-xl mb-32">
          <div className="max-w-7xl mx-auto px-margin-desktop">
            <p className="font-label-sm text-label-sm text-outline text-center mb-xl tracking-widest uppercase">Trusted by industry leaders</p>
            <div className="flex flex-wrap justify-center items-center gap-3xl opacity-40 grayscale contrast-125">
              <span className="font-display-lg text-headline-lg font-bold tracking-tighter">SYNTHETIC</span>
              <span className="font-display-lg text-headline-lg font-bold tracking-tighter">VERTEX</span>
              <span className="font-display-lg text-headline-lg font-bold tracking-tighter">ORIGIN</span>
              <span className="font-display-lg text-headline-lg font-bold tracking-tighter">QUANTUM</span>
              <span className="font-display-lg text-headline-lg font-bold tracking-tighter">PULSE</span>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="max-w-7xl mx-auto px-margin-desktop mb-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            {/* Card 1: Semantic Search */}
            <div className="group relative p-lg glass-panel rounded-xl hover:border-primary/50 transition-all duration-500 overflow-hidden bg-surface-container-lowest/40">
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all"></div>
              <div className="w-12 h-12 flex items-center justify-center bg-surface-container rounded-lg border border-outline-variant mb-xl group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-primary text-[24px]">search</span>
              </div>
              <h3 className="font-headline-lg text-headline-lg text-on-surface mb-md">Semantic Search</h3>
              <p className="font-body-md text-body-md text-on-surface-variant text-sm leading-relaxed">
                Go beyond keywords. Find meaning and context across billions of vectors with sub-millisecond latency.
              </p>
            </div>
            {/* Card 2: Interactive Graph */}
            <div className="group relative p-lg glass-panel rounded-xl hover:border-secondary/50 transition-all duration-500 overflow-hidden bg-surface-container-lowest/40">
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-secondary/10 rounded-full blur-2xl group-hover:bg-secondary/20 transition-all"></div>
              <div className="w-12 h-12 flex items-center justify-center bg-surface-container rounded-lg border border-outline-variant mb-xl group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-secondary text-[24px]">hub</span>
              </div>
              <h3 className="font-headline-lg text-headline-lg text-on-surface mb-md">Interactive Graph</h3>
              <p className="font-body-md text-body-md text-on-surface-variant text-sm leading-relaxed">
                Visualize entity relationships and hidden clusters within your data lake using our dynamic node rendering.
              </p>
            </div>
            {/* Card 3: AI Q&A */}
            <div className="group relative p-lg glass-panel rounded-xl hover:border-tertiary/50 transition-all duration-500 overflow-hidden bg-surface-container-lowest/40">
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-tertiary/10 rounded-full blur-2xl group-hover:bg-tertiary/20 transition-all"></div>
              <div className="w-12 h-12 flex items-center justify-center bg-surface-container rounded-lg border border-outline-variant mb-xl group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-tertiary text-[24px]">smart_toy</span>
              </div>
              <h3 className="font-headline-lg text-headline-lg text-on-surface mb-md">AI Q&amp;A</h3>
              <p className="font-body-md text-body-md text-on-surface-variant text-sm leading-relaxed">
                Connect your docs and get source-attributed answers in natural language. Built-in hallucination guardrails.
              </p>
            </div>
          </div>
        </section>

        {/* Focused CTA Section */}
        <section className="max-w-7xl mx-auto px-margin-desktop mb-32">
          <div className="relative overflow-hidden rounded-3xl bg-surface-container-high border border-outline-variant p-2xl md:p-3xl text-center">
            <div className="absolute inset-0 radial-glow opacity-20 pointer-events-none"></div>
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="font-display-lg text-display-lg text-on-surface mb-lg">Ready to unify your intelligence?</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-2xl">
                Join 5,000+ teams who are building the future of internal tools with Nexus AI.
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-md">
                <input
                  className="w-full sm:w-64 px-lg py-md bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-on-surface placeholder:text-outline text-xs outline-none"
                  placeholder="Enter work email"
                  type="email"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleGoogleLogin(); }}
                />
                <button
                  onClick={handleGoogleLogin}
                  className="w-full sm:w-auto px-xl py-md bg-on-surface text-surface font-label-sm text-label-sm font-bold rounded-lg hover:opacity-90 transition-all cursor-pointer text-xs"
                >
                  Get Started
                </button>
              </div>
              <p className="mt-lg font-label-sm text-label-sm text-outline text-[11px] mt-4">
                No credit card required. 14-day free trial.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant py-2xl bg-surface-container-lowest relative z-10">
        <div className="max-w-7xl mx-auto px-margin-desktop">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-xl mb-xl">
            <div className="col-span-2 md:col-span-1">
              <span className="font-display-lg text-headline-lg font-bold text-primary block mb-lg">Nexus AI</span>
              <p className="font-label-sm text-label-sm text-on-surface-variant text-[11px] leading-relaxed">
                Precision infrastructure for the intelligence era.
              </p>
            </div>
            <div>
              <h4 className="font-label-sm text-label-sm text-on-surface mb-lg uppercase tracking-widest text-xs font-bold mb-4">Product</h4>
              <ul className="flex flex-col gap-sm font-body-md text-on-surface-variant text-[13px] space-y-2">
                <li><span className="hover:text-primary cursor-pointer" onClick={handleGoogleLogin}>Platform</span></li>
                <li><span className="hover:text-primary cursor-pointer" onClick={handleGoogleLogin}>Integrations</span></li>
                <li><span className="hover:text-primary cursor-pointer" onClick={handleGoogleLogin}>Enterprise</span></li>
                <li><span className="hover:text-primary cursor-pointer" onClick={handleGoogleLogin}>Pricing</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-label-sm text-label-sm text-on-surface mb-lg uppercase tracking-widest text-xs font-bold mb-4">Resources</h4>
              <ul className="flex flex-col gap-sm font-body-md text-on-surface-variant text-[13px] space-y-2">
                <li><span className="hover:text-primary cursor-pointer" onClick={handleGoogleLogin}>Documentation</span></li>
                <li><span className="hover:text-primary cursor-pointer" onClick={handleGoogleLogin}>API Reference</span></li>
                <li><span className="hover:text-primary cursor-pointer" onClick={handleGoogleLogin}>Community</span></li>
                <li><span className="hover:text-primary cursor-pointer" onClick={handleGoogleLogin}>Changelog</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-label-sm text-label-sm text-on-surface mb-lg uppercase tracking-widest text-xs font-bold mb-4">Company</h4>
              <ul className="flex flex-col gap-sm font-body-md text-on-surface-variant text-[13px] space-y-2">
                <li><span className="hover:text-primary cursor-pointer" onClick={handleGoogleLogin}>About Us</span></li>
                <li><span className="hover:text-primary cursor-pointer" onClick={handleGoogleLogin}>Careers</span></li>
                <li><span className="hover:text-primary cursor-pointer" onClick={handleGoogleLogin}>Privacy</span></li>
                <li><span className="hover:text-primary cursor-pointer" onClick={handleGoogleLogin}>Contact</span></li>
              </ul>
            </div>
          </div>
          <div className="flex justify-between items-center pt-xl border-t border-outline-variant/30 font-label-sm text-label-sm text-outline text-xs text-on-surface-variant mt-8">
            <span>© 2026 Nexus AI Inc. All rights reserved.</span>
            <div className="flex gap-lg">
              <span className="hover:text-on-surface cursor-pointer" onClick={handleGoogleLogin}>Twitter</span>
              <span className="hover:text-on-surface cursor-pointer" onClick={handleGoogleLogin}>GitHub</span>
              <span className="hover:text-on-surface cursor-pointer" onClick={handleGoogleLogin}>LinkedIn</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
