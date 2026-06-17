import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface GraphNode {
  id: string;
  label: string;
  type: string;
  description: string | null;
  size: number;
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

const CATEGORY_COLORS: Record<string, string> = {
  CONCEPT: '#818cf8',
  PERSON: '#10b981',
  TECHNOLOGY: '#0ea5e9',
  PLACE: '#f59e0b',
  METHOD: '#f43f5e',
  OTHER: '#71717a',
}

export default function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simLoopRef = useRef<number>(0)

  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Physics tuning
  const [repulsion, setRepulsion] = useState(550)
  const linkDistance = 120
  const gravity = 0.002

  // Filtering
  const [filters, setFilters] = useState<Record<string, boolean>>({
    CONCEPT: true,
    PERSON: true,
    TECHNOLOGY: true,
    PLACE: true,
    METHOD: true,
    OTHER: true,
  })

  const activeNodesRef = useRef<GraphNode[]>([])
  const activeEdgesRef = useRef<GraphEdge[]>([])

  // Queries: Graph Nodes
  const { data: nodesData } = useQuery<{ nodes: GraphNode[]; totalNodes: number }>({
    queryKey: ['graph-nodes'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { nodes: GraphNode[]; totalNodes: number } }>('/api/graph/nodes')
      return res.data.data
    },
  })

  // Queries: Graph Edges
  const { data: edgesData } = useQuery<{ edges: GraphEdge[]; totalEdges: number }>({
    queryKey: ['graph-edges'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { edges: GraphEdge[]; totalEdges: number } }>('/api/graph/edges')
      return res.data.data
    },
  })

  // Queries: Graph Stats
  const { data: statsData } = useQuery<GraphStats>({
    queryKey: ['graph-stats'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: GraphStats }>('/api/graph/stats')
      return res.data.data
    },
  })

  const getFilteredGraph = useCallback(() => {
    if (!nodesData?.nodes) return { nodes: [], edges: [] }
    const nodes = nodesData.nodes.filter((n) => filters[n.type] ?? true)
    const activeIds = new Set(nodes.map((n) => n.id))
    const edges = (edgesData?.edges ?? []).filter(
      (e) => activeIds.has(e.source) && activeIds.has(e.target)
    )
    return { nodes, edges }
  }, [nodesData, edgesData, filters])

  // Sync canvas bounds
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Physics animation ticks loop
  useEffect(() => {
    const { nodes, edges } = getFilteredGraph()
    if (nodes.length === 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const cw = canvas.width
    const ch = canvas.height

    // Randomize initial coordinate vectors if undefined
    nodes.forEach((n, idx) => {
      if (n.x === undefined || isNaN(n.x)) {
        const angle = (idx / nodes.length) * 2 * Math.PI
        const r = Math.min(cw, ch) * 0.25 * Math.random()
        n.x = cw / 2 + r * Math.cos(angle)
        n.y = ch / 2 + r * Math.sin(angle)
        n.vx = 0
        n.vy = 0
      }
    })

    activeNodesRef.current = nodes
    activeEdgesRef.current = edges

    const tick = () => {
      const activeNodes = activeNodesRef.current
      const activeEdges = activeEdgesRef.current

      // 1. Compute Repulsion Forces
      for (let i = 0; i < activeNodes.length; i++) {
        const n1 = activeNodes[i]
        if (!n1) continue
        for (let j = i + 1; j < activeNodes.length; j++) {
          const n2 = activeNodes[j]
          if (!n2) continue

          const dx = n2.x - n1.x
          const dy = n2.y - n1.y
          const distSq = dx * dx + dy * dy + 0.1
          const dist = Math.sqrt(distSq)

          if (dist < 300) {
            const force = repulsion / distSq
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force

            n1.vx -= fx
            n1.vy -= fy
            n2.vx += fx
            n2.vy += fy
          }
        }
      }

      // 2. Compute Link Attraction Forces
      activeEdges.forEach((edge) => {
        const sNode = activeNodes.find((n) => n.id === edge.source)
        const tNode = activeNodes.find((n) => n.id === edge.target)

        if (sNode && tNode) {
          const dx = tNode.x - sNode.x
          const dy = tNode.y - sNode.y
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1
          const delta = dist - linkDistance
          const force = delta * 0.04 * edge.strength

          const fx = (dx / dist) * force
          const fy = (dy / dist) * force

          sNode.vx += fx
          sNode.vy += fy
          tNode.vx -= fx
          tNode.vy -= fy
        }
      })

      // 3. Gravity center pull & Drag friction dampening
      activeNodes.forEach((n) => {
        const dx = cw / 2 - n.x
        const dy = ch / 2 - n.y

        n.vx += dx * gravity
        n.vy += dy * gravity

        n.vx *= 0.82
        n.vy *= 0.82

        if (n.fx !== null && n.fx !== undefined) {
          n.x = n.fx
          n.vx = 0
        } else {
          n.x += n.vx
        }

        if (n.fy !== null && n.fy !== undefined) {
          n.y = n.fy
          n.vy = 0
        } else {
          n.y += n.vy
        }
      })

      // 4. Draw Canvas Viewport Frame
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, cw, ch)
        ctx.save()
        ctx.translate(offset.x, offset.y)
        ctx.scale(zoom, zoom)

        // Draw Edge Connectors
        ctx.lineWidth = 1
        activeEdges.forEach((edge) => {
          const sNode = activeNodes.find((n) => n.id === edge.source)
          const tNode = activeNodes.find((n) => n.id === edge.target)

          if (sNode && tNode) {
            ctx.beginPath()
            ctx.moveTo(sNode.x, sNode.y)
            ctx.lineTo(tNode.x, tNode.y)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
            ctx.stroke()
          }
        })

        // Draw Entity Nodes
        activeNodes.forEach((n) => {
          const color = CATEGORY_COLORS[n.type] || '#71717a'

          ctx.beginPath()
          ctx.arc(n.x, n.y, (n.size ?? 10) * 1.5, 0, 2 * Math.PI)
          ctx.fillStyle = 'rgba(11, 19, 38, 0.75)'
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.fill()
          ctx.stroke()

          ctx.beginPath()
          ctx.arc(n.x, n.y, (n.size ?? 10) * 0.5, 0, 2 * Math.PI)
          ctx.fillStyle = color
          ctx.fill()

          ctx.font = "bold 9px 'Geist', sans-serif"
          ctx.fillStyle = '#dae2fd'
          ctx.textAlign = 'center'
          ctx.fillText(n.label, n.x, n.y + (n.size ?? 10) * 2.5)
        })

        ctx.restore()
      }

      simLoopRef.current = requestAnimationFrame(tick)
    }

    simLoopRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(simLoopRef.current)
  }, [getFilteredGraph, repulsion, linkDistance, gravity, offset, zoom])

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left - offset.x) / zoom
    const my = (e.clientY - rect.top - offset.y) / zoom

    setCursorPos({ x: e.clientX, y: e.clientY })

    if (dragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
      return
    }

    const hovered = activeNodesRef.current.find((n) => {
      const dx = n.x - mx
      const dy = n.y - my
      return Math.sqrt(dx * dx + dy * dy) < (n.size ?? 10) * 1.8
    })

    setHoveredNode(hovered ?? null)
  }

  const handleMouseUp = () => {
    setDragging(false)
  }

  const handleCanvasClick = () => {
    if (hoveredNode) {
      setSelectedNode(hoveredNode)
    } else {
      setSelectedNode(null)
    }
  }

  const handleRecenter = () => {
    setOffset({ x: 0, y: 0 })
    setZoom(1)
  }

  return (
    <div className="h-[calc(100vh-100px)] relative overflow-hidden rounded-xl border border-outline-variant/30 glass-panel select-none" ref={containerRef}>
      
      {/* 2D Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Excerpt Details Tooltip Popup */}
      {(hoveredNode || selectedNode) && (
        <div
          className="absolute glass-panel p-md rounded-xl w-64 shadow-2xl z-40 animate-fade-in bg-surface-container"
          style={{
            top: `${Math.min(cursorPos.y - 120, window.innerHeight - 340)}px`,
            left: `${Math.min(cursorPos.x - 220, window.innerWidth - 300)}px`,
          }}
        >
          {(() => {
            const activeNode = selectedNode || hoveredNode
            if (!activeNode) return null
            const nodeColor = CATEGORY_COLORS[activeNode.type] || '#71717a'

            return (
              <>
                <div className="flex justify-between items-start mb-sm">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border"
                    style={{ backgroundColor: `${nodeColor}15`, color: nodeColor, borderColor: `${nodeColor}30` }}
                  >
                    {activeNode.type}
                  </span>
                  <span className="text-on-surface-variant text-[10px]">Active Node</span>
                </div>
                <h3 className="font-headline-lg text-sm text-on-surface mb-xs font-bold truncate">
                  {activeNode.label}
                </h3>
                <p className="text-on-surface-variant text-[11px] leading-relaxed mb-md line-clamp-3">
                  {activeNode.description || 'No entity summary indexed yet.'}
                </p>
                <div className="grid grid-cols-2 gap-sm">
                  <div className="bg-white/5 p-2 rounded-lg border border-outline-variant/30 text-xs">
                    <p className="text-[8px] text-on-surface-variant uppercase font-bold">Vector Size</p>
                    <p className="text-on-surface font-code font-bold mt-0.5">{activeNode.size ?? 10}</p>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg border border-outline-variant/30 text-xs">
                    <p className="text-[8px] text-on-surface-variant uppercase font-bold">Influence</p>
                    <p className="text-secondary font-code font-bold mt-0.5">High</p>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* Floating Bottom Control Panel */}
      <div className="absolute bottom-lg left-1/2 -translate-x-1/2 flex items-center gap-sm p-2 glass-panel rounded-full shadow-lg z-50 flex-wrap">
        <div className="flex items-center gap-1 border-r border-outline-variant/30 pr-sm ml-sm flex-wrap">
          {Object.keys(filters).map((type) => {
            const checked = filters[type]
            const color = CATEGORY_COLORS[type] || '#71717a'

            return (
              <button
                key={type}
                onClick={() => setFilters((f) => ({ ...f, [type]: !f[type] }))}
                className="p-2 rounded-full transition-all cursor-pointer text-xs font-bold"
                style={{
                  backgroundColor: checked ? `${color}20` : 'transparent',
                  color: checked ? color : 'var(--color-on-surface-variant)',
                }}
                title={type}
              >
                <span className="material-symbols-outlined text-[20px] block">
                  {type === 'CONCEPT' ? 'lightbulb' :
                   type === 'PERSON' ? 'group' :
                   type === 'TECHNOLOGY' ? 'precision_manufacturing' :
                   type === 'PLACE' ? 'location_on' : 'hub'}
                </span>
              </button>
            )
          })}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 px-sm">
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
            className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] block">add</span>
          </button>
          <span className="font-code text-[11px] text-on-surface-variant min-w-[32px] text-center font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
            className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] block">remove</span>
          </button>
        </div>

        {/* Repulsion physics range slider */}
        <div className="flex items-center gap-1 border-l border-outline-variant/30 pl-sm pr-sm">
          <span className="text-[9px] font-bold text-on-surface-variant uppercase mr-1">Repulsion</span>
          <input
            type="range"
            min="200"
            max="1200"
            step="50"
            value={repulsion}
            onChange={(e) => setRepulsion(Number(e.target.value))}
            className="w-16 h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        <button
          onClick={handleRecenter}
          className="flex items-center gap-sm px-4 py-2 bg-surface-bright text-on-surface rounded-full font-label-sm border border-outline-variant/30 hover:bg-white/10 transition-colors mr-1 cursor-pointer text-[11px] font-bold"
        >
          <span className="material-symbols-outlined text-[18px] block">recenter</span>
          <span>Recenter</span>
        </button>
      </div>

      {/* Sidebar Metrics Summary Panel */}
      <div className="absolute top-lg right-lg w-72 glass-panel rounded-2xl p-lg z-40 hidden xl:block text-xs">
        <div className="flex items-center justify-between mb-lg border-b border-outline-variant/30 pb-3">
          <h4 className="font-headline-lg text-sm font-semibold">Network Stats</h4>
          <span className="material-symbols-outlined text-outline">info</span>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-[10px] mb-xs font-bold text-on-surface-variant uppercase tracking-wider">
              <span>Relational Density</span>
              <span className="text-primary">
                {statsData ? `${Math.round((statsData.totalTags / (statsData.totalNodes || 1)) * 100)}%` : '78%'}
              </span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{
                  width: statsData ? `${Math.min(100, Math.round((statsData.totalTags / (statsData.totalNodes || 1)) * 100))}%` : '78%',
                }}
              />
            </div>
          </div>

          <div className="pt-md border-t border-outline-variant/30">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-md tracking-wider">Entity Clusters</p>
            <div className="space-y-3">
              <div className="flex items-center gap-md">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="flex-grow text-on-surface">Documents Ingested</span>
                <span className="text-on-surface-variant font-code font-bold font-mono">{statsData?.totalDocuments ?? 0} nodes</span>
              </div>
              <div className="flex items-center gap-md">
                <div className="w-2 h-2 rounded-full bg-secondary" />
                <span className="flex-grow text-on-surface">Classified Tags</span>
                <span className="text-on-surface-variant font-code font-bold font-mono">{statsData?.totalTags ?? 0} nodes</span>
              </div>
              <div className="flex items-center gap-md">
                <div className="w-2 h-2 rounded-full bg-tertiary" />
                <span className="flex-grow text-on-surface">Total Graph Nodes</span>
                <span className="text-on-surface-variant font-code font-bold font-mono">{statsData?.totalNodes ?? 0} nodes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
