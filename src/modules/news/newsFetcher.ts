import type { NewsItem } from './types'
import { NEWS_SOURCES, type NewsSource } from './sources'

/**
 * 抓取层：负责「拿原文 → 解析成 NewsItem[]」。
 * 渲染层通过 /news/proxy 交给 Electron/vite 主进程抓取，绕过浏览器 CORS；
 * 纯浏览器（无代理）降级直连，失败则抛错交由上层标「源不可用」。
 */

function hashStr(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36)
}

/** 去掉 BOM、首尾空白与不可见字符 */
export function cleanText(s: string): string {
  return s.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
}

/**
 * 清洗 AI/接口返回的 JSON 文本：剥离 ```json 围栏、BOM、前后杂文，
 * 只保留首个 '[' 到最后一个 ']'（数组）或首个 '{' 到最后一个 '}'（对象）。
 */
export function cleanJson(raw: string): string {
  let s = cleanText(raw)
  // 剥离 markdown 围栏
  s = s.replace(/^```(?:json|JSON)?\s*/i, '').replace(/\s*```$/, '')
  const arrStart = s.indexOf('[')
  const objStart = s.indexOf('{')
  if (arrStart >= 0 && (objStart < 0 || arrStart < objStart)) {
    const end = s.lastIndexOf(']')
    if (end > arrStart) return s.slice(arrStart, end + 1)
  }
  if (objStart >= 0) {
    const end = s.lastIndexOf('}')
    if (end > objStart) return s.slice(objStart, end + 1)
  }
  return s
}

function looksLikeHtml(text: string): boolean {
  const t = text.trimStart().toLowerCase()
  return t.startsWith('<!doctype') || t.startsWith('<html')
}

async function viaProxy(url: string, headers: Record<string, string>): Promise<string> {
  const res = await fetch('/news/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, headers }),
  })
  const text = await res.text()
  // 代理不存在时（纯静态托管），SPA fallback 会返回 index.html
  if (looksLikeHtml(text)) throw new Error('proxy-unavailable')
  // 代理在工作，但目标源抓取失败（如 502/超时）
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return text
}

async function directFetch(url: string, headers: Record<string, string>): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url, { headers, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchRaw(url: string, headers?: Record<string, string>): Promise<string> {
  const h = headers ?? {}
  try {
    return await viaProxy(url, h)
  } catch (e) {
    // 仅当「代理本身不可用」时降级直连；源抓取失败(502)直接抛错，避免二次慢请求
    if (e instanceof Error && e.message === 'proxy-unavailable') {
      return await directFetch(url, h)
    }
    throw e
  }
}

/* —— RSS 轻量解析 —— */

function parseRss(text: string, limit: number): { title: string; url?: string }[] {
  const items: { title: string; url?: string }[] = []
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(text)) !== null && items.length < limit) {
    const body = m[1]
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? ''
    const link = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(body)?.[1] ?? ''
    const clean = (s: string) =>
      s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim()
    const t = clean(title)
    if (!t) continue
    items.push({ title: t, url: clean(link) || undefined })
  }
  return items
}

/* —— JSON 通用路径解析 —— */

type PathSeg = string | number

function resolvePath(obj: unknown, path: PathSeg[]): unknown {
  let cur = obj
  for (const seg of path) {
    if (cur == null) return undefined
    if (typeof seg === 'number') {
      cur = Array.isArray(cur) ? cur[seg] : undefined
    } else {
      cur = (cur as Record<string, unknown>)[seg]
    }
  }
  return cur
}

function parseJson(source: NewsSource, text: string): { title: string; url?: string }[] {
  const limit = source.limit ?? 15
  let data: unknown
  try {
    data = JSON.parse(cleanJson(text))
  } catch {
    throw new Error('JSON 解析失败')
  }
  const arr = resolvePath(data, source.itemPath ?? [])
  if (!Array.isArray(arr)) throw new Error('条目结构不符')
  const out: { title: string; url?: string }[] = []
  for (const entry of arr) {
    if (out.length >= limit) break
    const title = String(resolvePath(entry, source.titlePath ?? []) ?? '').trim()
    if (!title) continue
    const url = source.urlPath ? String(resolvePath(entry, source.urlPath) ?? '').trim() : undefined
    out.push({ title, url: url || undefined })
  }
  if (out.length === 0) throw new Error('未提取到条目')
  return out
}

/* —— 单源抓取 —— */

export async function fetchSource(source: NewsSource): Promise<NewsItem[]> {
  const text = await fetchRaw(source.url, source.headers)
  const limit = source.limit ?? 15
  const raw = source.kind === 'rss' ? parseRss(text, limit) : parseJson(source, text)
  return raw.map((r) => ({
    id: `${source.id}_${hashStr(r.title)}`,
    title: r.title,
    url: r.url,
    source: source.name,
    category: source.category,
  }))
}

/* —— 某类全部源抓取（并发 + 容错） —— */

export interface FetchResult {
  items: NewsItem[]
  failedSources: string[]
}

/** 按标题去重（跨源同题保留首个） */
function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const it of items) {
    const k = it.title.trim()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(it)
  }
  return out
}

export async function fetchCategory(category: 'ai' | 'hot'): Promise<FetchResult> {
  const sources = NEWS_SOURCES.filter((s) => s.category === category)
  const results = await Promise.allSettled(sources.map((s) => fetchSource(s)))
  const items: NewsItem[] = []
  const failedSources: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value)
    else failedSources.push(sources[i].name)
  })
  return { items: dedupe(items), failedSources }
}
