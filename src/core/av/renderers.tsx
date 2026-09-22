import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import type { CellState, TracerViewState } from '@/core/av/types'

function cellClass(cell: { patched: boolean; selected: boolean }): string {
  if (cell.patched) return 'viz-cell is-patched'
  if (cell.selected) return 'viz-cell is-selected'
  return 'viz-cell'
}

function barClass(cell: CellState): string {
  if (cell.patched) return 'viz-bar is-patched'
  if (cell.selected) return 'viz-bar is-selected'
  return 'viz-bar'
}

/** 柱体可用最大高度（px），柱高 = 值 / 最大值 × 该值 */
const BAR_MAX_H = 200
/** 柱体最小高度（px），保证 0 值与极小值可见 */
const BAR_MIN_H = 4

/** 数值数组 → 柱状图：柱子高度与元素大小成正比，排序即柱子交换/归位。 */
function BarChartView({ title, row }: { title: string; row: CellState[] }) {
  const max = Math.max(...row.map((c) => Math.max(1, Math.abs(Number(c.value) || 0) || 1)))
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{title}</div>
      <div className="viz-bars">
        {row.map((cell, i) => {
          const v = Number(cell.value) || 0
          const h = Math.max(BAR_MIN_H, (Math.abs(v) / max) * BAR_MAX_H)
          return (
            <div key={i} className="viz-bar-wrap" title={`索引 ${i} · 值 ${fmt(cell.value)}`}>
              <span className="viz-bar__val">{fmt(cell.value)}</span>
              <div className={barClass(cell)} style={{ height: `${Math.round(h)}px` }} />
              <span className="viz-bar__idx">{i}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function Array1DView({ state }: { state: TracerViewState }) {
  const row = state.array?.[0] ?? []
  // 全数值数组 → 柱状图（柱高 ∝ 值大小），否则回退单元格表示
  const numeric =
    row.length > 0 &&
    row.every((c) => typeof c.value === 'number' && Number.isFinite(c.value as number))
  if (numeric) return <BarChartView title={state.title} row={row} />

  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title}</div>
      <div className="viz-array1d">
        {row.map((cell, i) => (
          <div key={i} className={cellClass(cell)} title={`索引 ${i}`}>
            <span className="viz-array1d__idx">{i}</span>
            <span className="viz-array1d__val">{fmt(cell.value)}</span>
          </div>
        ))}
        {row.length === 0 ? <span className="viz-empty">空数组</span> : null}
      </div>
    </div>
  )
}

export function Array2DView({ state }: { state: TracerViewState }) {
  const data = state.array ?? []
  const cols = data.reduce((m, row) => Math.max(m, row.length), 0)
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title}</div>
      <div className="viz-scroll">
        <table className="viz-array2d">
          <thead>
            <tr>
              <th />
              {Array.from({ length: cols }, (_, j) => (
                <th key={j}>{j}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                <th>{i}</th>
                {row.map((cell, j) => (
                  <td key={j} className={cellClass(cell)}>
                    {fmt(cell.value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 ? <span className="viz-empty">空矩阵</span> : null}
      </div>
    </div>
  )
}

export function LogView({ state }: { state: TracerViewState }) {
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title}</div>
      <pre className="viz-log">{state.log || '（无输出）'}</pre>
    </div>
  )
}

export function StackView({ state }: { state: TracerViewState }) {
  const row = state.array?.[0] ?? []
  const cells = [...row].reverse() // top of stack on top
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title}</div>
      <div className="viz-stack">
        <div className="viz-stack__cap">top</div>
        {cells.map((cell, i) => (
          <div key={i} className={cellClass(cell)}>
            <span className="viz-array1d__val">{fmt(cell.value)}</span>
          </div>
        ))}
        {cells.length === 0 ? <span className="viz-empty">空栈</span> : null}
        <div className="viz-stack__cap">bottom</div>
      </div>
    </div>
  )
}

export function QueueView({ state }: { state: TracerViewState }) {
  const row = state.array?.[0] ?? []
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title}</div>
      <div className="viz-queue">
        <div className="viz-queue__cap">front</div>
        <div className="viz-queue__row">
          {row.map((cell, i) => (
            <div key={i} className={cellClass(cell)}>
              <span className="viz-array1d__val">{fmt(cell.value)}</span>
            </div>
          ))}
          {row.length === 0 ? <span className="viz-empty">空队列</span> : null}
        </div>
        <div className="viz-queue__cap">back</div>
      </div>
    </div>
  )
}

export function LinkedListView({ state }: { state: TracerViewState }) {
  const row = state.array?.[0] ?? []
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title}</div>
      <div className="viz-list">
        {row.length === 0 ? <span className="viz-empty">空链表</span> : null}
        {row.map((cell, i) => (
          <div key={i} className="viz-list__node-wrap">
            <div className={`${cellClass(cell)} viz-list__node`}>
              <span className="viz-list__val">{fmt(cell.value)}</span>
              <span className="viz-list__ptr" aria-hidden="true">
                ·
              </span>
            </div>
            {i < row.length - 1 ? (
              <span className="viz-list__arrow" aria-hidden="true">
                →
              </span>
            ) : (
              <span className="viz-list__null" aria-hidden="true">
                ∅
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function GraphView({ state }: { state: TracerViewState }) {
  const nodes = state.nodes ?? []
  const edges = state.edges ?? []
  const isWeighted = Boolean(state.isWeighted)
  const size = 360
  const c = size / 2
  const nodeR = 14
  const arrowGap = 6
  const nodePos = new Map(nodes.map((n) => [n.id, { x: c + n.x, y: c + n.y }]))
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const onWheel = (e: ReactWheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const next = e.deltaY > 0 ? zoom / 1.1 : zoom * 1.1
    setZoom(Math.max(0.4, Math.min(2.5, next)))
  }

  return (
    <div className="viz-panel">
      <div className="viz-panel__title">
        {state.title}
        {isWeighted ? <span className="viz-panel__meta">weighted</span> : null}
        {state.layout ? <span className="viz-panel__meta">layout:{state.layout}</span> : null}
      </div>
      <svg
        width="100%"
        height={size}
        viewBox={`${c - size / 2} ${c - size / 2} ${size} ${size}`}
        className="viz-graph is-pannable"
        role="img"
        aria-label="图可视化"
        onWheel={onWheel}
        onPointerDown={(e: ReactPointerEvent<SVGSVGElement>) => {
          ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
          dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
        }}
        onPointerMove={(e: ReactPointerEvent<SVGSVGElement>) => {
          const d = dragRef.current
          if (!d) return
          setPan({ x: d.panX + (e.clientX - d.x), y: d.panY + (e.clientY - d.y) })
        }}
        onPointerUp={() => {
          dragRef.current = null
        }}
        onPointerCancel={() => {
          dragRef.current = null
        }}
      >
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 z" fill="currentColor" className="viz-arrow" />
          </marker>
          <marker id="arrow-sel" markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 z" className="viz-arrow is-selected" />
          </marker>
          <marker id="arrow-vis" markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 z" className="viz-arrow is-visited" />
          </marker>
        </defs>
        <g transform={`translate(${c + pan.x},${c + pan.y}) scale(${zoom}) translate(${-c},${-c})`}>
          {edges.map((e, i) => {
            const a = nodePos.get(e.source)
            const b = nodePos.get(e.target)
            if (!a || !b) return null
            let ex = b.x
            let ey = b.y
            const dx = b.x - a.x
            const dy = b.y - a.y
            const len = Math.hypot(dx, dy) || 1
            if (state.isDirected !== false) {
              ex = a.x + (dx / len) * (len - nodeR - arrowGap)
              ey = a.y + (dy / len) * (len - nodeR - arrowGap)
            }
            const cls =
              e.selectedCount > 0
                ? 'viz-edge is-selected'
                : e.visitedCount > 0
                  ? 'viz-edge is-visited'
                  : 'viz-edge'
            const marker =
              e.selectedCount > 0
                ? 'url(#arrow-sel)'
                : e.visitedCount > 0
                  ? 'url(#arrow-vis)'
                  : state.isDirected !== false
                    ? 'url(#arrow)'
                    : undefined
            const mx = (a.x + ex) / 2
            const my = (a.y + ey) / 2
            return (
              <g key={i}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={ex}
                  y2={ey}
                  className={cls}
                  markerEnd={marker}
                />
                {isWeighted && e.weight != null ? (
                  <text x={mx} y={my - 6} className="viz-edge__weight" textAnchor="middle">
                    {String(e.weight)}
                  </text>
                ) : null}
              </g>
            )
          })}
          {nodes.map((n) => {
            const p = nodePos.get(n.id)
            if (!p) return null
            const colorCls = n.color === 'red' ? ' is-red' : n.color === 'black' ? ' is-black' : ''
            const cls =
              n.selectedCount > 0
                ? `viz-node is-selected${colorCls}`
                : n.visitedCount > 0
                  ? `viz-node is-visited${colorCls}`
                  : `viz-node${colorCls}`
            const label = n.label ?? String(n.id)
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} className={cls}>
                <circle r={nodeR} className="viz-node__circle" />
                <text textAnchor="middle" dominantBaseline="central" className="viz-node__label">
                  {label}
                </text>
                {isWeighted && n.weight != null && n.label == null ? (
                  <text x={nodeR + 4} className="viz-node__weight" dominantBaseline="central">
                    {String(n.weight)}
                  </text>
                ) : null}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

/** AV ChartTracer / numeric Array1D — bar chart by element size. */
export function ChartView({ state }: { state: TracerViewState }) {
  const row = state.array?.[0] ?? []
  return <BarChartView title={state.title || 'Chart'} row={row} />
}

/** AV ScatterTracer — 2D points from matrix rows (x,y) or index/value. */
export function ScatterView({ state }: { state: TracerViewState }) {
  const data = state.array ?? []
  const size = 280
  const c = size / 2
  const points = data.map((row, i) => {
    const x = Number(row[0]?.value)
    const y = Number(row[1]?.value ?? row[0]?.value)
    return {
      i,
      x: Number.isFinite(x) ? x : i,
      y: Number.isFinite(y) ? y : 0,
      selected: row.some((cell) => cell.selected),
      patched: row.some((cell) => cell.patched),
    }
  })
  const maxX = Math.max(1, ...points.map((p) => Math.abs(p.x)))
  const maxY = Math.max(1, ...points.map((p) => Math.abs(p.y)))
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title || 'Scatter'}</div>
      <svg width="100%" height={size} className="viz-scatter" role="img" aria-label="散点图">
        <line x1={24} y1={c} x2={size - 24} y2={c} className="viz-scatter__axis" />
        <line x1={c} y1={24} x2={c} y2={size - 24} className="viz-scatter__axis" />
        {points.map((p) => {
          const px = c + (p.x / maxX) * (c - 32)
          const py = c - (p.y / maxY) * (c - 32)
          return (
            <circle
              key={p.i}
              cx={px}
              cy={py}
              r={6}
              className={
                p.selected ? 'viz-scatter__dot is-selected' : p.patched ? 'viz-scatter__dot is-patched' : 'viz-scatter__dot'
              }
            >
              <title>{`(${p.x}, ${p.y})`}</title>
            </circle>
          )
        })}
      </svg>
    </div>
  )
}

/** AV MarkdownTracer — lightweight markdown-ish rendering. */
export function MarkdownView({ state }: { state: TracerViewState }) {
  const src = state.markdown ?? ''
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title || 'Markdown'}</div>
      <div className="viz-md">
        {src.split('\n').map((line, i) => {
          if (!line.trim()) return <div key={i} className="viz-md__p" />
          if (line.startsWith('### ')) return <h4 key={i}>{line.slice(4)}</h4>
          if (line.startsWith('## ')) return <h3 key={i}>{line.slice(3)}</h3>
          if (line.startsWith('# ')) return <h2 key={i}>{line.slice(2)}</h2>
          if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i}>{line.slice(2)}</li>
          return (
            <p key={i} className="viz-md__p">
              {line}
            </p>
          )
        })}
        {src ? null : <span className="viz-empty">（空 Markdown）</span>}
      </div>
    </div>
  )
}

export function CircularQueueView({ state }: { state: TracerViewState }) {
  const cells = state.array?.[0] ?? []
  const n = Math.max(cells.length, state.capacity ?? 0)
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">
        {state.title}
        <span className="viz-panel__meta">
          head={state.head ?? 0} tail={state.tail ?? 0} cap={n}
        </span>
      </div>
      <div className="viz-ring">
        {cells.map((cell, i) => {
          const isHead = i === (state.head ?? 0) % Math.max(n, 1)
          const isTail = i === (state.tail ?? 0) % Math.max(n, 1)
          return (
            <div
              key={i}
              className={`${cellClass(cell)} viz-ring__slot${isHead ? ' is-head' : ''}${isTail ? ' is-tail' : ''}`}
            >
              <span className="viz-array1d__idx">{i}</span>
              <span className="viz-array1d__val">{cell.value == null ? '·' : fmt(cell.value)}</span>
              <span className="viz-ring__tag">
                {isHead && isTail ? 'H/T' : isHead ? 'H' : isTail ? 'T' : ''}
              </span>
            </div>
          )
        })}
        {cells.length === 0 ? <span className="viz-empty">未初始化环形队列</span> : null}
      </div>
    </div>
  )
}

export function DequeView({ state }: { state: TracerViewState }) {
  const row = state.array?.[0] ?? []
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title}</div>
      <div className="viz-deque">
        <div className="viz-queue__cap">front</div>
        <div className="viz-queue__row">
          {row.map((cell, i) => (
            <div key={i} className={cellClass(cell)}>
              <span className="viz-array1d__val">{fmt(cell.value)}</span>
            </div>
          ))}
          {row.length === 0 ? <span className="viz-empty">空双端队列</span> : null}
        </div>
        <div className="viz-queue__cap">back</div>
      </div>
    </div>
  )
}

export function StaticLinkedListView({ state }: { state: TracerViewState }) {
  const data = state.array?.[0] ?? []
  const next = state.array?.[1] ?? []
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title}</div>
      <div className="viz-scroll">
        <table className="viz-array2d">
          <thead>
            <tr>
              <th />
              {data.map((_, j) => (
                <th key={j}>{j}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>data</th>
              {data.map((cell, j) => (
                <td key={j} className={cellClass(cell)}>
                  {cell.value == null ? '·' : fmt(cell.value)}
                </td>
              ))}
            </tr>
            <tr>
              <th>next</th>
              {next.map((cell, j) => (
                <td key={j} className={cellClass(cell)}>
                  {cell.value == null ? '·' : fmt(cell.value)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function TracerPanel({ state }: { state: TracerViewState }) {
  if (state.kind === 'CircularQueueTracer') return <CircularQueueView state={state} />
  if (state.kind === 'DequeTracer') return <DequeView state={state} />
  if (state.kind === 'StaticLinkedListTracer') return <StaticLinkedListView state={state} />
  if (state.kind === 'ChartTracer') return <ChartView state={state} />
  if (state.kind === 'MarkdownTracer') return <MarkdownView state={state} />
  if (state.kind === 'ScatterTracer') return <ScatterView state={state} />
  if (state.kind === 'Array1DTracer' || (state.isArray1D && !state.isStaticList)) {
    if (state.kind === 'StackTracer') return <StackView state={state} />
    if (state.kind === 'QueueTracer') return <QueueView state={state} />
    if (state.kind === 'LinkedListTracer') return <LinkedListView state={state} />
    return <Array1DView state={state} />
  }
  if (state.kind === 'Array2DTracer') return <Array2DView state={state} />
  if (state.kind === 'LogTracer') return <LogView state={state} />
  if (
    state.kind === 'GraphTracer' ||
    state.kind === 'TreeTracer' ||
    state.kind === 'RedBlackTreeTracer' ||
    state.kind === 'BPlusTreeTracer'
  ) {
    return <GraphView state={state} />
  }
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title || state.kind}</div>
      <p className="viz-empty">暂不支持的 Tracer 类型：{state.kind}</p>
    </div>
  )
}

/** Parses log text for `var = value` patterns and renders them as live chips. */
export function VariableInspector({ tracers }: { tracers: TracerViewState[] }) {
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set())
  const prevValues = useRef<Map<string, string>>(new Map())

  // Extract variable assignments from all log tracers
  const vars = new Map<string, string>()
  for (const t of tracers) {
    if (!t.log) continue
    const lines = t.log.split('\n')
    for (const line of lines) {
      const regex = /([a-zA-Z_]\w*(?:\[[^\]]+\])?)\s*=\s*([^\n,;]{1,40})/g
      let m: RegExpExecArray | null
      while ((m = regex.exec(line)) !== null) {
        const name = m[1].trim()
        const value = m[2].trim()
        vars.set(name, value)
      }
    }
  }

  // Detect which variables changed since last render
  useEffect(() => {
    const changed = new Set<string>()
    for (const [name, value] of vars) {
      const prev = prevValues.current.get(name)
      if (prev !== undefined && prev !== value) {
        changed.add(name)
      }
      prevValues.current.set(name, value)
    }
    setChangedKeys(changed)
    // Clear changed state after animation
    const timer = window.setTimeout(() => setChangedKeys(new Set()), 500)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracers])

  if (vars.size === 0) return null

  return (
    <div className="var-inspector" role="region" aria-label="变量观察">
      {[...vars.entries()].slice(-12).map(([name, value]) => (
        <span
          key={name}
          className={`var-chip${changedKeys.has(name) ? ' is-changed' : ''}`}
        >
          <span className="var-chip__name">{name}</span>
          <span className="var-chip__eq">=</span>
          <span className="var-chip__val">{value}</span>
        </span>
      ))}
    </div>
  )
}
