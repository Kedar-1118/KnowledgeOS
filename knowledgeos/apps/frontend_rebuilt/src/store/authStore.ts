import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../lib/api'

export interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  setToken: (token: string) => void
  setUser: (user: User | null) => void
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      setToken: (token: string) => {
        set({ token, isAuthenticated: !!token })
        localStorage.setItem('token', token)
      },

      setUser: (user: User | null) => {
        set({ user })
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
        localStorage.removeItem('token')
        api.post('/auth/logout').catch(() => {
          // Ignore errors
        })
      },

      checkAuth: async () => {
        const token = localStorage.getItem('token')
        if (!token) {
          set({ isAuthenticated: false, user: null, isLoading: false })
          return
        }
        set({ isLoading: true })
        try {
          const res = await api.get<{ success: boolean; data: User }>('/auth/me')
          if (res.data.success && res.data.data) {
            set({ user: res.data.data, token, isAuthenticated: true, isLoading: false })
          } else {
            set({ user: null, token: null, isAuthenticated: false, isLoading: false })
            localStorage.removeItem('token')
          }
        } catch (err) {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false })
          localStorage.removeItem('token')
        }
      },
    }),
    {
      name: 'auth-store',
    }
  )
)
