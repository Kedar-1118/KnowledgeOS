// apps/frontend/src/pages/LoginPage.tsx
/**
 * Login page with Google OAuth button.
 *
 * Design:
 * - Dark background (#0A0A0F)
 * - Animated gradient orb (purple → teal) behind the login card
 * - Logo: brain icon + "KnowledgeOS" in Inter 600
 * - Tagline: "Your knowledge, finally searchable."
 * - Google OAuth button with hover lift effect
 */

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Brain } from 'lucide-react';

import { useAuthStore } from '../store/authStore';

/** Google "G" logo SVG for the OAuth button */
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleLogin = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = '/auth/google';
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      {/* Animated gradient orb */}
      <div
        className="gradient-orb"
        style={{
          top: '50%',
          left: '50%',
        }}
      />

      {/* Secondary smaller orb */}
      <div
        className="gradient-orb"
        style={{
          top: '30%',
          left: '60%',
          width: '300px',
          height: '300px',
          animationDelay: '-3s',
          opacity: 0.3,
        }}
      />

      {/* Login card */}
      <div
        className="relative z-10 flex flex-col items-center animate-fade-in"
        style={{ maxWidth: '400px', width: '100%', padding: '0 24px' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(127, 119, 221, 0.2), rgba(29, 158, 117, 0.2))',
              border: '1px solid rgba(127, 119, 221, 0.2)',
            }}
          >
            <Brain size={26} style={{ color: 'var(--color-accent-purple)' }} />
          </div>
          <h1
            className="text-3xl tracking-tight"
            style={{
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            KnowledgeOS
          </h1>
        </div>

        {/* Tagline */}
        <p
          className="text-center mb-10"
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '1.0625rem',
            lineHeight: 1.5,
          }}
        >
          Your knowledge, finally searchable.
        </p>

        {/* Login card container */}
        <div
          className="w-full rounded-2xl p-8 flex flex-col items-center"
          style={{
            backgroundColor: 'rgba(18, 18, 26, 0.8)',
            border: '1px solid var(--color-surface-border)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <p
            className="text-sm mb-6 text-center"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Sign in to sync your Google Drive and unlock AI-powered knowledge management
          </p>

          {/* Google OAuth button */}
          <button
            id="google-login-button"
            onClick={handleGoogleLogin}
            className="btn-google w-full justify-center"
          >
            <GoogleLogo />
            <span>Sign in with Google</span>
          </button>

          {/* Error message */}
          {error && (
            <div
              className="mt-4 px-4 py-2.5 rounded-lg text-sm w-full text-center"
              style={{
                backgroundColor: 'rgba(224, 95, 95, 0.1)',
                border: '1px solid rgba(224, 95, 95, 0.2)',
                color: 'var(--color-error)',
              }}
            >
              {error === 'auth_failed'
                ? 'Authentication failed. Please try again.'
                : error === 'missing_code'
                  ? 'Missing authorization code. Please try again.'
                  : 'An error occurred. Please try again.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <p
          className="mt-8 text-xs text-center"
          style={{ color: 'var(--color-text-muted)' }}
        >
          By signing in, you grant read-only access to your Google Drive.
          <br />
          We only read files in your KnowledgeOS/ folder.
        </p>
      </div>
    </div>
  );
}
