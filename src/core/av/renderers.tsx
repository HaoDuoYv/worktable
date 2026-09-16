import type { TracerViewState } from '@/core/av/types'

function cellClass(cell: { patched: boolean; selected: boolean }): string {
  if (cell.patched) return 'viz-cell is-patched'
  if (cell.selected) return 'viz-cell is-selected'
  return 'viz-cell'
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function Array1DView({ state }: { state: TracerViewState }) {
  const row = state.array?.[0] ?? []
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

export function GraphView({ state }: { state: TracerViewState }) {
  const nodes = state.nodes ?? []
  const edges = state.edges ?? []
  const size = 280
  const c = size / 2
  const nodePos = new Map(nodes.map((n) => [n.id, { x: c + n.x, y: c + n.y }]))

  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title}</div>
      <svg width={size} height={size} className="viz-graph" role="img" aria-label="图可视化">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 z" fill="#5a6a80" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = nodePos.get(e.source)
          const b = nodePos.get(e.target)
          if (!a || !b) return null
          const cls =
            e.selectedCount > 0
              ? 'viz-edge is-selected'
              : e.visitedCount > 0
                ? 'viz-edge is-visited'
                : 'viz-edge'
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={cls}
              markerEnd={state.isDirected !== false ? 'url(#arrow)' : undefined}
            />
          )
        })}
        {nodes.map((n) => {
          const p = nodePos.get(n.id)
          if (!p) return null
          const cls =
            n.selectedCount > 0
              ? 'viz-node is-selected'
              : n.visitedCount > 0
                ? 'viz-node is-visited'
                : 'viz-node'
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`}>
              <circle r={14} className={cls} />
              <text textAnchor="middle" dominantBaseline="central" className="viz-node__label">
                {n.id}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function TracerPanel({ state }: { state: TracerViewState }) {
  if (state.kind === 'Array1DTracer' || state.isArray1D) {
    return <Array1DView state={state} />
  }
  if (state.kind === 'Array2DTracer') return <Array2DView state={state} />
  if (state.kind === 'LogTracer') return <LogView state={state} />
  if (state.kind === 'GraphTracer' || state.kind === 'TreeTracer') return <GraphView state={state} />
  return (
    <div className="viz-panel">
      <div className="viz-panel__title">{state.title || state.kind}</div>
      <p className="viz-empty">暂不支持的 Tracer 类型：{state.kind}</p>
    </div>
  )
}
