// apps/frontend/src/pages/GraphPage.tsx
/**
 * Knowledge Graph — Interactive force-directed graph visualization.
 *
 * Uses Canvas 2D rendering (no external library dependency) for a
 * force-directed layout of document relationships and knowledge nodes.
 *
 * Features:
 * - Force-directed physics simulation
 * - Color-coded nodes by type (CONCEPT, PERSON, TECHNOLOGY, etc.)
 * - Hover tooltips with node details
 * - Zoom and pan controls
 * - Node type legend
 * - Stats sidebar
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Info,
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

// ─── Colors by node type ───
const NODE_COLORS: Record<string, string> = {
  CONCEPT: '#7F77DD',
  PERSON: '#1D9E75',
  TECHNOLOGY: '#5FC3E0',
  PLACE: '#E0A85F',
  METHOD: '#E07F5F',
  OTHER: '#888780',
};

const EDGE_COLOR = 'rgba(255,255,255,0.08)';
const EDGE_HOVER_COLOR = 'rgba(127,119,221,0.25)';

export function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);

  // Fetch graph data
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

  // Initialize simulation
  useEffect(() => {
    if (!nodesData?.nodes || !edgesData?.edges) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    // Initialize node positions randomly
    nodesRef.current = nodesData.nodes.map(n => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 400,
      y: height / 2 + (Math.random() - 0.5) * 400,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
    }));
    edgesRef.current = edgesData.edges;

    // Start animation loop
    const tick = () => {
      simulate();
      render();
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationRef.current);
  }, [nodesData, edgesData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize canvas
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

  // Force simulation
  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    const edges = edgesRef.current;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Repulsion (charge)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = 500 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction (edges)
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (dist - 120) * 0.01 * edge.strength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // Center gravity
    const canvas = canvasRef.current;
    const cx = canvas ? canvas.width / 2 : 400;
    const cy = canvas ? canvas.height / 2 : 300;

    for (const node of nodes) {
      node.vx += (cx - node.x) * 0.001;
      node.vy += (cy - node.y) * 0.001;

      // Apply velocity with damping
      node.vx *= 0.9;
      node.vy *= 0.9;

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
  }, []);

  // Canvas rendering
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

    // Draw edges
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const isHovered = hoveredNode && (hoveredNode.id === edge.source || hoveredNode.id === edge.target);

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = isHovered ? EDGE_HOVER_COLOR : EDGE_COLOR;
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();
    }

    // Draw nodes
    for (const node of nodes) {
      const isHovered = hoveredNode?.id === node.id;
      const radius = isHovered ? 10 : 7;
      const color = NODE_COLORS[node.type] ?? NODE_COLORS['OTHER']!;

      // Glow effect for hovered node
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = `${color}33`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Label
      ctx.font = `${isHovered ? '12px' : '10px'} Inter, sans-serif`;
      ctx.fillStyle = isHovered ? '#F0F0F5' : '#8A8A9A';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + radius + 14);
    }

    ctx.restore();
  }, [hoveredNode, zoom, offset]);

  // Mouse interaction handlers
  const getNodeAtPosition = useCallback((mx: number, my: number) => {
    const nodes = nodesRef.current;
    const x = (mx - offset.x) / zoom;
    const y = (my - offset.y) / zoom;

    for (const node of nodes) {
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy < 15 * 15) return node;
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

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  const totalNodes = nodesData?.totalNodes ?? 0;

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Knowledge Graph
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {totalNodes} nodes · {edgesRef.current.length} connections
          </p>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.min(3, z * 1.2))}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            title="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.3, z * 0.8))}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            title="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            title="Reset view"
          >
            <Maximize2 size={18} />
          </button>
        </div>
      </div>

      {/* Graph canvas */}
      <div
        ref={containerRef}
        className="flex-1 rounded-xl relative overflow-hidden"
        style={{
          backgroundColor: 'var(--color-background-elevated)',
          border: '1px solid var(--color-surface-border)',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />

        {/* Tooltip */}
        {hoveredNode && (
          <div
            className="fixed z-50 rounded-lg px-3 py-2 pointer-events-none"
            style={{
              left: mousePos.x + 12,
              top: mousePos.y - 10,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-surface-border)',
              boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: NODE_COLORS[hoveredNode.type] ?? NODE_COLORS['OTHER'] }}
              />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {hoveredNode.label}
              </span>
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {hoveredNode.type}
            </span>
            {hoveredNode.description && (
              <p className="text-xs mt-1 max-w-[200px]" style={{ color: 'var(--color-text-secondary)' }}>
                {hoveredNode.description}
              </p>
            )}
          </div>
        )}

        {/* Legend */}
        <div
          className="absolute bottom-4 left-4 rounded-lg px-3 py-2.5"
          style={{
            backgroundColor: 'rgba(10,10,15,0.9)',
            border: '1px solid var(--color-surface-border)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Info size={12} style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Node Types
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats panel */}
        {statsData && (
          <div
            className="absolute top-4 right-4 rounded-lg px-3 py-2.5"
            style={{
              backgroundColor: 'rgba(10,10,15,0.9)',
              border: '1px solid var(--color-surface-border)',
            }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Graph Stats
            </span>
            <div className="flex flex-col gap-1 mt-2">
              <StatRow label="Nodes" value={statsData.totalNodes} />
              <StatRow label="Documents" value={statsData.totalDocuments} />
              <StatRow label="Tags" value={statsData.totalTags} />
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalNodes === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <RefreshCw size={32} style={{ color: 'var(--color-text-muted)', marginBottom: 12 }} />
            <h3 className="text-base font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
              No knowledge nodes yet
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Nodes will appear as documents are processed through the pipeline.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span
        className="text-xs font-mono"
        style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </span>
    </div>
  );
}
