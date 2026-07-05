// apps/frontend_rebuilt/src/components/CommandPalette.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUploadStore } from '../store/uploadStore';

const options = [
  { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', description: 'Overview of learning statistics and activities' },
  { label: 'Search Library', path: '/search', icon: 'search', description: 'Hybrid search with PG and Qdrant' },
  { label: 'Q&A Chat', path: '/ask', icon: 'smart_toy', description: 'Ask questions to your AI assistant' },
  { label: 'New Ingestion', action: 'upload', icon: 'upload_file', description: 'Ingest and index new documents' },
  { label: 'Knowledge Graph', path: '/graph', icon: 'hub', description: 'Explore Louvain-clustered knowledge graph' },
  { label: 'AI Mentor Mode', path: '/mentor', icon: 'school', description: 'Interactive adaptive lesson sessions' },
  { label: 'Study Roadmaps', path: '/roadmaps', icon: 'map', description: 'Generate learning roadmaps via LLM' },
  { label: 'Research Agent', path: '/research', icon: 'science', description: 'Compile structured markdown research reports' },
  { label: 'Compare Documents', path: '/compare', icon: 'compare', description: 'Side-by-side comparative matrix analytics' },
  { label: 'Analytics & Heatmap', path: '/analytics', icon: 'analytics', description: 'View gap detection and memory retention' },
  { label: 'System Status', path: '/status', icon: 'sensors', description: 'Check running status of database and ML services' },
  { label: 'Account Settings', path: '/settings', icon: 'settings', description: 'Manage accounts and AI model configurations' },
];

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { openUpload } = useUploadStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setSearch('');
        setSelectedIndex(0);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    opt.description.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleSelect = (option: typeof options[number]) => {
    setIsOpen(false);
    if (option.path) {
      navigate(option.path);
    } else if (option.action === 'upload') {
      openUpload();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-start justify-center pt-[15vh]">
      <div
        className="w-full max-w-lg bg-[#090e1a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-sm px-lg py-md border-b border-white/5">
          <span className="material-symbols-outlined text-primary text-[20px]">terminal</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search feature..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <span className="text-[10px] text-slate-500 border border-white/10 rounded px-1.5 py-0.5 font-bold font-mono">ESC</span>
        </div>

        {/* Options list */}
        <div className="max-h-[320px] overflow-y-auto p-sm space-y-xs">
          {filtered.map((opt, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={opt.label}
                onClick={() => handleSelect(opt)}
                className={`flex items-center gap-md px-md py-sm rounded-xl cursor-pointer transition-all ${
                  isSelected ? 'bg-primary/10 border border-primary/20' : 'border border-transparent hover:bg-white/5'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${isSelected ? 'text-primary' : 'text-slate-400'}`}>
                  {opt.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{opt.label}</p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{opt.description}</p>
                </div>
                {isSelected && (
                  <span className="text-[10px] text-primary/80 font-bold font-mono">↵ ENTER</span>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-slate-500 text-xs italic text-center py-6">No matching actions found</p>
          )}
        </div>

        {/* Footer info */}
        <div className="px-lg py-sm border-t border-white/5 bg-[#070b14] flex items-center justify-between text-[9px] text-slate-500 font-medium">
          <div className="flex gap-md">
            <span>↑↓ Navigation</span>
            <span>↵ Select</span>
          </div>
          <span>Ctrl + K to toggle anywhere</span>
        </div>
      </div>
    </div>
  );
}
