// apps/frontend/src/pages/LibraryPage.tsx
/**
 * Library Page — Document grid/list view with filters, search, and status indicators.
 *
 * Features:
 * - Grid and list view toggle
 * - Search, status filter, file type filter
 * - Document cards with tags, status badges, reading time
 * - Click to open in Drive
 * - Delete with confirmation
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('ALL');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ['documents', page, search, statusFilter, fileTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
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
    },
  });

  const { pagination } = data ?? { pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Library
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {pagination.total} document{pagination.total !== 1 ? 's' : ''} in your knowledge base
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: viewMode === 'grid' ? 'rgba(29,158,117,0.1)' : 'transparent',
              color: viewMode === 'grid' ? 'var(--color-accent-teal)' : 'var(--color-text-muted)',
            }}
          >
            <Grid3X3 size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: viewMode === 'list' ? 'rgba(29,158,117,0.1)' : 'transparent',
              color: viewMode === 'list' ? 'var(--color-accent-teal)' : 'var(--color-text-muted)',
            }}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[200px] max-w-[400px]"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-surface-border)',
          }}
        >
          <Search size={16} style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Filter documents..."
            className="bg-transparent border-none outline-none text-sm flex-1"
            style={{ color: 'var(--color-text-primary)' }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X size={14} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1">
          <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                backgroundColor: statusFilter === s ? 'rgba(29,158,117,0.15)' : 'transparent',
                color: statusFilter === s ? 'var(--color-accent-teal)' : 'var(--color-text-muted)',
              }}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* File type filter */}
        <div className="flex items-center gap-1">
          {FILE_TYPE_OPTIONS.map(ft => (
            <button
              key={ft}
              onClick={() => { setFileTypeFilter(ft); setPage(1); }}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                backgroundColor: fileTypeFilter === ft ? 'rgba(127,119,221,0.15)' : 'transparent',
                color: fileTypeFilter === ft ? 'var(--color-accent-purple)' : 'var(--color-text-muted)',
              }}
            >
              {ft}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-3'}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div
              key={i}
              className="rounded-xl p-5"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-surface-border)',
              }}
            >
              <div className="skeleton h-5 w-3/4 mb-3" />
              <div className="skeleton h-3 w-full mb-2" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : data && data.documents.length > 0 ? (
        <>
          {/* Document grid/list */}
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'flex flex-col gap-3'
          }>
            {data.documents.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                viewMode={viewMode}
                isDeleteConfirm={deleteConfirm === doc.id}
                onDeleteClick={() => setDeleteConfirm(doc.id)}
                onDeleteCancel={() => setDeleteConfirm(null)}
                onDeleteConfirm={() => deleteMutation.mutate(doc.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg transition-colors"
                style={{
                  color: page === 1 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Page {page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-2 rounded-lg transition-colors"
                style={{
                  color: page === pagination.totalPages ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                  cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div
          className="rounded-xl p-8 text-center"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-surface-border)',
          }}
        >
          <FileText size={40} style={{ color: 'var(--color-text-muted)', margin: '0 auto 16px' }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            {search || statusFilter !== 'ALL' || fileTypeFilter !== 'ALL'
              ? 'No matching documents'
              : 'No documents yet'}
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {search || statusFilter !== 'ALL' || fileTypeFilter !== 'ALL'
              ? 'Try adjusting your filters.'
              : 'Sync your Google Drive to get started.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Document Card ───

function DocumentCard({
  doc,
  viewMode,
  isDeleteConfirm,
  onDeleteClick,
  onDeleteCancel,
  onDeleteConfirm,
}: {
  doc: DocumentItem;
  viewMode: 'grid' | 'list';
  isDeleteConfirm: boolean;
  onDeleteClick: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}) {
  const FileIcon = doc.fileType === 'IMAGE' ? FileImage
    : doc.fileType === 'VIDEO' ? FileVideo
    : File;

  const statusBadgeClass = {
    PENDING: 'badge-pending',
    PROCESSING: 'badge-processing',
    INDEXED: 'badge-indexed',
    FAILED: 'badge-failed',
  }[doc.status] ?? '';

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (viewMode === 'list') {
    return (
      <div
        className="rounded-xl p-4 card-hover flex items-center gap-4"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-surface-border)',
        }}
      >
        <FileIcon size={20} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <h3
            className="text-sm font-medium truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {doc.title}
          </h3>
          <p
            className="text-xs truncate"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {doc.fileName} · {formatBytes(doc.fileSizeBytes)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {doc.tags.slice(0, 2).map((tag, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          <span className={`badge ${statusBadgeClass}`}>{doc.status}</span>
          <ActionButtons
            doc={doc}
            isDeleteConfirm={isDeleteConfirm}
            onDeleteClick={onDeleteClick}
            onDeleteCancel={onDeleteCancel}
            onDeleteConfirm={onDeleteConfirm}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-5 card-hover flex flex-col"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-surface-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileIcon size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <h3
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {doc.title}
          </h3>
        </div>
        <span className={`badge ${statusBadgeClass} flex-shrink-0`}>
          {doc.status}
        </span>
      </div>

      {/* Summary */}
      {doc.summary && (
        <p
          className="text-xs mb-3 line-clamp-2"
          style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}
        >
          {doc.summary}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {doc.tags.slice(0, 3).map((tag, i) => (
          <span
            key={i}
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
          >
            {tag.name}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {formatBytes(doc.fileSizeBytes)}
          </span>
          {doc.readingTimeMinutes && (
            <span
              className="text-xs flex items-center gap-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Clock size={11} /> {doc.readingTimeMinutes} min
            </span>
          )}
        </div>
        <ActionButtons
          doc={doc}
          isDeleteConfirm={isDeleteConfirm}
          onDeleteClick={onDeleteClick}
          onDeleteCancel={onDeleteCancel}
          onDeleteConfirm={onDeleteConfirm}
        />
      </div>
    </div>
  );
}

function ActionButtons({
  doc,
  isDeleteConfirm,
  onDeleteClick,
  onDeleteCancel,
  onDeleteConfirm,
}: {
  doc: DocumentItem;
  isDeleteConfirm: boolean;
  onDeleteClick: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {doc.driveFileUrl && (
        <button
          onClick={(e) => { e.stopPropagation(); window.open(doc.driveFileUrl!, '_blank'); }}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          title="Open in Drive"
        >
          <ExternalLink size={14} />
        </button>
      )}
      {isDeleteConfirm ? (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteConfirm(); }}
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: 'rgba(224,95,95,0.15)', color: 'var(--color-error)' }}
          >
            Delete
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteCancel(); }}
            className="px-2 py-1 rounded text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteClick(); }}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
