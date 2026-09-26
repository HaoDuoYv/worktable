import { chatComplete, loadAiSettings, isAiConfigured } from '@/modules/ai/aiClient'
import { cleanJson } from './newsFetcher'
import type { NewsItem } from './types'

/**
 * AI 摘要：把抓到的标题列表整理成「标题 + 一句话摘要」。
 * 契约：要求模型返回 JSON 数组 [{ "title": "…", "summary": "…" }]。
 * 失败 / 未配置 AI / 条数丢失严重时，回退为纯标题（summary 为空）。
 */

/** 条数丢失回退阈值：AI 返回条数低于原文 50% 时视为丢失严重 */
const DROP_THRESHOLD = 0.5

export async function summarizeNews(items: NewsItem[]): Promise<NewsItem[]> {
  if (items.length === 0) return items
  if (!isAiConfigured()) return items

  const titleList = items.map((it) => it.title).join('\n')
  const system = [
    '你是中文资讯摘要助手。用户给你一组当日新闻标题，请你为每条写一句不超过 30 字的中文摘要，突出核心信息。',
    '严格只输出一个 JSON 数组，元素形如 {"title":"原标题","summary":"一句话摘要"}。',
    '不要输出任何 JSON 之外的文字、解释或 markdown 围栏。',
    'title 必须与输入标题完全一致，逐条对应，不要遗漏、不要合并。',
  ].join('\n')
  const user = `请为以下标题逐条生成摘要：\n${titleList}`

  try {
    const reply = await chatComplete(loadAiSettings(), [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ])
    const parsed = JSON.parse(cleanJson(reply)) as { title?: string; summary?: string }[]

    if (!Array.isArray(parsed) || parsed.length === 0) return items

    const byTitle = new Map<string, string>()
    for (const p of parsed) {
      const t = (p.title ?? '').trim()
      const s = (p.summary ?? '').trim()
      if (t && s) byTitle.set(t, s)
    }

    // 回退阈值：AI 摘要丢失严重时，直接用原始标题兜底（摘要留空）
    if (byTitle.size < items.length * DROP_THRESHOLD) return items

    return items.map((it) => {
      const s = byTitle.get(it.title)
      return s ? { ...it, summary: s } : it
    })
  } catch {
    // 任何失败（网络 / JSON / 契约不符）都回退纯标题
    return items
  }
}
