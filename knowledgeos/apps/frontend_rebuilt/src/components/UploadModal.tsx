import React, { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { api } from '../lib/api'
import { useUploadStore, UploadItem } from '../store/uploadStore'

export default function UploadModal() {
  const queryClient = useQueryClient()
  const { isOpen, files, closeUpload, addFiles, updateFileProgress, updateFileStatus } = useUploadStore()
  
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTasksRef = useRef<Record<string, boolean>>({})

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files)
      addFiles(droppedFiles)
      // Process files sequentially or in parallel
      droppedFiles.forEach((file, idx) => {
        // We will match the files by index to trigger upload
        // In useUploadStore.addFiles, it appends them to files queue.
        // We trigger upload processing via useEffect or direct function calls.
      })
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files)
      addFiles(selectedFiles)
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-gutter">
      {/* Frosted Glass Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-surface-container-lowest/80 backdrop-blur-md transition-opacity duration-300"
        onClick={closeUpload}
      />

      {/* Modal Dialog Content */}
      <div className="relative glass-panel w-full max-w-xl rounded-2xl p-xl shadow-2xl z-10 bg-surface-container/95 border-outline-variant/30 flex flex-col max-h-[85vh] animate-fade-in">
        <header className="flex justify-between items-center mb-xl">
          <div>
            <span className="font-label-sm text-primary bg-primary/10 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-primary/20">
              Ingestion Hub
            </span>
            <h3 className="font-display-lg text-lg text-on-surface font-semibold mt-xs">
              Upload files to Drive Index
            </h3>
            <p className="text-on-surface-variant font-body-lg text-[11px] mt-0.5">
              Add documents to your KnowledgeOS folder automatically.
            </p>
          </div>
          <button 
            onClick={closeUpload}
            className="material-symbols-outlined text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer text-[20px]"
          >
            close
          </button>
        </header>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          className={`border-2 border-dashed rounded-xl p-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[160px] ${
            isDragging 
              ? 'border-primary bg-primary/5 scale-[0.99]' 
              : 'border-outline-variant/30 hover:border-primary/50 hover:bg-white/5'
          }`}
        >
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept=".pdf,.txt,.md,image/*,video/*"
          />
          <span className="material-symbols-outlined text-primary text-4xl mb-md opacity-80 animate-pulse">
            cloud_upload
          </span>
          <p className="text-xs text-on-surface font-semibold">
            Drag & drop files here, or <span className="text-primary hover:underline">browse</span>
          </p>
          <p className="text-[10px] text-on-surface-variant/60 mt-xs font-medium">
            Supports PDF, Markdown, Text, and Media up to 50MB
          </p>
        </div>

        {/* Upload Queue Manager / Processor Controller */}
        <UploadQueueProcessor 
          files={files} 
          updateFileProgress={updateFileProgress}
          updateFileStatus={updateFileStatus}
          queryClient={queryClient}
          uploadTasksRef={uploadTasksRef}
        />
      </div>
    </div>
  )
}

interface UploadQueueProcessorProps {
  files: UploadItem[]
  updateFileProgress: (id: string, progress: number) => void
  updateFileStatus: (id: string, status: UploadItem['status'], error?: string) => void
  queryClient: any
  uploadTasksRef: React.MutableRefObject<Record<string, boolean>>
}

function UploadQueueProcessor({
  files,
  updateFileProgress,
  updateFileStatus,
  queryClient,
  uploadTasksRef
}: UploadQueueProcessorProps) {

  // Process uploads as files get added
  useEffect(() => {
    const pendingFiles = files.filter((f) => f.status === 'pending')
    
    pendingFiles.forEach((pendingFile) => {
      // Avoid starting the same task twice
      if (uploadTasksRef.current[pendingFile.id]) return
      uploadTasksRef.current[pendingFile.id] = true

      // Find the actual file reference from the upload queue
      // Since Zustand only stores JSON-serializable info, we keep the original File in local lists
      // Wait! How do we retrieve the File object?
      // Actually, we can hook into the file input or drag-and-drop handlers!
      // But a clean way is to match by file name & size or keep a temporary memory array.
      // Let's implement a global map/registry for the actual browser File references!
    })
  }, [files])

  return (
    files.length > 0 ? (
      <div className="mt-xl overflow-y-auto flex-1 max-h-[300px] pr-1 space-y-md border-t border-outline-variant/20 pt-lg">
        <h4 className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-bold mb-md">
          Upload Queue ({files.length})
        </h4>
        <div className="space-y-sm">
          {files.map((file) => (
            <UploadQueueRow 
              key={file.id} 
              file={file} 
              updateFileProgress={updateFileProgress}
              updateFileStatus={updateFileStatus}
              queryClient={queryClient}
            />
          ))}
        </div>
      </div>
    ) : null
  )
}

// In order to link Zustand's serializable file metadata with the browser's native File objects,
// we use a simple module-level registry mapping the created IDs to the actual File references.
export const fileRegistry = new Map<string, File>()

// Override Zustand addFiles action to populate registry before saving state
const originalAddFiles = useUploadStore.getState().addFiles
useUploadStore.setState({
  addFiles: (files: File[]) => {
    const currentFilesCount = useUploadStore.getState().files.length
    // Call the original set state
    originalAddFiles(files)
    // Map files to their ids in registry
    const updatedStateFiles = useUploadStore.getState().files
    // Register the last added files
    const sliceStart = currentFilesCount
    const newlyAddedStateFiles = updatedStateFiles.slice(sliceStart)
    newlyAddedStateFiles.forEach((item, idx) => {
      const nativeFile = files[idx]
      if (nativeFile) {
        fileRegistry.set(item.id, nativeFile)
      }
    })
  }
})

function UploadQueueRow({
  file,
  updateFileProgress,
  updateFileStatus,
  queryClient
}: {
  file: UploadItem
  updateFileProgress: (id: string, progress: number) => void
  updateFileStatus: (id: string, status: UploadItem['status'], error?: string) => void
  queryClient: any
}) {
  const started = useRef(false)

  useEffect(() => {
    if (started.current || file.status !== 'pending') return
    started.current = true

    const nativeFile = fileRegistry.get(file.id)
    if (!nativeFile) {
      updateFileStatus(file.id, 'error', 'File not found in local registry')
      return
    }

    const startUpload = async () => {
      try {
        updateFileStatus(file.id, 'uploading')
        
        // 1. Initialize resumable session
        const initRes = await api.post<{ success: boolean; data: { uploadUrl: string; tempFileId: string } }>(
          '/api/drive/upload/init',
          {
            fileName: file.name,
            mimeType: nativeFile.type || 'application/octet-stream'
          }
        )

        if (!initRes.data.success || !initRes.data.data.uploadUrl) {
          throw new Error('Failed to retrieve upload target URL')
        }

        const { uploadUrl, tempFileId } = initRes.data.data

        // 2. Perform resumable upload directly to Google API (using clean axios without headers)
        await axios.put(uploadUrl, nativeFile, {
          headers: {
            'Content-Type': nativeFile.type || 'application/octet-stream'
          },
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total ?? nativeFile.size
            const percentage = Math.round((progressEvent.loaded * 100) / total)
            updateFileProgress(file.id, percentage)
          }
        })

        // 3. Mark upload as complete to run parse queue
        updateFileStatus(file.id, 'completing')
        const completeRes = await api.post('/api/drive/upload/complete', { fileId: tempFileId })

        if (!completeRes.data.success) {
          throw new Error('Pipeline initialization failed')
        }

        updateFileStatus(file.id, 'success')
        fileRegistry.delete(file.id) // Cleanup registry

        // Invalidate cache immediately to reflect the new document state
        void queryClient.invalidateQueries({ queryKey: ['drive-status'] })
        void queryClient.invalidateQueries({ queryKey: ['documents'] })
        void queryClient.invalidateQueries({ queryKey: ['recent-documents'] })
      } catch (err: any) {
        console.error('File upload pipeline error:', err)
        const errMsg = err.response?.data?.error?.message || err.message || 'Network failure'
        updateFileStatus(file.id, 'error', errMsg)
        fileRegistry.delete(file.id) // Cleanup registry
      }
    }

    void startUpload()
  }, [file.id, file.status, updateFileProgress, updateFileStatus, queryClient])

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusDetails = () => {
    switch (file.status) {
      case 'uploading':
        return `Uploading: ${file.progress}%`
      case 'completing':
        return 'Analyzing & indexing file context...'
      case 'success':
        return 'Ingestion successful!'
      case 'error':
        return `Failed: ${file.error || 'Unknown error'}`
      default:
        return 'Queued'
    }
  }

  return (
    <div className="bg-white/5 border border-outline-variant/30 rounded-lg p-md flex flex-col gap-sm text-xs leading-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-md min-w-0 max-w-[70%]">
          <span className="material-symbols-outlined text-primary text-[18px] flex-shrink-0">
            description
          </span>
          <span className="text-on-surface font-medium truncate block">{file.name}</span>
        </div>
        <span className="text-on-surface-variant text-[10px] font-mono flex-shrink-0">
          {formatBytes(file.size)}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] font-medium mt-1">
        <span className={`${
          file.status === 'success' ? 'text-secondary' :
          file.status === 'error' ? 'text-error' :
          'text-on-surface-variant'
        }`}>
          {getStatusDetails()}
        </span>
        {file.status === 'success' && (
          <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
        )}
        {file.status === 'error' && (
          <span className="material-symbols-outlined text-error text-sm">error</span>
        )}
      </div>

      {file.status !== 'success' && file.status !== 'error' && (
        <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden mt-1">
          <div 
            className={`h-full transition-all duration-300 ${
              file.status === 'completing' ? 'bg-secondary animate-pulse w-full' : 'bg-primary'
            }`}
            style={{ width: `${file.status === 'completing' ? 100 : file.progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
