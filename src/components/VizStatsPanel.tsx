import { useEffect, useMemo, useRef, useState } from 'react'
import type { TracerViewState } from '@/core/av/types'
import { computeVizStats, STATUS_META, type VizStats } from '@/core/av/stats'

export interface VizStatsPanelProps {
  tracers: TracerViewState[]
  cursor: number
  total: number
  playing: boolean
  building: boolean
}

const OPS_ROWS: { key: keyof VizStats['ops']; label: string }[] = [
  { key: 'insert', label: '插入' },
  { key: 'delete', label: '删除' },
  { key: 'search', label: '查找' },
  { key: 'compare', label: '比较' },
  { key: 'swap', label: '交换' },
  { key: 'visit', label: '遍历' },
]

interface Pos {
  x: number
  y: number
}

/**
 * 统计信息浮动窗口 —— 实时展示元素数量 / 容量 / 操作次数 / 执行状态。
 * 标题栏可拖动；右下角拖拽手柄；随回放步进实时刷新并对变化项闪烁；响应式适配。
 */
export function VizStatsPanel({ tracers, cursor, total, playing, building }: VizStatsPanelProps) {
  const stats = useMemo(
    () => computeVizStats(tracers, { cursor, total, playing, building }),
    [tracers, cursor, total, playing, building],
  )

  const [minimized, setMinimized] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // 数值变化闪烁：元素数量 / 操作总数 / 状态变化时高亮 0.4s
  const signature = `${stats.elementCount}|${stats.opTotal}|${stats.status}`
  const prevSig = useRef(signature)
  useEffect(() => {
    if (prevSig.current !== signature) {
      prevSig.current = signature
      setFlashKey(signature)
      const t = window.setTimeout(() => setFlashKey((k) => (k === signature ? null : k)), 420)
      return () => window.clearTimeout(t)
    }
  }, [signature])

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = rootRef.current
    if (!el) return
    e.preventDefault()
    const rect = el.getBoundingClientRect()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos?.x ?? 0,
      baseY: pos?.y ?? 0,
    }
    // 首次拖动时以当前视觉位置为基准
    if (pos === null) {
      const parent = el.parentElement
      if (parent) {
        const p = parent.getBoundingClientRect()
        dragRef.current.baseX = rect.left - p.left
        dragRef.current.baseY = rect.top - p.top
      }
    }
  }

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    const el = rootRef.current
    if (!d || !el) return
    const parent = el.parentElement
    const pw = parent?.clientWidth ?? window.innerWidth
    const ph = parent?.clientHeight ?? window.innerHeight
    const bw = el.offsetWidth
    const bh = el.offsetHeight
    const nx = clamp(d.baseX + (e.clientX - d.startX), 0, Math.max(0, pw - bw))
    const ny = clamp(d.baseY + (e.clientY - d.startY), 0, Math.max(0, ph - bh))
    setPos({ x: nx, y: ny })
  }

  const onDragEnd = () => {
    dragRef.current = null
  }

  const meta = STATUS_META[stats.status]
  const style = pos ? ({ left: pos.x, top: pos.y, right: 'auto' } as React.CSSProperties) : undefined

  return (
    <div
      ref={rootRef}
      className={`viz-stats${minimized ? ' is-min' : ''}${flashKey ? ' is-flash' : ''}${
        pos ? ' is-dragged' : ''
      }`}
      style={style}
      role="region"
      aria-label="数据结构统计"
      data-status={stats.status}
    >
      <div className="viz-stats__head" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
        <span className="viz-stats__grip" aria-hidden="true">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="2.5" cy="2.5" r="1.3" />
            <circle cx="7.5" cy="2.5" r="1.3" />
            <circle cx="2.5" cy="7" r="1.3" />
            <circle cx="7.5" cy="7" r="1.3" />
            <circle cx="2.5" cy="11.5" r="1.3" />
            <circle cx="7.5" cy="11.5" r="1.3" />
          </svg>
        </span>
        <span className="viz-stats__title">统计</span>
        <span className={`viz-stats__status is-${meta.tone}`}>
          <i className="viz-stats__status-dot" aria-hidden="true" />
          {meta.label}
        </span>
        <button
          type="button"
          className="viz-stats__toggle"
          aria-label={minimized ? '展开统计' : '收起统计'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setMinimized((v) => !v)}
        >
          {minimized ? '+' : '−'}
        </button>
      </div>

      {!minimized && (
        <div className="viz-stats__body">
          <div className="viz-stats__row">
            <span className="viz-stats__k">元素数量</span>
            <span className="viz-stats__v" data-metric="count">
              {stats.elementCount}
            </span>
          </div>
          <div className="viz-stats__row">
            <span className="viz-stats__k">当前容量</span>
            <span className="viz-stats__v" data-metric="capacity">
              {stats.capacity == null ? '无限制' : stats.capacity}
            </span>
          </div>
          <div className="viz-stats__row">
            <span className="viz-stats__k">操作次数</span>
            <span className="viz-stats__v" data-metric="opTotal">
              {stats.opTotal}
            </span>
          </div>

          <div className="viz-stats__ops">
            {OPS_ROWS.filter((r) => stats.ops[r.key] > 0).map((r) => (
              <span key={r.key} className="viz-stats__op">
                {r.label} {stats.ops[r.key]}
              </span>
            ))}
            {stats.opTotal === 0 ? (
              <span className="viz-stats__ops-empty">暂无操作</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
