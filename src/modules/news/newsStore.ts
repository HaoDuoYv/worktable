import { kvGet, kvSet } from '@/core/storage/indexedDb'
import type { NewsDigest } from './types'

/** 按天缓存：key = 'news:v2:YYYY-MM-DD'（v2：新增 toutiao 分类，旧缓存作废） */
const KEY_PREFIX = 'news:v2:'

export function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function cacheKey(date: string): string {
  return `${KEY_PREFIX}${date}`
}

export async function loadDigest(date: string): Promise<NewsDigest | undefined> {
  return kvGet<NewsDigest>(cacheKey(date))
}

export async function saveDigest(digest: NewsDigest): Promise<void> {
  await kvSet(cacheKey(digest.date), digest)
}
