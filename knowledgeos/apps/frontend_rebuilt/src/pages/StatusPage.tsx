import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
  dependencies: {
    postgres: string;
    mlService: string;
  };
}

interface SyncStatus {
  isRunning: boolean;
  documents: {
    total: number;
    pending: number;
    processing: number;
    indexed: number;
    failed: number;
  };
  activeJobs: number;
}

interface DocumentItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  fileType: string;
}

interface ListResponse {
  documents: DocumentItem[];
}

export default function StatusPage() {
  // Query: Backend System Health
  const { data: health, refetch: refetchHealth, isFetching: isHealthFetching } = useQuery<HealthResponse>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const res = await api.get<HealthResponse>('/health')
      return res.data
    },
    refetchInterval: 20000,
  })

  // Query: Live Ingestion stats
  const { refetch: refetchSync, isFetching: isSyncFetching } = useQuery<SyncStatus>({
    queryKey: ['drive-status'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SyncStatus }>('/api/drive/status')
      return res.data.data
    },
    refetchInterval: 15000,
  })

  // Query: Recent Ingestion Audits
  const { data: recentLogs } = useQuery<ListResponse>({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ListResponse }>('/api/documents?limit=6')
      return res.data.data
    },
  })

  const handleForceRefresh = () => {
    void refetchHealth()
    void refetchSync()
  }

  const isGlobalActive = health?.status === 'ok'
  const isPostgresActive = health?.dependencies.postgres === 'ok'
  const isMLActive = health?.dependencies.mlService === 'ok'
  const isFetchingData = isHealthFetching || isSyncFetching

  return (
    <div className="space-y-8 select-none max-w-5xl mx-auto w-full animate-fade-in">
      {/* Header Section */}
      <section className="flex justify-between items-end flex-wrap gap-md">
        <div>
          <h2 className="font-display-lg text-headline-lg text-on-surface">System Health</h2>
          <div className="flex items-center gap-sm mt-xs">
            <span className={`w-2 h-2 rounded-full pulse-dot ${isGlobalActive ? 'bg-secondary' : 'bg-error'}`}></span>
            <p className="font-body-md text-xs text-on-surface-variant">
              {isGlobalActive ? 'All primary services operational.' : 'System gateway indicators degraded.'} Last updated just now.
            </p>
          </div>
        </div>
        <div className="flex gap-sm">
          <button
            onClick={handleForceRefresh}
            disabled={isFetchingData}
            className="flex items-center gap-xs px-4 py-2 bg-surface-container border border-outline-variant/30 hover:bg-surface-bright rounded-lg text-label-sm text-xs cursor-pointer font-bold disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${isFetchingData ? 'animate-spin' : ''}`}>refresh</span>
            <span>Force Refresh</span>
          </button>
        </div>
      </section>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-lg">
        {/* Service status blocks */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-md">
          {/* API Gateway */}
          <div className="glass-panel p-md rounded-xl flex flex-col gap-sm justify-between min-h-[160px] bg-surface-container border-outline-variant/30">
            <div className="flex justify-between items-start">
              <span className="material-symbols-outlined text-primary text-[24px]">api</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full uppercase tracking-wider ${
                isGlobalActive ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-error/10 text-error border-error/20'
              }`}>
                {isGlobalActive ? 'Active' : 'Degraded'}
              </span>
            </div>
            <div>
              <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Global API Gateway</p>
              <p className="font-display-lg text-2xl text-on-surface font-bold mt-1">99.98%</p>
            </div>
            <div className="mt-auto h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-[99.9%]"></div>
            </div>
          </div>

          {/* Database */}
          <div className="glass-panel p-md rounded-xl flex flex-col gap-sm justify-between min-h-[160px] bg-surface-container border-outline-variant/30">
            <div className="flex justify-between items-start">
              <span className="material-symbols-outlined text-primary text-[24px]">database</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full uppercase tracking-wider ${
                isPostgresActive ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-error/10 text-error border-error/20'
              }`}>
                {isPostgresActive ? 'Connected' : 'Offline'}
              </span>
            </div>
            <div>
              <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Metadata Postgres</p>
              <p className="font-display-lg text-2xl text-on-surface font-bold mt-1">
                {isPostgresActive ? '12ms' : 'Error'}
              </p>
            </div>
            <div className="mt-auto flex items-end gap-0.5 h-6">
              <div className="w-1 h-[60%] bg-secondary/40 rounded-t-sm"></div>
              <div className="w-1 h-[40%] bg-secondary/40 rounded-t-sm"></div>
              <div className="w-1 h-[80%] bg-secondary rounded-t-sm"></div>
              <div className="w-1 h-[70%] bg-secondary rounded-t-sm"></div>
              <div className="w-1 h-[95%] bg-secondary rounded-t-sm"></div>
            </div>
          </div>

          {/* ML Inference */}
          <div className="glass-panel p-md rounded-xl flex flex-col gap-sm justify-between min-h-[160px] bg-surface-container border-outline-variant/30">
            <div className="flex justify-between items-start">
              <span className="material-symbols-outlined text-primary text-[24px]">psychology</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full uppercase tracking-wider ${
                isMLActive ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-error/10 text-error border-error/20'
              }`}>
                {isMLActive ? 'Operational' : 'Offline'}
              </span>
            </div>
            <div>
              <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">FastAPI ML Inference</p>
              <p className="font-display-lg text-2xl text-on-surface font-bold mt-1">
                {isMLActive ? '36ms' : 'Fault'}
              </p>
            </div>
            <div className="mt-auto h-1 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
              {isMLActive && (
                <div className="absolute h-full bg-primary w-1/3 animate-pulse bg-primary/40" />
              )}
            </div>
          </div>
        </div>

        {/* Latency History */}
        <div className="col-span-12 lg:col-span-4 glass-panel p-lg rounded-xl flex flex-col justify-between bg-surface-container min-h-[160px] text-xs border-outline-variant/30">
          <div>
            <h4 className="font-headline-lg text-sm font-semibold text-on-surface">Gateway Request Latency</h4>
            <p className="text-on-surface-variant text-[10px] mt-0.5">Vector retrieval duration logs (last 72h)</p>
          </div>
          <div className="h-16 flex items-end gap-1 mt-4 border-b border-outline-variant/30 pb-1">
            {[45, 62, 55, 38, 44, 48, 50, 42, 60, 48, 72, 68, 55, 40, 32, 50].map((val, idx) => (
              <div
                key={idx}
                className="flex-grow bg-primary/20 hover:bg-primary/50 transition-all rounded-t-sm"
                style={{ height: `${val}%` }}
                title={`${val}ms`}
              />
            ))}
          </div>
        </div>

        {/* Sync logs heartbeat audits */}
        <div className="col-span-12 glass-panel p-lg rounded-xl bg-surface-container text-xs border-outline-variant/30">
          <div className="mb-md border-b border-outline-variant/30 pb-3">
            <h4 className="font-headline-lg text-sm font-semibold text-on-surface">Sync Log Ingestion Pipeline</h4>
            <p className="text-on-surface-variant text-[10px] mt-0.5">Live heartbeat statistics of document ingestion tasks</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
            {recentLogs && recentLogs.documents.length > 0 ? (
              recentLogs.documents.map((log) => (
                <div key={log.id} className="p-3 bg-white/5 rounded-lg border border-outline-variant/30 flex items-start gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                    log.status === 'INDEXED' ? 'bg-secondary' :
                    log.status === 'FAILED' ? 'bg-error' : 'bg-amber-400'
                  }`}></span>
                  <div className="leading-tight min-w-0">
                    <span className="font-semibold text-on-surface block truncate">{log.title}</span>
                    <span className="font-mono text-[9px] text-on-surface-variant block mt-1 uppercase">
                      {log.status === 'INDEXED' ? 'INDEXING_SUCCESS' : log.status === 'FAILED' ? 'INDEXING_FAULT' : 'PARSING_CONTENT'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-6 text-on-surface-variant">
                No indexing operations logged.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
