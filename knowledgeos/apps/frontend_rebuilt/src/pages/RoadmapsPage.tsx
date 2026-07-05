import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface RoadmapNode {
  id: string;
  label: string;
  type: 'CORE' | 'ELECTIVE' | 'ADVANCED';
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  parentNodeId: string | null;
  order: number;
}

interface Roadmap {
  id: string;
  title: string;
  createdAt: string;
  nodes: RoadmapNode[];
}

export default function RoadmapsPage() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState<Roadmap | null>(null);
  const [newTopic, setNewTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoadmaps();
  }, []);

  const fetchRoadmaps = async () => {
    try {
      const res = await api.get<{ success: boolean; data: Roadmap[] }>('/api/roadmaps');
      if (res.data.success) {
        setRoadmaps(res.data.data);
        if (res.data.data.length > 0 && !selectedRoadmap) {
          fetchRoadmapDetails(res.data.data[0].id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load roadmaps:', err);
    }
  };

  const fetchRoadmapDetails = async (id: string) => {
    try {
      const res = await api.get<{ success: boolean; data: Roadmap }>(`/api/roadmaps/${id}`);
      if (res.data.success) {
        setSelectedRoadmap(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load roadmap details:', err);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) return;

    setIsGenerating(true);
    setError(null);
    try {
      const res = await api.post<{ success: boolean; data: Roadmap }>('/api/roadmaps', { topic: newTopic });
      if (res.data.success) {
        setNewTopic('');
        await fetchRoadmaps();
        setSelectedRoadmap(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Generation failed. Make sure Ollama or Gemini is active.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleNodeStatus = async (nodeId: string, currentStatus: string) => {
    if (!selectedRoadmap) return;

    const nextStatus = currentStatus === 'COMPLETED' ? 'PLANNED' : 'COMPLETED';
    try {
      const res = await api.patch<{ success: boolean; data: RoadmapNode }>(`/api/roadmaps/nodes/${nodeId}`, {
        status: nextStatus
      });

      if (res.data.success) {
        // Local state update
        const updatedNodes = selectedRoadmap.nodes.map(n =>
          n.id === nodeId ? { ...n, status: res.data.data.status } : n
        );
        setSelectedRoadmap({ ...selectedRoadmap, nodes: updatedNodes });
      }
    } catch (err) {
      console.error('Failed to update node:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this roadmap?')) return;
    try {
      const res = await api.delete(`/api/roadmaps/${id}`);
      if (res.data.success) {
        setRoadmaps(roadmaps.filter(r => r.id !== id));
        setSelectedRoadmap(null);
      }
    } catch (err) {
      console.error('Failed to delete roadmap:', err);
    }
  };

  // Helper to color codes
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CORE': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'ELECTIVE': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'ADVANCED': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-white/5 text-slate-400 border-white/10';
    }
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-60px)] bg-[#0b1326] text-[#dae2fd]">
      {/* Sidebar - Saved Roadmaps */}
      <div className="w-[280px] border-r border-white/5 bg-[#090e1a] p-lg flex flex-col gap-md">
        <div>
          <h2 className="font-display font-bold text-xs uppercase tracking-widest text-[#primary] mb-sm">AI Roadmaps</h2>
          <form onSubmit={handleGenerate} className="flex flex-col gap-xs">
            <input
              type="text"
              placeholder="e.g. Distributed Systems"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-sm py-xs text-xs focus:outline-none focus:border-primary/50 text-on-surface"
              disabled={isGenerating}
            />
            <button
              type="submit"
              className="bg-primary text-on-primary py-xs rounded text-xs font-bold hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <div className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin" />
                  Generating...
                </>
              ) : 'Generate roadmap'}
            </button>
          </form>
          {error && <p className="text-[10px] text-red-400 mt-2 font-medium leading-relaxed">{error}</p>}
        </div>

        <hr className="border-white/5" />

        <div className="flex-1 overflow-y-auto space-y-1">
          {roadmaps.map(r => (
            <div
              key={r.id}
              onClick={() => fetchRoadmapDetails(r.id)}
              className={`flex items-center justify-between px-md py-sm rounded-lg cursor-pointer transition-all ${
                selectedRoadmap?.id === r.id ? 'bg-white/5 border border-white/10 text-primary' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-xs font-semibold truncate max-w-[180px]">{r.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                className="text-slate-500 hover:text-red-400 transition-colors p-1"
              >
                <span className="material-symbols-outlined text-xs">delete</span>
              </button>
            </div>
          ))}
          {roadmaps.length === 0 && (
            <p className="text-slate-500 text-xs italic text-center py-8">No roadmaps generated yet</p>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 p-2xl overflow-y-auto">
        {selectedRoadmap ? (
          <div className="max-w-[800px] mx-auto space-y-xl">
            <div className="flex justify-between items-center pb-md border-b border-white/5">
              <div>
                <h1 className="text-2xl font-bold font-display">{selectedRoadmap.title} Curriculum</h1>
                <p className="text-xs text-slate-400 mt-xs">AI Generated roadmap based on conceptual knowledge tree</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  {selectedRoadmap.nodes.filter(n => n.status === 'COMPLETED').length} / {selectedRoadmap.nodes.length} Completed
                </span>
              </div>
            </div>

            {/* Interactive Timeline layout */}
            <div className="relative border-l border-white/5 pl-lg ml-md space-y-lg">
              {selectedRoadmap.nodes.map((node, index) => {
                const isCompleted = node.status === 'COMPLETED';
                return (
                  <div key={node.id} className="relative group">
                    {/* Visual Connector Dot */}
                    <div
                      onClick={() => toggleNodeStatus(node.id, node.status)}
                      className={`absolute -left-[30px] top-[6px] w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all hover:scale-110 ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'bg-[#0b1326] border-white/20 text-transparent group-hover:border-primary/50'
                      }`}
                    >
                      {isCompleted && <span className="material-symbols-outlined text-[12px] font-bold">check</span>}
                    </div>

                    {/* Node Card */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-md flex items-center justify-between transition-all hover:border-white/20">
                      <div className="flex items-center gap-md">
                        <span className="text-xs font-bold text-slate-500 font-mono w-4">0{index + 1}</span>
                        <div>
                          <h3 className={`text-sm font-semibold transition-all ${isCompleted ? 'text-slate-500 line-through' : 'text-white'}`}>
                            {node.label}
                          </h3>
                          <span className={`inline-block text-[9px] font-bold border rounded px-1.5 py-0.5 mt-xs uppercase tracking-wider ${getTypeColor(node.type)}`}>
                            {node.type}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleNodeStatus(node.id, node.status)}
                        className={`px-sm py-xs rounded border text-xs font-semibold cursor-pointer transition-all ${
                          isCompleted
                            ? 'border-white/10 text-slate-500 hover:text-red-400 hover:border-red-400/20'
                            : 'border-primary/30 text-primary hover:bg-primary/5'
                        }`}
                      >
                        {isCompleted ? 'Reset' : 'Complete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-[400px] mx-auto gap-md py-20">
            <span className="material-symbols-outlined text-4xl text-primary/50 animate-pulse">map</span>
            <div>
              <h2 className="text-sm font-semibold text-white">Create a Learning Roadmap</h2>
              <p className="text-xs text-slate-400 mt-xs leading-relaxed">
                Enter a topic in the sidebar to generate a structured study curriculum utilizing the local LLM reasoning engine.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
