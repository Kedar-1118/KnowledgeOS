// apps/frontend/src/pages/LibraryPage.tsx
/**
 * Redesigned Library Page.
 * Finder-style document hub: Left side features clean data rows;
 * Right side features an Inspector Drawer that details summary transcripts, tags, and file statistics.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Grid3X3,
  List,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Clock,
  ChevronLeft,
  ChevronRight,
  File,
  FileImage,
  FileVideo,
  X,
  Info,
  Calendar,
  Eye,
} from 'lucide-react';

import { api } from '../lib/api';

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
  tags: Array<{
    id: string;
    name: string;
    category: string | null;
    color: string;
    confidence: number;
  }>;
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
const FILE_TYPE_OPTIONS = ['ALL', 'PDF', 'TXT', 'MD', 'IMAGE', 'VIDEO', 'OTHER'] as const;

export function LibraryPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('ALL');
  
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ['documents', page, search, statusFilter, fileTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (fileTypeFilter !== 'ALL') params.set('fileType', fileTypeFilter);

      const res = await api.get<{ success: boolean; data: ListResponse }>(
        `/api/documents?${params.toString()}`
      );
      return res.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      await api.delete(`/api/documents/${docId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      setDeleteConfirm(null);
      setSelectedDoc(null); // Reset selection
    },
  });

  const { pagination } = data ?? { pagination: { page: 1, limit: 15, total: 0, totalPages: 0 } };

  return (
    <div className="animate-fade-in space-y-6 select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary uppercase tracking-wider">
            Document Repository
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            {pagination.total} synced items. Ingested data is inspected in detail in the right sidebar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-surface border-surface-border text-accent-teal'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Grid3X3 size={15} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              viewMode === 'list'
                ? 'bg-surface border-surface-border text-accent-teal'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Filter Options */}
      <div className="flex flex-col gap-3 py-1.5 border-b border-surface-border">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search bar */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-surface-border bg-surface flex-1 min-w-[240px] max-w-[400px]">
            <Search size={14} className="text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Filter file library..."
              className="bg-transparent border-none outline-none text-xs flex-1"
              style={{ color: 'var(--color-text-primary)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="cursor-pointer">
                <X size={13} className="text-text-muted hover:text-text-primary" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Filter size={11} /> Pipeline:
            </span>
            <div className="flex bg-surface-hover/30 border border-surface-border rounded-lg p-0.75">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wide transition-colors cursor-pointer ${
                    statusFilter === s
                      ? 'bg-surface text-accent-teal border border-surface-border shadow-sm'
                      : 'text-text-secondary hover:text-text-primary border border-transparent'
                  }`}
                >
                  {s === 'ALL' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* File Format Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Format:
          </span>
          <div className="flex gap-1">
            {FILE_TYPE_OPTIONS.map(ft => (
              <button
                key={ft}
                onClick={() => { setFileTypeFilter(ft); setPage(1); }}
                className={`px-2 py-0.75 rounded-md text-[9px] font-bold tracking-wider transition-colors cursor-pointer ${
                  fileTypeFilter === ft
                    ? 'bg-accent-purple/10 border border-accent-purple/20 text-accent-purple shadow-sm'
                    : 'text-text-secondary hover:text-text-primary border border-transparent'
                }`}
              >
                {ft}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Workspace: Left content, Right Inspector Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Area: Document View List/Grid */}
        <div className="lg:col-span-8 flex flex-col min-h-[500px]">
          {isLoading ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-3'}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="rounded-xl border border-surface-border bg-surface p-4.5 space-y-3">
                  <div className="skeleton h-5 w-2/3" />
                  <div className="skeleton h-3.5 w-full" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : data && data.documents.length > 0 ? (
            <div className="flex-1 flex flex-col justify-between">
              
              {/* Spreadsheet rows */}
              {viewMode === 'list' ? (
                <div className="border border-surface-border rounded-xl bg-surface overflow-hidden shadow-sm">
                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-surface-border text-[10px] font-bold text-text-muted uppercase tracking-wider bg-background-elevated/40">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-2 text-center">Status</div>
                    <div className="col-span-2 text-center">Type</div>
                    <div className="col-span-2 text-right">Size</div>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-surface-border max-h-[550px] overflow-y-auto">
                    {data.documents.map(doc => (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoc(doc)}
                        className={`grid grid-cols-12 gap-4 px-4 py-3 text-xs items-center cursor-pointer transition-colors ${
                          selectedDoc?.id === doc.id
                            ? 'bg-surface-hover/80 text-text-primary font-medium'
                            : 'hover:bg-surface-hover/30 text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                          <FileIconResolver type={doc.fileType} />
                          <span className="truncate">{doc.title}</span>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <span className={`badge ${
                            doc.status === 'INDEXED' ? 'badge-indexed' :
                            doc.status === 'PROCESSING' ? 'badge-processing' :
                            doc.status === 'PENDING' ? 'badge-pending' : 'badge-failed'
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                        <div className="col-span-2 text-center text-[10px] font-mono tracking-wider font-semibold text-text-muted">
                          {doc.fileType}
                        </div>
                        <div className="col-span-2 text-right font-mono text-[10px]">
                          {formatBytes(doc.fileSizeBytes)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Grid Cards */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[550px] overflow-y-auto pr-1">
                  {data.documents.map(doc => (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between h-40 ${
                        selectedDoc?.id === doc.id
                          ? 'bg-surface border-accent-teal shadow-md'
                          : 'bg-surface border-surface-border hover:border-text-muted'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileIconResolver type={doc.fileType} />
                          <h3 className="text-xs font-bold text-text-primary truncate">{doc.title}</h3>
                        </div>
                        <span className={`badge ${
                          doc.status === 'INDEXED' ? 'badge-indexed' :
                          doc.status === 'PROCESSING' ? 'badge-processing' :
                          doc.status === 'PENDING' ? 'badge-pending' : 'badge-failed'
                        }`}>
                          {doc.status}
                        </span>
                      </div>

                      {doc.summary && (
                        <p className="text-[10px] text-text-secondary leading-relaxed line-clamp-2 mt-2">
                          {doc.summary}
                        </p>
                      )}

                      <div className="mt-4 flex items-center justify-between text-[10px] text-text-muted border-t border-surface-border pt-2">
                        <span>{formatBytes(doc.fileSizeBytes)}</span>
                        <span>{doc.readingTimeMinutes ? `${doc.readingTimeMinutes} min read` : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-surface-border text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-text-secondary font-medium">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="p-1.5 rounded-lg border border-surface-border text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Empty state */
            <div className="rounded-2xl border border-surface-border bg-surface p-12 text-center flex-1 flex flex-col justify-center items-center">
              <FileText size={32} className="text-text-muted mb-4" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">No files located</h3>
              <p className="text-xs text-text-secondary mt-2 max-w-sm leading-relaxed">
                Adjust search queries or launch drive sync configurations to load document lists.
              </p>
            </div>
          )}
        </div>

        {/* Right Drawer: File Inspector (35% width) */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-surface-border bg-surface p-6 h-full flex flex-col justify-between shadow-[0_4px_25px_rgba(0,0,0,0.3)] sticky top-6">
            {selectedDoc ? (
              <div className="flex flex-col justify-between h-full space-y-6">
                
                {/* Meta Header */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileIconResolver type={selectedDoc.fileType} />
                      <h3 className="text-xs font-bold text-text-primary leading-snug line-clamp-2">
                        {selectedDoc.title}
                      </h3>
                    </div>
                    
                    <span className="text-[10px] font-mono font-bold text-text-muted bg-background-elevated border border-surface-border px-1.5 py-0.5 rounded">
                      {selectedDoc.fileType}
                    </span>
                  </div>

                  <p className="text-[10px] text-text-muted break-all font-mono">
                    ID: {selectedDoc.id}
                  </p>
                </div>

                {/* Abstract Text Summary */}
                <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">
                    AI Abstract Summary
                  </span>
                  <div className="bg-background-elevated p-4 rounded-xl border border-surface-border text-[11px] text-text-secondary leading-relaxed font-sans max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {selectedDoc.summary || 'Summary unavailable. Processing pipeline is running.'}
                  </div>
                </div>

                {/* Tags section */}
                {selectedDoc.tags.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">
                      Associated Tags
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {selectedDoc.tags.map((tag, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1 px-2 py-0.75 rounded border bg-background-elevated text-[10px]"
                          style={{
                            borderColor: `${tag.color || '#6366f1'}20`,
                            color: tag.color || '#6366f1',
                          }}
                        >
                          <span>{tag.name}</span>
                          <span className="text-[8px] opacity-65 font-mono">
                            {(tag.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats rows */}
                <div className="space-y-2 border-t border-surface-border pt-4">
                  <InspectorRowIcon icon={<Clock size={11} />} label="Reading Time" value={selectedDoc.readingTimeMinutes ? `${selectedDoc.readingTimeMinutes} min` : 'N/A'} />
                  <InspectorRowIcon icon={<Calendar size={11} />} label="Ingested On" value={new Date(selectedDoc.createdAt).toLocaleDateString()} />
                  <InspectorRowIcon icon={<Eye size={11} />} label="Access Logs" value={`${selectedDoc.accessCount} clicks`} />
                </div>

                {/* Action CTA Panel */}
                <div className="space-y-2 pt-2">
                  {selectedDoc.driveFileUrl && (
                    <button
                      onClick={() => window.open(selectedDoc.driveFileUrl!, '_blank')}
                      className="btn-google w-full justify-center py-2.5 rounded-lg border border-surface-border hover:bg-surface-hover cursor-pointer"
                    >
                      <span className="text-[11px] font-bold">Open File in Drive</span>
                      <ExternalLink size={12} className="text-text-muted" />
                    </button>
                  )}

                  {deleteConfirm === selectedDoc.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => deleteMutation.mutate(selectedDoc.id)}
                        disabled={deleteMutation.isPending}
                        className="flex-1 py-2.5 rounded-lg text-center text-[10px] font-bold bg-error/15 border border-error/30 text-error hover:bg-error/20 transition-colors cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="flex-1 py-2.5 rounded-lg text-center text-[10px] font-bold bg-surface border border-surface-border text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(selectedDoc.id)}
                      className="w-full justify-center py-2 rounded-lg border border-transparent text-text-muted hover:text-error hover:bg-error/5 hover:border-error/20 transition-all duration-200 cursor-pointer flex items-center gap-1.5 text-[10px] font-bold"
                    >
                      <Trash2 size={12} />
                      <span>Delete Document Index</span>
                    </button>
                  )}
                </div>

              </div>
            ) : (
              /* Awaiting selection placeholder */
              <div className="flex-1 flex flex-col justify-center items-center text-center p-6 border border-dashed border-surface-border rounded-xl">
                <FileText size={24} className="text-text-muted mb-3" />
                <h4 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">File Metadata</h4>
                <p className="text-[10px] text-text-secondary mt-1.5 leading-relaxed max-w-[150px]">
                  Select a document file row to inspect catalog profiles, summaries and classifications.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* HELPER ROW METRICS */

function InspectorRowIcon({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-[10px] text-text-secondary leading-none">
      <span className="flex items-center gap-1 text-text-muted">
        {icon} {label}
      </span>
      <span className="font-bold text-text-primary">{value}</span>
    </div>
  );
}

/* FILE TYPE ICON RESOLVER */

function FileIconResolver({ type }: { type: string }) {
  const color = {
    PDF: 'text-error',
    TXT: 'text-accent-teal',
    MD: 'text-accent-purple',
    IMAGE: 'text-warning',
    VIDEO: 'text-success',
    OTHER: 'text-text-muted',
  }[type] || 'text-text-muted';

  if (type === 'IMAGE') return <FileImage size={15} className={color} />;
  if (type === 'VIDEO') return <FileVideo size={15} className={color} />;
  return <File size={15} className={color} />;
}

/* BYTE SIZE FORMATTER */

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
