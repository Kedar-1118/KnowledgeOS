// apps/frontend/src/store/authStore.ts
/**
 * Zustand authentication store.
 * Manages user state, JWT token, and auth actions.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /** Set the JWT token and mark as authenticated. */
  setToken: (token: string) => void;

  /** Set the authenticated user. */
  setUser: (user: User) => void;

  /** Clear auth state (logout). */
  logout: () => void;

  /** Check auth by calling GET /auth/me and updating state. */
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setToken: (token: string) => {
        set({ token, isAuthenticated: true });
      },

      setUser: (user: User) => {
        set({ user });
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });

        // Call backend logout (best-effort, fire-and-forget)
        const token = get().token;
        if (token) {
          api.post('/auth/logout').catch(() => {
            // Ignore errors — client-side logout is sufficient
          });
        }
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false, user: null, isLoading: false });
          return;
        }

        set({ isLoading: true });

        try {
          const response = await api.get<{ success: boolean; data: User }>('/auth/me');
          if (response.data.success && response.data.data) {
            set({
              user: response.data.data,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'knowledgeos-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
