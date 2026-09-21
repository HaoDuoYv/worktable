import { useEffect, useRef, useState } from 'react'
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
          const colorCls = n.color === 'red' ? ' is-red' : n.color === 'black' ? ' is-black' : ''
          const cls =
            n.selectedCount > 0
              ? `viz-node is-selected${colorCls}`
              : n.visitedCount > 0
                ? `viz-node is-visited${colorCls}`
                : `viz-node${colorCls}`
          const label = n.label ?? (n.weight != null ? String(n.weight) : String(n.id))
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`}>
              <circle r={14} className={cls} />
              <text textAnchor="middle" dominantBaseline="central" className="viz-node__label">
                {label}
              </text>
            </g>
          )
        })}
      </svg>
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
