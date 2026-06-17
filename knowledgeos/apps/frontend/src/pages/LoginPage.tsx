// apps/frontend/src/pages/LoginPage.tsx
/**
 * Login page with Google OAuth button.
 * Split-screen design: Left features custom dashboard/pipeline mockup, Right contains the auth form.
 */

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Brain, Search, Sparkles, Share2, Layers } from 'lucide-react';

import { useAuthStore } from '../store/authStore';

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
    <div className="min-h-screen w-full flex bg-background dot-grid relative overflow-hidden select-none">
      {/* Background Orbs */}
      <div className="gradient-orb top-[20%] left-[20%]" />
      <div className="gradient-orb bottom-[10%] right-[10%] w-[350px] h-[350px] opacity-25" />

      {/* Left panel: Product Preview Mock (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-3/5 border-r border-surface-border flex-col justify-between p-12 relative z-10">
        {/* Top Branding Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-purple/10 border border-accent-purple/20 text-accent-purple shadow-[0_0_15px_rgba(99,102,241,0.15)]">
            <Brain size={18} className="animate-pulse" />
          </div>
          <span className="text-sm font-bold tracking-tight text-text-primary">
            KnowledgeOS
          </span>
        </div>

        {/* Dynamic visual showcase */}
        <div className="max-w-xl">
          <h2 className="text-4xl font-extrabold tracking-tight text-text-primary leading-tight font-sans">
            Your personal knowledge database,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-purple to-accent-teal">
              finally searchable.
            </span>
          </h2>
          <p className="mt-4 text-sm text-text-secondary leading-relaxed max-w-lg">
            KnowledgeOS syncs with your Google Drive, parsing and indexing documents into a semantic database. Perform search queries, chat with your files, visualize knowledge relationships, and revise topics using spaced repetition.
          </p>

          {/* Interactive Feature Steps Grid */}
          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-surface-border bg-surface/50 backdrop-blur-md">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-teal/10 border border-accent-teal/20 text-accent-teal mb-3">
                <Search size={16} />
              </div>
              <h4 className="text-xs font-bold text-text-primary">Semantic Search</h4>
              <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
                Look past filename matches. Query concepts using natural language commands.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-surface-border bg-surface/50 backdrop-blur-md">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-purple/10 border border-accent-purple/20 text-accent-purple mb-3">
                <Brain size={16} />
              </div>
              <h4 className="text-xs font-bold text-text-primary">Contextual Q&A</h4>
              <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
                Ask specific questions. Extract immediate citations mapping to source files.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-surface-border bg-surface/50 backdrop-blur-md">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-amber/10 border border-accent-amber/20 text-accent-amber mb-3">
                <Share2 size={16} />
              </div>
              <h4 className="text-xs font-bold text-text-primary">Knowledge Graph</h4>
              <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
                Visualize connections between document concepts in an interactive graph.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-surface-border bg-surface/50 backdrop-blur-md">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-teal/10 border border-accent-teal/20 text-accent-teal mb-3">
                <Layers size={16} />
              </div>
              <h4 className="text-xs font-bold text-text-primary">Spaced Repetition</h4>
              <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
                Lock in knowledge long-term through optimized sm-2 practice intervals.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div>
          <p className="text-[10px] text-text-muted tracking-wide font-medium">
            KNOWLEDGEOS PROJECT · STAGE 1-5 COMPLETED LOGS
          </p>
        </div>
      </div>

      {/* Right panel: Login card centered */}
      <div className="w-full lg:w-2/5 flex flex-col justify-between p-8 sm:p-12 relative z-10">
        {/* Mobile top branding */}
        <div className="flex lg:hidden items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-purple/10 border border-accent-purple/20 text-accent-purple">
            <Brain size={18} />
          </div>
          <span className="text-sm font-bold tracking-tight text-text-primary">
            KnowledgeOS
          </span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary font-sans">
              Sign In
            </h1>
            <p className="mt-2 text-xs text-text-secondary">
              Connect your workspace repository to begin search and indexing operations.
            </p>
          </div>

          {/* Form */}
          <div className="p-6 rounded-2xl border border-surface-border bg-surface/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <p className="text-xs text-text-secondary leading-relaxed mb-6">
              Access is currently restricted to authorized Google Drive accounts. Sign in to start syncing documents.
            </p>

            <button
              id="google-login-button"
              onClick={handleGoogleLogin}
              className="btn-google w-full justify-center py-3 rounded-xl hover:scale-[1.01]"
            >
              <GoogleLogo />
              <span className="text-xs font-bold tracking-wide">Continue with Google</span>
            </button>

            {/* Error notifications */}
            {error && (
              <div className="mt-4 p-3 rounded-lg border border-error/20 bg-error/5 text-error text-xs font-semibold text-center flex items-center justify-center gap-2">
                <span>
                  {error === 'auth_failed'
                    ? 'Authentication failed. Please verify credentials.'
                    : error === 'missing_token'
                      ? 'Session token missing. Please try signing in again.'
                      : 'An unexpected authentication error occurred.'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer conditions */}
        <div className="max-w-sm w-full mx-auto">
          <p className="text-[10px] text-text-muted leading-relaxed text-center sm:text-left">
            By signing in, you grant secure read-only folder credentials to Drive documents.
            <br />
            Data is parsed locally and never shared with external APIs.
          </p>
        </div>
      </div>
    </div>
  );
}
