import { create } from 'zustand'

export interface UploadItem {
  id: string
  name: string
  size: number
  progress: number
  status: 'pending' | 'uploading' | 'completing' | 'success' | 'error'
  error?: string
}

interface UploadState {
  isOpen: boolean
  files: UploadItem[]
  openUpload: () => void
  closeUpload: () => void
  addFiles: (files: File[]) => void
  updateFileProgress: (id: string, progress: number) => void
  updateFileStatus: (id: string, status: UploadItem['status'], error?: string) => void
  clearQueue: () => void
}

export const useUploadStore = create<UploadState>((set) => ({
  isOpen: false,
  files: [],
  openUpload: () => set({ isOpen: true, files: [] }), // Clear queue on open
  closeUpload: () => set({ isOpen: false }),
  addFiles: (newFiles) => set((state) => {
    const items: UploadItem[] = newFiles.map((file, idx) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${idx}`,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending'
    }))
    return { files: [...state.files, ...items] }
  }),
  updateFileProgress: (id, progress) => set((state) => ({
    files: state.files.map((f) => f.id === id ? { ...f, progress } : f)
  })),
  updateFileStatus: (id, status, error) => set((state) => ({
    files: state.files.map((f) => f.id === id ? { ...f, status, error } : f)
  })),
  clearQueue: () => set({ files: [] })
}))
