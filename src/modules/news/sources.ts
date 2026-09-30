import type { NewsCategory } from './types'

/**
 * 新闻数据源定义（分级源清单，参考 ai-daily-briefing 的 sources 思路）。
 * 后续想加/删源，直接改这个数组即可，抓取逻辑无需变动。
 *
 * kind:
 *  - 'rss'  : 抓回 XML，用轻量正则提取 <item> 的 <title>/<link>
 *  - 'json' : 抓回 JSON，用 itemPath 定位条目数组、titlePath/urlPath 定位字段
 *
 * 分级字段（本次重构新增）：
 *  - lang   : 'zh' | 'en' —— 中英双语并行，英文源补技术细节，中文源补产业视角
 *  - focus  : 主题方向（对应 topics.ts 的主题 id），说明该源的主要覆盖领域
 *  - enabled: 是否启用（失效源可临时关闭，默认 true）
 *  - notes  : 用途 / 状态说明（对应用户侧的「数据源状态」卡）
 *
 * headers : 透传到抓取代理，用于满足微博/知乎等接口的 Referer 需求。
 */
export interface NewsSource {
  id: string
  name: string
  category: NewsCategory
  kind: 'rss' | 'json'
  url: string
  /** 透传请求头（如 Referer / User-Agent） */
  headers?: Record<string, string>
  /** 语言：中文 / 英文（中英双语并行检索） */
  lang?: 'zh' | 'en'
  /** 主题方向（topics.ts 的主题 id） */
  focus?: string[]
  /** 是否启用（失效源可临时关闭） */
  enabled?: boolean
  /** 用途 / 状态说明 */
  notes?: string
  /**
   * JSON 源：条目数组在响应里的路径。
   * 数字段表示数组下标（如 ['data','cards',0,'content']）。
   */
  itemPath?: (string | number)[]
  /** JSON 源：每条目里标题字段的路径 */
  titlePath?: string[]
  /** JSON 源：每条目里链接字段的路径（缺省则无链接） */
  urlPath?: string[]
  /** JSON 源：每条目里热度字段的路径（热榜类源，可选） */
  heatPath?: (string | number)[]
  /** 最多保留条数 */
  limit?: number
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

export const NEWS_SOURCES: NewsSource[] = [
  /* ================= AI 新闻（RSS，中英双语分级） ================= */

  // —— 中文源：产业与国内视角 ——
  {
    id: 'qbitai',
    name: '量子位',
    category: 'ai',
    kind: 'rss',
    url: 'https://www.qbitai.com/feed',
    headers: { 'User-Agent': UA },
    lang: 'zh',
    focus: ['ai-coding', 'embodied', 'foundation'],
    notes: 'AI 与具身智能主阵地，选题偏前沿',
    limit: 10,
  },
  {
    id: '36kr',
    name: '36氪',
    category: 'ai',
    kind: 'rss',
    url: 'https://rsshub.app/36kr/newsflashes',
    headers: { 'User-Agent': UA },
    lang: 'zh',
    focus: ['foundation', 'safety'],
    notes: '科技快讯，覆盖融资/产业动态',
    limit: 10,
  },
  {
    id: 'ithome',
    name: 'IT之家',
    category: 'ai',
    kind: 'rss',
    url: 'https://www.ithome.com/rss/',
    headers: { 'User-Agent': UA },
    lang: 'zh',
    focus: ['ai-coding', 'foundation'],
    notes: '产品发布与工具动态',
    limit: 10,
  },
  {
    id: 'infoq',
    name: 'InfoQ',
    category: 'ai',
    kind: 'rss',
    url: 'https://www.infoq.cn/feed',
    headers: { 'User-Agent': UA },
    lang: 'zh',
    focus: ['ai-coding'],
    notes: '工程视角，侧重 AI 编程与架构',
    limit: 10,
  },

  // —— 英文源：技术细节与全球视角 ——
  {
    id: 'huggingface',
    name: 'Hugging Face',
    category: 'ai',
    kind: 'rss',
    url: 'https://huggingface.co/blog/feed.xml',
    headers: { 'User-Agent': UA },
    lang: 'en',
    focus: ['foundation', 'ai-coding'],
    notes: '开源模型与工具一手发布',
    limit: 10,
  },
  {
    id: 'theverge-ai',
    name: 'The Verge AI',
    category: 'ai',
    kind: 'rss',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    headers: { 'User-Agent': UA },
    lang: 'en',
    focus: ['foundation', 'safety'],
    notes: '全球 AI 产品与治理动态',
    limit: 10,
  },
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    category: 'ai',
    kind: 'rss',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    headers: { 'User-Agent': UA },
    lang: 'en',
    focus: ['foundation', 'embodied'],
    notes: 'AI 创业与融资',
    limit: 10,
  },
  {
    id: 'openai',
    name: 'OpenAI News',
    category: 'ai',
    kind: 'rss',
    url: 'https://openai.com/news/rss.xml',
    headers: { 'User-Agent': UA },
    lang: 'en',
    focus: ['foundation', 'ai-coding'],
    notes: 'OpenAI 官方发布（厂商口径，配合独立源交叉验证）',
    limit: 10,
  },

  /* ================= 社会热点（JSON 热榜） ================= */
  {
    id: 'weibo',
    name: '微博热搜',
    category: 'hot',
    kind: 'json',
    url: 'https://weibo.com/ajax/side/hotSearch',
    headers: { Referer: 'https://weibo.com/', 'User-Agent': UA },
    lang: 'zh',
    itemPath: ['data', 'realtime'],
    titlePath: ['word'],
    limit: 15,
  },
  {
    id: 'baidu',
    name: '百度热搜',
    category: 'hot',
    kind: 'json',
    url: 'https://top.baidu.com/api/board?platform=wise&tab=realtime',
    headers: { Referer: 'https://top.baidu.com/', 'User-Agent': UA },
    lang: 'zh',
    itemPath: ['data', 'cards', 0, 'content', 0, 'content'],
    titlePath: ['word'],
    urlPath: ['url'],
    limit: 15,
  },

  /* ================= 今日头条（JSON 热榜，带热度值） ================= */
  {
    id: 'toutiao',
    name: '今日头条',
    category: 'toutiao',
    kind: 'json',
    url: 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc',
    headers: { Referer: 'https://www.toutiao.com/', 'User-Agent': UA },
    lang: 'zh',
    itemPath: ['data'],
    titlePath: ['Title'],
    urlPath: ['Url'],
    heatPath: ['HotValue'],
    limit: 20,
  },
]

/** 启用的源（fetchCategory 只抓 enabled !== false 的） */
export function enabledSources(category: NewsCategory): NewsSource[] {
  return NEWS_SOURCES.filter((s) => s.category === category && s.enabled !== false)
}
