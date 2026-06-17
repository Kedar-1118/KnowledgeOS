// apps/frontend/src/pages/LibraryPage.tsx
/**
 * LibraryPage — Spreadsheet Finder-style Document Repository.
 * Lists all indexed files with live search, pipeline filter, and layout toggles.
 * Features an inspector sidebar detailing AI abstract summaries, categories, and statistics.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface TagItem {
  id: string;
  name: string;
  category: string | null;
  color: string;
  confidence: number;
}

interface DocumentItem {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSizeBytes: number;
  status: string;
  summary: string | null;
  readingTimeMinutes: number | null;
  lastAccessedAt: string | null;
  accessCount: number;
  driveFileUrl: string | null;
  createdAt: string;
  tags: TagItem[];
}

interface ListResponse {
  documents: DocumentItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const STATUS_OPTIONS = ['ALL', 'PENDING', 'PROCESSING', 'INDEXED', 'FAILED'] as const;
const FORMAT_OPTIONS = ['ALL', 'PDF', 'TXT', 'MD', 'IMAGE', 'VIDEO', 'OTHER'] as const;

export function LibraryPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [formatFilter, setFormatFilter] = useState<string>('ALL');

  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress(0);
      
      // 1. Init Upload
      const initRes = await api.post<{ success: boolean; data: { uploadUrl: string; tempFileId: string } }>(
        '/api/drive/upload/init',
        { fileName: file.name, mimeType: file.type || 'application/octet-stream', fileSizeBytes: file.size }
      );
      
      const { uploadUrl, tempFileId } = initRes.data.data;

      // 2. Direct PUT to Drive
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = async () => {
          if (xhr.status === 200 || xhr.status === 201 || xhr.status === 308) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => reject(new Error('Network error during upload'));
        
        xhr.send(file);
      });

      setUploadProgress(100);

      // 3. Complete Upload
      await api.post('/api/drive/upload/complete', { fileId: tempFileId });
      
      // Invalidate and reset
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      setUploadProgress(null);
      event.target.value = ''; // Reset input
    } catch (err) {
      console.error('Upload error:', err);
      setUploadProgress(null);
      alert('Upload failed. Please try again.');
    }
  };

  // ─── Query: Fetch Documents ───
  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ['documents', page, search, statusFilter, formatFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '12');
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (formatFilter !== 'ALL') params.set('fileType', formatFilter);

      const res = await api.get<{ success: boolean; data: ListResponse }>(
        `/api/documents?${params.toString()}`
      );
      return res.data.data;
    },
  });

  // ─── Mutation: Delete Document ───
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      await api.delete(`/api/documents/${docId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      void queryClient.invalidateQueries({ queryKey: ['drive-status'] });
      setDeleteConfirmId(null);
      setSelectedDoc(null);
    },
  });

  // ─── Mutation: Generate Flashcards ───
  const generateCardsMutation = useMutation({
    mutationFn: async (docId: string) => {
      await api.post(`/api/revision/generate/${docId}`);
    },
    onSuccess: () => {
      alert('Flashcard generation started in the background. They will appear in your Revision deck shortly.');
    },
  });

  const { pagination } = data ?? { pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } };

  return (
    <div className="animate-fade-in relative min-h-screen select-none flex">
      {/* Library Canvas */}
      <section className={`flex-1 overflow-hidden flex flex-col gap-lg transition-all duration-300 ${selectedDoc ? 'pr-[400px]' : ''}`}>
        
        {/* Page Title & Quick Actions */}
        <div className="flex justify-between items-end flex-wrap gap-md">
          <div>
            <h2 className="font-headline-lg text-headline-lg tracking-tight mb-2 text-on-surface">Document Library</h2>
            <p className="text-on-surface-variant max-w-lg text-xs">Manage your indexed datasets and ingest new knowledge sources into the Nexus AI neural network.</p>
          </div>
          <div className="flex gap-2">
            {/* Upload Button */}
            {uploadProgress !== null && (
              <div className="flex items-center gap-2 mr-2 text-xs font-bold text-primary">
                <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                {uploadProgress}%
              </div>
            )}
            <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all font-bold text-xs mr-2">
              <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
              Upload
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>

            {/* View Mode Switches */}
            <div className="flex items-center gap-1.5 bg-surface/50 border border-outline-variant rounded-lg p-0.5 mr-2">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors cursor-pointer flex items-center justify-center ${
                  viewMode === 'list'
                    ? 'bg-white/5 border border-outline-variant text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="List View"
              >
                <span className="material-symbols-outlined text-[18px]">list</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors cursor-pointer flex items-center justify-center ${
                  viewMode === 'grid'
                    ? 'bg-white/5 border border-outline-variant text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Grid View"
              >
                <span className="material-symbols-outlined text-[18px]">grid_on</span>
              </button>
            </div>
            <div className="flex gap-2">
              {/* Search Box */}
              <div className="relative flex items-center bg-surface-container border border-outline-variant rounded px-3 py-1 font-label-sm text-xs">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant mr-2">search</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Quick search..."
                  className="bg-transparent border-none outline-none text-on-surface placeholder:text-on-surface-variant/40 w-32 focus:w-44 transition-all"
                />
                {search && (
                  <button onClick={() => { setSearch(''); setPage(1); }} className="cursor-pointer">
                    <span className="material-symbols-outlined text-xs text-on-surface-variant hover:text-on-surface">close</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap gap-md items-center glass-panel p-4 rounded-xl">
          <div className="flex items-center gap-sm pr-4 border-r border-outline-variant flex-wrap">
            <span className="font-label-sm text-label-sm text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">FORMATS</span>
            <div className="flex gap-2 flex-wrap">
              {FORMAT_OPTIONS.map((fmt) => (
                <span
                  key={fmt}
                  onClick={() => { setFormatFilter(fmt); setPage(1); }}
                  className={`px-3 py-1 rounded text-[11px] font-bold border cursor-pointer transition-all ${
                    formatFilter === fmt
                      ? 'bg-primary-container/20 text-on-primary-container border-primary/30'
                      : 'bg-surface-container-high text-on-surface-variant border-outline-variant hover:border-primary/50'
                  }`}
                >
                  {fmt}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-sm px-4 flex-wrap">
            <span className="font-label-sm text-label-sm text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">INDEX STATUS</span>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((st) => (
                <button
                  key={st}
                  onClick={() => { setStatusFilter(st); setPage(1); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer border ${
                    statusFilter === st
                      ? 'bg-white/5 border-primary text-primary font-bold'
                      : 'bg-transparent border-transparent text-on-surface-variant hover:bg-white/5 hover:text-on-surface'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    st === 'INDEXED' ? 'bg-secondary' :
                    st === 'PROCESSING' ? 'bg-amber-400' :
                    st === 'PENDING' ? 'bg-blue-400' :
                    st === 'FAILED' ? 'bg-error' : 'bg-on-surface-variant'
                  }`}></span>
                  <span className="text-[11px] font-bold uppercase">{st}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Display area */}
        {isLoading ? (
          <div className="p-xl space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : data && data.documents.length > 0 ? (
          <div className="flex-1 flex flex-col justify-between">
            {viewMode === 'list' ? (
              /* List View Table */
              <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high/50 border-b border-outline-variant text-[10px] font-bold">
                      <th className="px-6 py-4 font-label-sm text-on-surface-variant">FILENAME</th>
                      <th className="px-6 py-4 font-label-sm text-on-surface-variant">FORMAT</th>
                      <th className="px-6 py-4 font-label-sm text-on-surface-variant">SIZE</th>
                      <th className="px-6 py-4 font-label-sm text-on-surface-variant">LAST UPDATED</th>
                      <th className="px-6 py-4 font-label-sm text-on-surface-variant">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30 text-xs">
                    {data.documents.map((doc) => (
                      <tr
                        key={doc.id}
                        onClick={() => setSelectedDoc(doc)}
                        className={`hover:bg-white/5 cursor-pointer transition-colors group ${
                          selectedDoc?.id === doc.id ? 'bg-white/10' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`material-symbols-outlined ${
                              doc.fileType === 'PDF' ? 'text-red-400' :
                              doc.fileType === 'IMAGE' ? 'text-amber-400' :
                              doc.fileType === 'VIDEO' ? 'text-secondary' : 'text-primary'
                            }`}>
                              {doc.fileType === 'PDF' ? 'picture_as_pdf' : doc.fileType === 'IMAGE' ? 'image' : 'description'}
                            </span>
                            <span className="font-medium text-on-surface truncate block max-w-xs sm:max-w-md">{doc.title}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-code text-[11px] opacity-75 font-bold uppercase">{doc.fileType}</span>
                        </td>
                        <td className="px-6 py-4 text-on-surface-variant text-xs font-mono">{formatBytes(doc.fileSizeBytes)}</td>
                        <td className="px-6 py-4 text-on-surface-variant text-xs font-mono">{formatTime(doc.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              doc.status === 'INDEXED' ? 'bg-secondary status-pulse' :
                              doc.status === 'PROCESSING' ? 'bg-amber-400 animate-spin' :
                              doc.status === 'PENDING' ? 'bg-blue-400' : 'bg-error'
                            }`}></span>
                            <span className={`text-[11px] font-bold ${
                              doc.status === 'INDEXED' ? 'text-secondary' :
                              doc.status === 'PROCESSING' ? 'text-amber-400' :
                              doc.status === 'PENDING' ? 'text-blue-400' : 'text-error'
                            }`}>{doc.status}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                <div className="mt-auto border-t border-outline-variant p-4 flex justify-between items-center bg-surface-container-low/30">
                  <span className="font-label-sm text-label-sm text-on-surface-variant text-xs">
                    Showing {data.documents.length} of {pagination.total} documents
                  </span>
                  {pagination.totalPages > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 rounded border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all material-symbols-outlined text-[18px] disabled:opacity-30 cursor-pointer"
                      >
                        chevron_left
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={page === pagination.totalPages}
                        className="px-3 py-1 rounded border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all material-symbols-outlined text-[18px] disabled:opacity-30 cursor-pointer"
                      >
                        chevron_right
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Grid View Layout */
              <div className="flex flex-col justify-between flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {data.documents.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between h-40 bg-surface/50 border-outline-variant ${
                        selectedDoc?.id === doc.id
                          ? 'border-primary bg-surface shadow-md'
                          : 'hover:border-text-muted hover:bg-surface-hover/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`material-symbols-outlined flex-shrink-0 ${
                            doc.fileType === 'PDF' ? 'text-red-400' :
                            doc.fileType === 'IMAGE' ? 'text-amber-400' :
                            doc.fileType === 'VIDEO' ? 'text-secondary' : 'text-primary'
                          }`}>
                            {doc.fileType === 'PDF' ? 'picture_as_pdf' : doc.fileType === 'IMAGE' ? 'image' : 'description'}
                          </span>
                          <h3 className="text-xs font-bold text-on-surface truncate leading-tight">{doc.title}</h3>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          doc.status === 'INDEXED' ? 'bg-secondary-container/20 text-secondary border border-secondary/20' :
                          doc.status === 'PROCESSING' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' :
                          doc.status === 'PENDING' ? 'bg-blue-400/10 text-blue-400 border border-blue-400/20' : 'bg-error/10 text-error border border-error/20'
                        }`}>
                          {doc.status}
                        </span>
                      </div>

                      {doc.summary && (
                        <p className="text-[11px] text-on-surface-variant leading-relaxed line-clamp-2 mt-2">
                          {doc.summary}
                        </p>
                      )}

                      <div className="mt-4 flex items-center justify-between text-[10px] text-on-surface-variant border-t border-outline-variant/30 pt-2 font-mono">
                        <span>{formatBytes(doc.fileSizeBytes)}</span>
                        <span>{doc.readingTimeMinutes ? `${doc.readingTimeMinutes}m read` : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between mt-6 border-t border-outline-variant p-4 bg-surface-container-low/30 rounded-xl">
                  <span className="text-xs text-on-surface-variant font-medium">
                    Showing {data.documents.length} of {pagination.total} documents
                  </span>
                  {pagination.totalPages > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 rounded border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all material-symbols-outlined text-[18px] disabled:opacity-30 cursor-pointer"
                      >
                        chevron_left
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={page === pagination.totalPages}
                        className="px-3 py-1 rounded border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all material-symbols-outlined text-[18px] disabled:opacity-30 cursor-pointer"
                      >
                        chevron_right
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-outline-variant bg-surface/50 p-12 text-center flex-1 flex flex-col justify-center items-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">find_in_page</span>
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">No matching files</h3>
            <p className="text-xs text-on-surface-variant mt-2 max-w-xs leading-relaxed">
              Try expanding your search query filters or synchronize your Drive folder.
            </p>
          </div>
        )}
      </section>

      {/* Right Side: Document Inspector Panel aside drawer */}
      <aside 
        className={`w-[400px] h-[calc(100vh-64px)] fixed right-0 top-16 bg-surface-container border-l border-outline-variant transition-all duration-300 ease-in-out z-40 overflow-y-auto ${
          selectedDoc ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedDoc ? (
          <div className="p-lg flex flex-col justify-between min-h-full space-y-6">
            <div>
              {/* Header */}
              <div className="flex justify-between items-start mb-xl">
                <div>
                  <span className="font-label-sm text-label-sm text-primary-container bg-primary-container/10 px-2 py-0.5 rounded mb-2 inline-block text-[10px] font-bold">
                    DOCUMENT INSPECTOR
                  </span>
                  <h3 className="font-headline-lg text-lg leading-tight text-on-surface font-semibold" id="inspector-title">
                    {selectedDoc.title}
                  </h3>
                </div>
                <button 
                  className="material-symbols-outlined text-on-surface-variant hover:text-on-surface cursor-pointer text-[20px]"
                  onClick={() => setSelectedDoc(null)}
                >
                  close
                </button>
              </div>

              {/* Preview Area layout */}
              <div className="w-full aspect-video rounded-lg mb-xl relative overflow-hidden group border border-white/5 bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-5xl opacity-40">find_in_page</span>
                {selectedDoc.driveFileUrl && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-surface/60 backdrop-blur-sm transition-opacity">
                    <button 
                      onClick={() => window.open(selectedDoc.driveFileUrl!, '_blank')}
                      className="bg-white text-black px-4 py-2 rounded-full font-bold text-xs cursor-pointer"
                    >
                      Open in Drive
                    </button>
                  </div>
                )}
              </div>

              {/* AI Abstract Summary */}
              <div className="mb-xl">
                <div className="flex items-center gap-2 mb-sm text-primary">
                  <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                  <span className="font-bold text-xs tracking-wide uppercase">AI ABSTRACT SUMMARY</span>
                </div>
                <div className="glass-panel p-4 rounded-lg text-xs leading-relaxed text-on-surface-variant max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {selectedDoc.summary || 'Parsing file text... Summary pending.'}
                </div>
              </div>

              {/* Categories Tags */}
              {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                <div className="mb-xl">
                  <div className="flex items-center gap-2 mb-sm text-secondary">
                    <span className="material-symbols-outlined text-[20px]">label</span>
                    <span className="font-bold text-xs tracking-wide uppercase">CATEGORIZATION</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedDoc.tags.map((tag) => (
                      <span 
                        key={tag.id}
                        className="px-2.5 py-0.75 rounded bg-surface-container-high border border-outline-variant text-[10px] font-mono font-bold"
                        style={{ color: tag.color || '#c3c0ff', borderColor: `${tag.color || '#c3c0ff'}20` }}
                      >
                        {tag.name.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              <div>
                <div className="flex items-center gap-2 mb-sm text-amber-400">
                  <span className="material-symbols-outlined text-[20px]">analytics</span>
                  <span className="font-bold text-xs tracking-wide uppercase">INDEXING METRICS</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="glass-panel p-3 rounded-lg">
                    <p className="text-[9px] text-on-surface-variant mb-1 uppercase font-bold tracking-widest">Read Time</p>
                    <p className="font-code text-base text-primary font-bold">{selectedDoc.readingTimeMinutes ? `${selectedDoc.readingTimeMinutes}m` : 'N/A'}</p>
                  </div>
                  <div className="glass-panel p-3 rounded-lg">
                    <p className="text-[9px] text-on-surface-variant mb-1 uppercase font-bold tracking-widest">Access Count</p>
                    <p className="font-code text-base text-secondary font-bold">{selectedDoc.accessCount} clicks</p>
                  </div>
                  <div className="glass-panel p-3 rounded-lg col-span-2">
                    <p className="text-[9px] text-on-surface-variant mb-1 uppercase font-bold tracking-widest font-mono">Index Identifier</p>
                    <p className="font-code text-[10px] text-on-surface truncate font-mono">{selectedDoc.id}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="pt-lg border-t border-outline-variant flex flex-col gap-3">
              <button 
                onClick={() => generateCardsMutation.mutate(selectedDoc.id)}
                disabled={generateCardsMutation.isPending}
                className="w-full bg-primary/20 text-primary font-bold py-2 rounded border border-primary/30 hover:bg-primary/30 transition-all text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">style</span>
                {generateCardsMutation.isPending ? 'Generating...' : 'Generate Flashcards'}
              </button>
              
              <div className="flex gap-3">
                {selectedDoc.driveFileUrl && (
                  <button 
                    onClick={() => window.open(selectedDoc.driveFileUrl!, '_blank')}
                    className="flex-1 bg-surface-container-highest text-on-surface font-bold py-2 rounded border border-outline-variant hover:bg-white/5 transition-all text-xs cursor-pointer"
                  >
                    View Source
                  </button>
                )}
              {deleteConfirmId === selectedDoc.id ? (
                <div className="flex-1 flex gap-2">
                  <button
                    onClick={() => deleteMutation.mutate(selectedDoc.id)}
                    disabled={deleteMutation.isPending}
                    className="flex-1 bg-error text-white font-bold py-2 rounded text-xs cursor-pointer"
                  >
                    Yes, Purge
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 bg-surface border border-outline-variant text-on-surface font-bold py-2 rounded text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setDeleteConfirmId(selectedDoc.id)}
                  className="flex-1 bg-error/10 text-error font-bold py-2 rounded border border-error/20 hover:bg-error/20 transition-all text-xs cursor-pointer"
                >
                  Purge Index
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-3 opacity-30">info</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">File Inspector</h4>
            <p className="text-[11px] mt-1.5 leading-relaxed max-w-[180px]">
              Select any document row in the table to display summary analyses and classification parameters.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

/* HELPER FUNCTIONS */

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
