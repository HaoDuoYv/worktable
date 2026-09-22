export type AiJobKind = 'viz' | 'chat' | 'test'
export type AiJobStatus = 'running' | 'done' | 'error'

export interface AiJob {
  id: string
  kind: AiJobKind
  title: string
  status: AiJobStatus
  detail?: string
  startedAt: number
  finishedAt?: number
}

type Listener = () => void

const jobs = new Map<string, AiJob>()
const listeners = new Set<Listener>()

function notify() {
  for (const l of listeners) l()
}

export function subscribeAiJobs(listener: Listener): () => void {
  listeners.add(listener)
  listener()
  return () => {
    listeners.delete(listener)
  }
}

export function getAiJobs(): AiJob[] {
  return [...jobs.values()].sort((a, b) => b.startedAt - a.startedAt)
}

export function hasRunningAiJob(): boolean {
  return [...jobs.values()].some((j) => j.status === 'running')
}

/** 全局是否已有「生成可视化」在跑（跨路由，防止重复点击） */
export function hasRunningVizJob(): boolean {
  return [...jobs.values()].some((j) => j.kind === 'viz' && j.status === 'running')
}

export function getRunningVizJob(): AiJob | null {
  return [...jobs.values()].find((j) => j.kind === 'viz' && j.status === 'running') ?? null
}

function upsert(job: AiJob) {
  jobs.set(job.id, job)
  notify()
}

/**
 * Run an AI/network job in the background.
 * Survives route changes — completion always writes results even if the page unmounted.
 */
export function startAiJob(opts: {
  kind: AiJobKind
  title: string
  run: (ctx: { update: (detail: string) => void }) => Promise<string | void>
}): string {
  const id = `aijob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const job: AiJob = {
    id,
    kind: opts.kind,
    title: opts.title,
    status: 'running',
    detail: '处理中…',
    startedAt: Date.now(),
  }
  upsert(job)

  void (async () => {
    try {
      const detail = await opts.run({
        update: (d) => {
          const cur = jobs.get(id)
          if (!cur || cur.status !== 'running') return
          upsert({ ...cur, detail: d })
        },
      })
      const cur = jobs.get(id)
      upsert({
        ...(cur ?? job),
        status: 'done',
        detail: typeof detail === 'string' && detail ? detail : '已完成',
        finishedAt: Date.now(),
      })
    } catch (e) {
      const cur = jobs.get(id)
      upsert({
        ...(cur ?? job),
        status: 'error',
        detail: e instanceof Error ? e.message : String(e),
        finishedAt: Date.now(),
      })
    } finally {
      window.setTimeout(() => {
        jobs.delete(id)
        notify()
      }, 12000)
    }
  })()

  return id
}

export function dismissAiJob(id: string) {
  jobs.delete(id)
  notify()
}
