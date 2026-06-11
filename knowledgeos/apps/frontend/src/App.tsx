// apps/frontend/src/App.tsx
/**
 * KnowledgeOS — App Router
 * Protected routes require authentication. Unauthenticated users are redirected to /login.
 */

import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuthStore } from './store/authStore';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

/**
 * Auth callback handler — extracts JWT from URL params after Google OAuth redirect.
 */
function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setToken, checkAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setToken(token);
      checkAuth().then(() => {
        navigate('/dashboard', { replace: true });
      }).catch(() => {
        navigate('/login?error=auth_failed', { replace: true });
      });
    } else {
      navigate('/login?error=missing_token', { replace: true });
    }
  }, [searchParams, setToken, checkAuth, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-accent-teal border-t-transparent animate-spin" />
        <span className="text-text-secondary text-sm">Authenticating...</span>
      </div>
    </div>
  );
}

/**
 * Protected route wrapper — redirects to login if not authenticated.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-accent-teal border-t-transparent animate-spin" />
          <span className="text-text-secondary text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth().catch(() => {
      // Silent fail — user will be redirected to login
    });
  }, [checkAuth]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        {/* Phase 2+ routes */}
        <Route path="search" element={<PlaceholderPage title="Search" />} />
        <Route path="library" element={<PlaceholderPage title="Library" />} />
        <Route path="graph" element={<PlaceholderPage title="Knowledge Graph" />} />
        <Route path="recommendations" element={<PlaceholderPage title="Recommendations" />} />
        <Route path="revision" element={<PlaceholderPage title="Revision" />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

/**
 * Placeholder page for routes that will be built in later phases.
 */
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
      <h1 className="text-2xl font-semibold text-text-primary mb-2">{title}</h1>
      <p className="text-text-secondary text-sm">Coming in Phase 2+</p>
    </div>
  );
}
