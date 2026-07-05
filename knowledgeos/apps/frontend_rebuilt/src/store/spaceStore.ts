// apps/frontend_rebuilt/src/store/spaceStore.ts
import { create } from 'zustand';
import { api } from '../lib/api';

export interface Space {
  id: string;
  name: string;
  type: 'PERSONAL' | 'TEAM' | 'ORGANIZATION';
}

interface SpaceState {
  spaces: Space[];
  selectedSpaceId: string; // 'personal' or UUID
  setSelectedSpaceId: (id: string) => void;
  fetchSpaces: () => Promise<void>;
  createSpace: (name: string, type: 'PERSONAL' | 'TEAM' | 'ORGANIZATION') => Promise<void>;
}

export const useSpaceStore = create<SpaceState>((set, get) => ({
  spaces: [],
  selectedSpaceId: 'personal',
  setSelectedSpaceId: (id) => set({ selectedSpaceId: id }),
  fetchSpaces: async () => {
    try {
      const res = await api.get<{ success: boolean; data: Space[] }>('/api/spaces');
      if (res.data.success) {
        set({ spaces: res.data.data });
      }
    } catch (e) {
      console.error('Failed to fetch spaces:', e);
    }
  },
  createSpace: async (name, type) => {
    try {
      const res = await api.post<{ success: boolean; data: Space }>('/api/spaces', { name, type });
      if (res.data.success) {
        await get().fetchSpaces();
        set({ selectedSpaceId: res.data.data.id });
      }
    } catch (e) {
      console.error('Failed to create space:', e);
    }
  }
}));
