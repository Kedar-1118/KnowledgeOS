import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'

interface SyncStatus {
  isRunning: boolean;
  lastSyncAt: string | null;
  driveFolderId?: string | null;
  driveFolderUrl?: string | null;
  documents: {
    total: number;
    indexed: number;
  };
}

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'drive' | 'prefs'>('profile')

  // UI preferences toggles
  const [reminders, setReminders] = useState(true)
  const [autoSync, setAutoSync] = useState(true)
  const [compact, setCompact] = useState(false)
  const [soundFeedback, setSoundFeedback] = useState(false)
  const [ocrExtraction, setOcrExtraction] = useState(false)
  const [syncInterval, setSyncInterval] = useState(15)

  // Query: Drive sync status
  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['drive-status'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SyncStatus }>('/api/drive/status')
      return res.data.data
    },
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6 select-none w-full animate-fade-in">
      <div className="mb-6">
        <h2 className="font-display-lg text-headline-lg text-on-surface">Settings</h2>
        <p className="text-on-surface-variant mt-xs text-xs">Configure your personal interface and AI workspace parameters.</p>
      </div>

      {/* Tabs list */}
      <div className="flex gap-xl border-b border-outline-variant/30 mb-6 text-xs">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-md font-label-sm font-bold transition-all flex items-center gap-sm cursor-pointer border-b-2 ${
            activeTab === 'profile'
              ? 'text-primary border-primary'
              : 'text-on-surface-variant hover:text-on-surface border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">person</span>
          <span>Profile</span>
        </button>
        <button
          onClick={() => setActiveTab('drive')}
          className={`pb-md font-label-sm font-bold transition-all flex items-center gap-sm cursor-pointer border-b-2 ${
            activeTab === 'drive'
              ? 'text-primary border-primary'
              : 'text-on-surface-variant hover:text-on-surface border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
          <span>Drive Connector</span>
        </button>
        <button
          onClick={() => setActiveTab('prefs')}
          className={`pb-md font-label-sm font-bold transition-all flex items-center gap-sm cursor-pointer border-b-2 ${
            activeTab === 'prefs'
              ? 'text-primary border-primary'
              : 'text-on-surface-variant hover:text-on-surface border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">tune</span>
          <span>Preferences</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="min-h-[360px]">
        {/* Profile */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-xl">
            <div className="md:col-span-1">
              <h3 className="font-headline-lg text-body-lg font-semibold text-sm">User Identity</h3>
              <p className="text-on-surface-variant text-label-sm mt-xs text-[11px]">Personal details and account security markers.</p>
            </div>
            <div className="md:col-span-2 glass-panel p-lg rounded-xl space-y-lg text-xs bg-surface-container">
              <div className="flex items-center gap-xl flex-wrap">
                <div className="relative group cursor-pointer w-24 h-24 rounded-2xl overflow-hidden border-2 border-outline-variant/30 flex-shrink-0">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center text-xl font-mono font-bold text-primary">
                      {user?.name?.charAt(0) ?? '?'}
                    </div>
                  )}
                </div>
                <div className="leading-tight">
                  <p className="font-body-md font-semibold text-sm text-on-surface">{user?.name || 'Julian Sterling'}</p>
                  <p className="text-on-surface-variant text-[11px] mt-1">{user?.email || 'julian@nexusai.io'}</p>
                  <div className="flex gap-sm mt-md">
                    <span className="bg-secondary/10 text-secondary border border-secondary/20 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold">
                      Pro User
                    </span>
                    <span className="bg-surface-variant text-on-surface-variant px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold border border-outline-variant/30">
                      Enterprise Tier
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-lg pt-md">
                <div className="flex flex-col gap-xs">
                  <label className="text-label-sm text-on-surface-variant font-bold text-[11px]">First Name</label>
                  <input
                    className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-sm text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all text-xs"
                    type="text"
                    defaultValue={user?.name?.split(' ')[0] || 'Julian'}
                  />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="text-label-sm text-on-surface-variant font-bold text-[11px]">Last Name</label>
                  <input
                    className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-sm text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all text-xs"
                    type="text"
                    defaultValue={user?.name?.split(' ').slice(1).join(' ') || 'Sterling'}
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-xs">
                  <label className="text-label-sm text-on-surface-variant font-bold text-[11px]">Role / Bio</label>
                  <textarea
                    className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-sm text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all resize-none text-xs"
                    rows={3}
                    defaultValue="Senior Solutions Architect specializing in LLM knowledge integration and enterprise vector databases."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Drive Connector */}
        {activeTab === 'drive' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-xl">
            <div className="md:col-span-1">
              <h3 className="font-headline-lg text-body-lg font-semibold text-sm">Sync Constraints</h3>
              <p className="text-on-surface-variant text-label-sm mt-xs text-[11px]">Define how Nexus AI interacts with your external cloud storage providers.</p>
            </div>
            <div className="md:col-span-2 space-y-md text-xs">
              <div className="glass-panel p-lg rounded-xl flex items-center justify-between bg-surface-container flex-wrap gap-md">
                <div className="flex items-center gap-lg">
                  <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center border border-outline-variant/30 flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-3xl">
                      add_to_drive
                    </span>
                  </div>
                  <div className="leading-tight">
                    <h4 className="font-body-md font-medium text-sm text-on-surface">Google Drive Folder</h4>
                    <div className="flex items-center gap-xs mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary pulse-dot"></span>
                      <span className="text-label-sm text-secondary font-bold uppercase tracking-wider text-[10px]">Connected</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-md">
                  {syncStatus?.driveFolderUrl && (
                    <button
                      onClick={() => window.open(syncStatus.driveFolderUrl!, '_blank')}
                      className="text-label-sm text-primary hover:brightness-110 transition-colors cursor-pointer font-bold"
                    >
                      Open Folder
                    </button>
                  )}
                  <div className="w-px h-6 bg-outline-variant/30"></div>
                  <span className="text-[10px] font-mono text-on-surface-variant">ID: {syncStatus?.driveFolderId?.slice(0, 10) || 'default_dir'}...</span>
                </div>
              </div>

              <div className="glass-panel p-lg rounded-xl flex items-center justify-between border-dashed border-outline-variant/40 opacity-60 hover:opacity-100 transition-opacity bg-surface-container flex-wrap gap-md">
                <div className="flex items-center gap-lg">
                  <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center border border-outline-variant/30 flex-shrink-0">
                    <span className="material-symbols-outlined text-on-surface-variant text-3xl">cloud_queue</span>
                  </div>
                  <div className="leading-tight">
                    <h4 className="font-body-md font-medium text-sm text-on-surface">OneDrive Business</h4>
                    <p className="text-label-sm text-on-surface-variant mt-0.5">Not connected</p>
                  </div>
                </div>
                <button className="bg-surface-bright text-on-surface px-4 py-1.5 rounded-lg font-label-sm hover:bg-outline-variant/40 transition-colors text-xs font-bold cursor-pointer">
                  Setup
                </button>
              </div>

              <div className="glass-panel p-lg rounded-xl bg-surface-container">
                <h4 className="font-body-md font-semibold text-sm mb-lg text-on-surface">Global Sync Settings</h4>
                <div className="space-y-lg">
                  <div className="flex justify-between items-center py-2">
                    <div className="leading-tight">
                      <p className="font-body-md text-on-surface">Auto-Ingestion</p>
                      <p className="text-label-sm text-on-surface-variant text-[11px] mt-0.5">Automatically index new files detected in Drive roots.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSync}
                        onChange={() => setAutoSync(!autoSync)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <div className="leading-tight">
                      <p className="font-body-md text-on-surface">OCR Text Extraction</p>
                      <p className="text-label-sm text-on-surface-variant text-[11px] mt-0.5">Enable Optical Character Recognition for scanned imagery/PDFs.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ocrExtraction}
                        onChange={() => setOcrExtraction(!ocrExtraction)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <div className="pt-md border-t border-outline-variant/30">
                    <label className="text-label-sm text-on-surface-variant block mb-sm font-bold uppercase tracking-wider text-[10px]">
                      Sync Interval (Minutes)
                    </label>
                    <div className="flex items-center gap-xl">
                      <input
                        className="flex-grow accent-primary h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer"
                        max="60"
                        min="5"
                        step="5"
                        type="range"
                        value={syncInterval}
                        onChange={(e) => setSyncInterval(Number(e.target.value))}
                      />
                      <span className="text-body-md font-code text-primary w-12 text-right font-mono font-bold">{syncInterval}m</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preferences */}
        {activeTab === 'prefs' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-xl">
            <div className="md:col-span-1">
              <h3 className="font-headline-lg text-body-lg font-semibold text-sm">Interface Experience</h3>
              <p className="text-on-surface-variant text-label-sm mt-xs text-[11px]">Tailor the visual density and system notifications to your workflow.</p>
            </div>
            <div className="md:col-span-2 space-y-md text-xs">
              <div className="glass-panel p-lg rounded-xl bg-surface-container">
                <h4 className="font-body-md font-semibold text-sm mb-lg text-on-surface">Visual Theme</h4>
                <div className="grid grid-cols-3 gap-md">
                  <button className="flex flex-col gap-sm p-sm rounded-lg border-2 border-primary bg-primary/10 text-left">
                    <div className="w-full h-16 bg-surface-container-lowest rounded-md border border-outline-variant/30 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-4 bg-surface-container-low"></div>
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary/20"></div>
                    </div>
                    <span className="text-label-sm text-primary font-bold text-[10px] tracking-wide mt-2">Dark Indigo (Default)</span>
                  </button>
                  <button className="flex flex-col gap-sm p-sm rounded-lg border-2 border-transparent hover:border-outline-variant/30 transition-all text-left opacity-50 cursor-pointer">
                    <div className="w-full h-16 bg-white rounded-md border border-gray-200 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-4 bg-gray-50"></div>
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-100"></div>
                    </div>
                    <span className="text-label-sm text-on-surface-variant text-[10px] mt-2">Light Pro</span>
                  </button>
                  <button className="flex flex-col gap-sm p-sm rounded-lg border-2 border-transparent hover:border-outline-variant/30 transition-all text-left opacity-50 cursor-pointer">
                    <div className="w-full h-16 bg-slate-950 rounded-md border border-slate-800 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-4 bg-black"></div>
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-500/30"></div>
                    </div>
                    <span className="text-label-sm text-on-surface-variant text-[10px] mt-2">OLED Pitch Black</span>
                  </button>
                </div>
              </div>

              <div className="glass-panel p-lg rounded-xl space-y-lg bg-surface-container">
                <div className="flex justify-between items-center py-2">
                  <div className="leading-tight">
                    <p className="font-body-md text-on-surface">Compact Mode</p>
                    <p className="text-label-sm text-on-surface-variant text-[11px] mt-0.5">Reduce padding sizes for denser tabular layout representation.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compact}
                      onChange={() => setCompact(!compact)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <div className="flex justify-between items-center py-2">
                  <div className="leading-tight">
                    <p className="font-body-md text-on-surface">System Notifications</p>
                    <p className="text-label-sm text-on-surface-variant text-[11px] mt-0.5">Receive browser notifications for parsing progress or sync reports.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminders}
                      onChange={() => setReminders(!reminders)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <div className="flex justify-between items-center py-2">
                  <div className="leading-tight">
                    <p className="font-body-md text-on-surface">Sound Feedback</p>
                    <p className="text-label-sm text-on-surface-variant text-[11px] mt-0.5">Enable audio cues for user clicks and interface notifications.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soundFeedback}
                      onChange={() => setSoundFeedback(!soundFeedback)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              <div className="glass-panel p-lg rounded-xl bg-surface-container">
                <h4 className="font-body-md font-semibold text-sm mb-lg text-on-surface">Backup & Sync Options</h4>
                <div className="flex gap-md">
                  <button className="flex-grow bg-surface-container-high border border-outline-variant/30 py-2 rounded-lg font-label-sm hover:bg-surface-bright transition-colors flex items-center justify-center gap-xs cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span>Backup Settings</span>
                  </button>
                  <button className="flex-grow bg-surface-container-high border border-outline-variant/30 py-2 rounded-lg font-label-sm hover:bg-surface-bright transition-colors flex items-center justify-center gap-xs cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                    <span>Restore Sync</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-2xl flex justify-end gap-md pt-xl border-t border-outline-variant/20">
        <button
          onClick={() => setActiveTab('profile')}
          className="px-xl py-2 rounded-lg font-label-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer text-xs font-bold"
        >
          Discard Changes
        </button>
        <button
          onClick={() => alert('Settings Saved Successfully!')}
          className="px-xl py-2 rounded-lg font-label-sm bg-primary text-on-primary shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer text-xs font-bold"
        >
          Save Workspace
        </button>
      </div>
    </div>
  )
}
