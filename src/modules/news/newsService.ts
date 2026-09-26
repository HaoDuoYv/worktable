import type { NewsDigest } from './types'
import { fetchCategory } from './newsFetcher'
import { summarizeNews } from './newsSummary'
import { loadDigest, saveDigest, todayKey } from './newsStore'
import { startAiJob } from '@/modules/ai/aiJobs'

/**
 * 每日新闻单例服务：首页卡片与新闻页共享同一份状态，避免重复触发。
 * ensure() 用模块级 pending Promise 去重，防止并发重复生成。
 */

export interface NewsState {
  date: string
  digest: NewsDigest | undefined
  loading: boolean
}

let state: NewsState = { date: todayKey(), digest: undefined, loading: false }
const listeners = new Set<() => void>()
let pending: Promise<NewsDigest> | null = null

function setState(next: Partial<NewsState>) {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

export function getNewsState(): NewsState {
  return state
}

export function subscribeNews(listener: () => void): () => void {
  listeners.add(listener)
  listener()
  return () => {
    listeners.delete(listener)
  }
}

function generate(date: string): Promise<NewsDigest> {
  setState({ date, digest: { date, status: 'generating', items: [] }, loading: true })

  return new Promise<NewsDigest>((resolve) => {
    startAiJob({
      kind: 'news',
      title: '每日新闻',
      run: async ({ update }) => {
        try {
          update('抓取新闻…')
          const [ai, hot] = await Promise.all([fetchCategory('ai'), fetchCategory('hot')])

          const merged = [...ai.items, ...hot.items]
          if (merged.length === 0) throw new Error('所有数据源均不可用，请检查网络后重试')

          update('AI 整理摘要…')
          const items = await summarizeNews(merged)

          const failed = [...ai.failedSources, ...hot.failedSources]
          const digest: NewsDigest = {
            date,
            status: 'done',
            items,
            generatedAt: Date.now(),
            partial: failed.length > 0,
            failedSources: failed.length > 0 ? failed : undefined,
          }
          await saveDigest(digest)
          setState({ date, digest, loading: false })
          resolve(digest)
          return failed.length > 0 ? `已生成（${failed.length} 个源不可用）` : '已生成'
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          const digest: NewsDigest = { date, status: 'error', items: [], error: msg }
          setState({ date, digest, loading: false })
          resolve(digest)
          throw e // 让右下角任务标记为失败
        }
      },
    })
  })
}

/**
 * 打开时检查：有今日缓存直接用，无则自动生成。
 * 并发调用只触发一次生成（pending 去重）。
 */
export function ensureNews(): Promise<NewsDigest> {
  if (pending) return pending

  const date = todayKey()
  pending = (async () => {
    const cached = await loadDigest(date)
    if (cached && cached.status === 'done') {
      setState({ date, digest: cached, loading: false })
      return cached
    }
    return generate(date)
  })().finally(() => {
    pending = null
  })

  return pending
}

/** 强制重新生成（若已在生成则复用当前任务） */
export function refreshNews(): Promise<NewsDigest> {
  if (pending) return pending
  const date = todayKey()
  pending = generate(date).finally(() => {
    pending = null
  })
  return pending
}
