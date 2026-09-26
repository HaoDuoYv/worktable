/** 每日新闻 —— 数据模型 */

export type NewsCategory = 'ai' | 'hot' | 'toutiao'

export const CATEGORY_META: Record<
  NewsCategory,
  { label: string; hint: string }
> = {
  ai: { label: 'AI 新闻', hint: 'AI 与科技行业动态' },
  hot: { label: '社会热点', hint: '全网热议话题' },
  toutiao: { label: '今日头条', hint: '头条热榜' },
}

export interface NewsItem {
  /** 稳定 id（由标题 + 来源哈希而来，用于去重与渲染 key） */
  id: string
  title: string
  /** AI 生成的一句话摘要；未配 AI 或生成失败时为空 */
  summary?: string
  /** 原文链接（可选，部分热榜无直达链接） */
  url?: string
  /** 来源名，如「36氪」「微博热搜」 */
  source: string
  category: NewsCategory
  /** 热度值（热榜类源，如「482万」） */
  heat?: string
}

export type NewsStatus = 'idle' | 'generating' | 'done' | 'error'

export interface NewsDigest {
  /** 归属日期 'YYYY-MM-DD'，作为缓存 key */
  date: string
  status: NewsStatus
  items: NewsItem[]
  /** 生成完成时间戳 */
  generatedAt?: number
  /** 是否部分源抓取失败（仍展示已有内容） */
  partial?: boolean
  /** 抓取失败/被跳过的源名 */
  failedSources?: string[]
  /** 整体失败原因（status === 'error' 时） */
  error?: string
}
