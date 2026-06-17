import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SearchPage from './pages/SearchPage'
import QAPage from './pages/QAPage'
import LibraryPage from './pages/LibraryPage'
import GraphPage from './pages/GraphPage'
import RecommendationsPage from './pages/RecommendationsPage'
import RevisionPage from './pages/RevisionPage'
import SettingsPage from './pages/SettingsPage'
import StatusPage from './pages/StatusPage'
import { useAuthStore } from './store/authStore'

function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setToken, checkAuth } = useAuthStore()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      setToken(token)
      checkAuth().then(() => {
        navigate('/dashboard', { replace: true })
      }).catch(() => {
        navigate('/login?error=auth_failed', { replace: true })
      })
    } else {
      navigate('/login?error=missing_token', { replace: true })
    }
  }, [searchParams, setToken, checkAuth, navigate])

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-on-surface">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-on-surface-variant text-xs font-semibold">Authenticating...</span>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-on-surface">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-on-surface-variant text-xs font-semibold">Loading session...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth().catch(() => {
      // Ignore auth failure on initial load — ProtectedRoute handles it
    })
  }, [checkAuth])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
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
        <Route path="search" element={<SearchPage />} />
        <Route path="ask" element={<QAPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="graph" element={<GraphPage />} />
        <Route path="recommendations" element={<RecommendationsPage />} />
        <Route path="revision" element={<RevisionPage />} />
        <Route path="status" element={<StatusPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
