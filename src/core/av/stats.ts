import type { TracerViewState } from '@/core/av/types'

/**
 * 数据结构可视化 —— 统计信息模型。
 * 从回放中的 TracerViewState[] 推导实时统计，供浮动统计窗口消费。
 * 纯函数：不依赖 React，便于测试与复用。
 */

export type VizRunStatus = 'idle' | 'building' | 'running' | 'paused' | 'done'

export interface VizOpCounts {
  insert: number
  delete: number
  search: number
  compare: number
  swap: number
  visit: number
}

export interface VizStats {
  /** 当前结构内有效元素数量（空值/占位不计入） */
  elementCount: number
  /** 结构容量；无固定容量时为 null（如链表/树） */
  capacity: number | null
  /** 各核心操作计数 */
  ops: VizOpCounts
  /** 操作总次数（各操作之和） */
  opTotal: number
  /** 执行状态 */
  status: VizRunStatus
  /** 参与统计的结构 Tracer 数量（非日志） */
  tracerCount: number
}

const EMPTY_OPS: VizOpCounts = { insert: 0, delete: 0, search: 0, compare: 0, swap: 0, visit: 0 }

function countElements(t: TracerViewState): number {
  if (t.nodes) return t.nodes.length
  if (t.array) {
    return t.array.flat().filter((c) => c.value !== null && c.value !== undefined && c.value !== '')
      .length
  }
  return 0
}

function capacityOf(t: TracerViewState): number | null {
  if (t.kind === 'CircularQueueTracer') return t.capacity ?? t.array?.[0]?.length ?? null
  if (t.kind === 'StaticLinkedListTracer' || t.isStaticList) {
    return t.array?.[0]?.length ?? null
  }
  if (t.array) return t.array[0]?.length ?? null
  return null
}

/**
 * 从日志文本中统计操作次数。日志由可视化代码通过 println 输出，
 * 因此按常见中英文关键词计数，覆盖插入/删除/查找/比较/交换/遍历。
 */
function countOps(tracers: TracerViewState[]): VizOpCounts {
  const ops: VizOpCounts = { ...EMPTY_OPS }
  const patterns: [keyof VizOpCounts, RegExp][] = [
    ['insert', /插入|push|enqueue|insert|unshift|pushFront|pushBack/gi],
    ['delete', /删除|pop|dequeue|remove|shift|popFront|popBack/gi],
    ['search', /查找|搜索|search|find/gi],
    ['compare', /比较|compare/gi],
    ['swap', /交换|swap/gi],
    ['visit', /访问|遍历|visit|traverse/gi],
  ]
  for (const t of tracers) {
    if (!t.log) continue
    for (const [key, re] of patterns) {
      const m = t.log.match(re)
      if (m) ops[key] += m.length
    }
  }
  return ops
}

export interface VizStatsContext {
  cursor: number
  total: number
  playing: boolean
  building: boolean
}

export function computeVizStats(
  tracers: TracerViewState[],
  ctx: VizStatsContext,
): VizStats {
  const dataTracers = tracers.filter((t) => t.kind !== 'LogTracer')
  const elementCount = dataTracers.reduce((n, t) => n + countElements(t), 0)
  const capacities = dataTracers.map(capacityOf).filter((c): c is number => c != null)
  const capacity = capacities.length > 0 ? Math.max(...capacities) : null
  const ops = countOps(tracers)
  const opTotal = ops.insert + ops.delete + ops.search + ops.compare + ops.swap + ops.visit

  let status: VizRunStatus = 'idle'
  if (ctx.building) status = 'building'
  else if (ctx.playing) status = 'running'
  else if (ctx.total > 0 && ctx.cursor >= ctx.total) status = 'done'
  else if (ctx.cursor > 0) status = 'paused'

  return { elementCount, capacity, ops, opTotal, status, tracerCount: dataTracers.length }
}

/** 供 UI 展示的状态文案与语义色 token 名。 */
export const STATUS_META: Record<VizRunStatus, { label: string; tone: string }> = {
  idle: { label: '待运行', tone: 'idle' },
  building: { label: '构建中', tone: 'busy' },
  running: { label: '运行中', tone: 'running' },
  paused: { label: '已暂停', tone: 'paused' },
  done: { label: '已完成', tone: 'done' },
}
