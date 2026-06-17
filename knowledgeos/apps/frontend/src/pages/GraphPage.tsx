// apps/frontend/src/pages/GraphPage.tsx
/**
 * Redesigned Knowledge Graph Page.
 * Interactive force-directed canvas.
 * Adds custom force physics sliders (repulsion, edge distance, center gravity),
 * node type category visibility filters, and a right-side Node Details Inspector panel.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Info,
  Sliders,
  Eye,
  Share2,
} from 'lucide-react';

import { api } from '../lib/api';

// ─── Types ───

interface GraphNode {
  id: string;
  label: string;
  type: string;
  description: string | null;
  size: number;
  // Physics simulation fields
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  strength: number;
  label: string;
}

interface GraphStats {
  totalNodes: number;
  totalDocuments: number;
  totalTags: number;
  nodesByType: Array<{ type: string; count: number }>;
}

const NODE_COLORS: Record<string, string> = {
  CONCEPT: '#818cf8',
  PERSON: '#10b981',
  TECHNOLOGY: '#0ea5e9',
  PLACE: '#f59e0b',
  METHOD: '#f43f5e',
  OTHER: '#71717a',
};

const EDGE_COLOR = 'rgba(255,255,255,0.03)';
const EDGE_HOVER_COLOR = 'rgba(99,102,241,0.25)';

export function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Physics states
  const [repulsionStrength, setRepulsionStrength] = useState(600);
  const [edgeDistance, setEdgeDistance] = useState(130);
  const [centerGravity, setCenterGravity] = useState(0.002);

  // Type visibility filters
  const [filters, setFilters] = useState<Record<string, boolean>>({
    CONCEPT: true,
    PERSON: true,
    TECHNOLOGY: true,
    PLACE: true,
    METHOD: true,
    OTHER: true,
  });

  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);

  // Fetch graph API data
  const { data: nodesData } = useQuery<{ nodes: GraphNode[]; totalNodes: number }>({
    queryKey: ['graph-nodes'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { nodes: GraphNode[]; totalNodes: number } }>('/api/graph/nodes');
      return res.data.data;
    },
  });

  const { data: edgesData } = useQuery<{ edges: GraphEdge[]; totalEdges: number }>({
    queryKey: ['graph-edges'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { edges: GraphEdge[]; totalEdges: number } }>('/api/graph/edges');
      return res.data.data;
    },
  });

  const { data: statsData } = useQuery<GraphStats>({
    queryKey: ['graph-stats'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: GraphStats }>('/api/graph/stats');
      return res.data.data;
    },
  });

  // Filter nodes & edges dynamically based on user selections
  const getFilteredData = useCallback(() => {
    if (!nodesData?.nodes) return { nodes: [], edges: [] };
    const filteredNodes = nodesData.nodes.filter(n => filters[n.type] ?? true);
    const activeNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = (edgesData?.edges ?? []).filter(
      e => activeNodeIds.has(e.source) && activeNodeIds.has(e.target)
    );
    return { nodes: filteredNodes, edges: filteredEdges };
  }, [nodesData, edgesData, filters]);

  // Sync animation references when data or filters change
  useEffect(() => {
    const { nodes, edges } = getFilteredData();
    if (nodes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    // Preserve existing coords or initialize randomly
    const existingNodeMap = new Map(nodesRef.current.map(n => [n.id, n]));

    nodesRef.current = nodes.map(n => {
      const exist = existingNodeMap.get(n.id);
      return {
        ...n,
        x: exist ? exist.x : width / 2 + (Math.random() - 0.5) * 350,
        y: exist ? exist.y : height / 2 + (Math.random() - 0.5) * 350,
        vx: exist ? exist.vx : 0,
        vy: exist ? exist.vy : 0,
        fx: null,
        fy: null,
      };
    });
    edgesRef.current = edges;

    const tick = () => {
      simulate();
      render();
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationRef.current);
  }, [nodesData, edgesData, filters, getFilteredData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize canvas handler
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Force simulation tick loop
  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    const edges = edgesRef.current;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Repulsion charge forces
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = repulsionStrength / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction link forces
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (dist - edgeDistance) * 0.012 * edge.strength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // Center Gravity pulling
    const canvas = canvasRef.current;
    const cx = canvas ? canvas.width / 2 : 400;
    const cy = canvas ? canvas.height / 2 : 300;

    for (const node of nodes) {
      node.vx += (cx - node.x) * centerGravity;
      node.vy += (cy - node.y) * centerGravity;

      // Apply friction damping
      node.vx *= 0.88;
      node.vy *= 0.88;

      if (node.fx !== null) {
        node.x = node.fx;
        node.vx = 0;
      } else {
        node.x += node.vx;
      }

      if (node.fy !== null) {
        node.y = node.fy;
        node.vy = 0;
      } else {
        node.y += node.vy;
      }
    }
  }, [repulsionStrength, edgeDistance, centerGravity]);

  // Canvas drawing tick
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Draw link edges
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const isHovered = hoveredNode && (hoveredNode.id === edge.source || hoveredNode.id === edge.target);
      const isSelected = selectedNode && (selectedNode.id === edge.source || selectedNode.id === edge.target);

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = isSelected ? 'var(--color-accent-teal)' : isHovered ? EDGE_HOVER_COLOR : EDGE_COLOR;
      ctx.lineWidth = isSelected ? 2 : isHovered ? 1.5 : 1;
      ctx.stroke();
    }

    // Draw nodes
    for (const node of nodes) {
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;
      const radius = isSelected ? 12 : isHovered ? 9 : 6.5;
      const color = NODE_COLORS[node.type] ?? NODE_COLORS['OTHER']!;

      // Glow indicators
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(14,165,233,0.18)' : `${color}25`;
        ctx.fill();
      }

      // Base circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.strokeStyle = isSelected ? '#fafafa' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.fill();
      ctx.stroke();

      // Label background & text
      ctx.font = `${isSelected ? 'bold 11px' : '9px'} 'Plus Jakarta Sans', sans-serif`;
      const labelText = node.label;
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = 'rgba(7,7,9,0.75)';
      ctx.fillRect(node.x - textWidth / 2 - 4, node.y + radius + 4, textWidth + 8, 14);

      ctx.fillStyle = isSelected ? '#fafafa' : isHovered ? '#d1d5db' : '#a1a1aa';
      ctx.textAlign = 'center';
      ctx.fillText(labelText, node.x, node.y + radius + 14);
    }

    ctx.restore();
  }, [hoveredNode, selectedNode, zoom, offset]);

  // Click & hover position matching helper
  const getNodeAtPosition = useCallback((mx: number, my: number) => {
    const nodes = nodesRef.current;
    const x = (mx - offset.x) / zoom;
    const y = (my - offset.y) / zoom;

    for (const node of nodes) {
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy < 20 * 20) return node;
    }
    return null;
  }, [zoom, offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });

    if (isDragging) {
      setOffset(prev => ({
        x: prev.x + (e.clientX - dragStart.x),
        y: prev.y + (e.clientY - dragStart.y),
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      const node = getNodeAtPosition(mx, my);
      setHoveredNode(node);
      canvas.style.cursor = node ? 'pointer' : 'grab';
    }
  }, [isDragging, dragStart, getNodeAtPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    setIsDragging(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // If mouse didn't drag much, trigger click selection
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const node = getNodeAtPosition(mx, my);
    if (node) {
      setSelectedNode(node);
    } else {
      setSelectedNode(null);
    }
  }, [getNodeAtPosition]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  // Filter count metrics
  const totalNodes = nodesData?.totalNodes ?? 0;
  const filteredNodesCount = nodesRef.current.length;

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-80px)] select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary uppercase tracking-wider">
            Knowledge Map
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Rendering {filteredNodesCount} of {totalNodes} entities. Drag to pan, scroll to zoom.
          </p>
        </div>

        {/* Zoom controller actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.min(3, z * 1.2))}
            className="p-1.5 rounded-lg border border-surface-border text-text-secondary hover:text-text-primary bg-surface cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.3, z * 0.8))}
            className="p-1.5 rounded-lg border border-surface-border text-text-secondary hover:text-text-primary bg-surface cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="p-1.5 rounded-lg border border-surface-border text-text-secondary hover:text-text-primary bg-surface cursor-pointer"
            title="Reset Map Layout"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Main split workarea */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Area: Canvas Graph Simulator */}
        <div
          ref={containerRef}
          className="lg:col-span-8 rounded-2xl border border-surface-border bg-surface-elevated relative overflow-hidden flex flex-col justify-end"
        >
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setIsDragging(false)}
            onWheel={handleWheel}
            className="absolute inset-0 block w-full h-full cursor-grab"
          />

          {/* Floating UI: Node Category filters */}
          <div className="absolute top-4 left-4 p-4 rounded-xl border border-surface-border bg-surface/90 backdrop-blur-xl shadow-lg space-y-3 max-w-[180px]">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block border-b border-surface-border pb-1.5">
              Category Layers
            </span>
            <div className="space-y-1.5">
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <label key={type} className="flex items-center gap-2 text-[10px] text-text-secondary cursor-pointer hover:text-text-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={filters[type] ?? true}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, [type]: e.target.checked }));
                      setSelectedNode(null); // Reset selection
                    }}
                    className="rounded text-accent-teal bg-background-elevated border-surface-border focus:ring-transparent focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="w-1.75 h-1.75 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span>{type.charAt(0) + type.slice(1).toLowerCase()}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Floating UI: Physics Param adjust sliders */}
          <div className="absolute bottom-4 left-4 p-4 rounded-xl border border-surface-border bg-surface/90 backdrop-blur-xl shadow-lg space-y-3 max-w-[180px]">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block border-b border-surface-border pb-1.5 flex items-center gap-1">
              <Sliders size={11} /> Force Physics
            </span>
            
            <div className="space-y-2 text-[9px] text-text-secondary">
              <div>
                <div className="flex justify-between font-medium">
                  <span>Node Repulsion:</span>
                  <span className="font-mono">{repulsionStrength}</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="1200"
                  step="50"
                  value={repulsionStrength}
                  onChange={(e) => setRepulsionStrength(Number(e.target.value))}
                  className="w-full h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-medium">
                  <span>Link Distance:</span>
                  <span className="font-mono">{edgeDistance}</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="250"
                  step="10"
                  value={edgeDistance}
                  onChange={(e) => setEdgeDistance(Number(e.target.value))}
                  className="w-full h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-medium">
                  <span>Gravity Pull:</span>
                  <span className="font-mono">{centerGravity.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min="0.0005"
                  max="0.006"
                  step="0.0005"
                  value={centerGravity}
                  onChange={(e) => setCenterGravity(Number(e.target.value))}
                  className="w-full h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Tooltip on mouse hover */}
          {hoveredNode && !isDragging && (
            <div
              className="fixed z-50 rounded-lg px-3 py-2 border pointer-events-none text-xs bg-surface/95 border-surface-border backdrop-blur-md shadow-2xl"
              style={{
                left: mousePos.x + 15,
                top: mousePos.y - 12,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1 font-bold text-text-primary">
                <span
                  className="w-1.75 h-1.75 rounded-full"
                  style={{ backgroundColor: NODE_COLORS[hoveredNode.type] ?? NODE_COLORS['OTHER'] }}
                />
                <span>{hoveredNode.label}</span>
              </div>
              <span className="text-[9px] font-bold tracking-wider text-text-muted uppercase">
                {hoveredNode.type}
              </span>
            </div>
          )}
        </div>

        {/* Right Area: Selected Node Inspector Panel */}
        <div className="lg:col-span-4 h-full flex flex-col min-h-0 bg-surface rounded-2xl border border-surface-border p-5 overflow-hidden">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Share2 size={13} className="text-accent-teal" /> Entity Profile
          </h3>

          {selectedNode ? (
            <div className="flex-1 flex flex-col justify-between overflow-y-auto space-y-5">
              
              <div className="space-y-4">
                {/* Node details */}
                <div className="flex items-start gap-3 bg-background-elevated p-3 rounded-xl border border-surface-border">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: NODE_COLORS[selectedNode.type] || NODE_COLORS['OTHER'] }}
                  />
                  <div className="leading-tight">
                    <span className="text-xs font-bold text-text-primary block">
                      {selectedNode.label}
                    </span>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1.5">
                      Type: {selectedNode.type}
                    </p>
                  </div>
                </div>

                {/* Description details */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">
                    Description Context
                  </span>
                  <div className="bg-background-elevated p-4 rounded-xl border border-surface-border text-[11px] text-text-secondary leading-relaxed font-sans max-h-52 overflow-y-auto">
                    {selectedNode.description || 'No contextual summary description exists for this entity note.'}
                  </div>
                </div>
              </div>

              {/* Connected relations statistics */}
              <div className="space-y-3 pt-4 border-t border-surface-border">
                {statsData && (
                  <div className="bg-background-elevated p-3 rounded-xl border border-surface-border space-y-2">
                    <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">
                      Graph Metadata Statistics
                    </span>
                    <div className="flex items-center justify-between text-[10px] text-text-secondary">
                      <span>Total Nodes:</span>
                      <span className="font-mono text-text-primary font-bold">{statsData.totalNodes}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-text-secondary">
                      <span>Mapped Files:</span>
                      <span className="font-mono text-text-primary font-bold">{statsData.totalDocuments}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-text-secondary">
                      <span>Total Connections:</span>
                      <span className="font-mono text-text-primary font-bold">{edgesRef.current.length} links</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setSelectedNode(null)}
                  className="w-full text-center py-2.5 rounded-lg border border-surface-border hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary text-[10px] font-bold cursor-pointer"
                >
                  Unselect Entity
                </button>
              </div>

            </div>
          ) : (
            /* Inspector Idle placeholder */
            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 border border-dashed border-surface-border rounded-xl bg-background-elevated/40">
              <Eye size={24} className="text-text-muted mb-3 animate-pulse" />
              <h4 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">Awaiting Selection</h4>
              <p className="text-[10px] text-text-secondary mt-1.5 leading-relaxed max-w-[150px]">
                Click on specific visual nodes inside the graph view to inspect descriptions and connections.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
