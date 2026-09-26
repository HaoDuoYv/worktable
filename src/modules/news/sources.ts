import type { NewsCategory } from './types'

/**
 * 新闻数据源定义。
 * 后续想加/删源，直接改这个数组即可，抓取逻辑无需变动。
 *
 * kind:
 *  - 'rss'  : 抓回 XML，用轻量正则提取 <item> 的 <title>/<link>
 *  - 'json' : 抓回 JSON，用 itemPath 定位条目数组、titlePath/urlPath 定位字段
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
  // —— AI 新闻（RSS）——
  {
    id: '36kr',
    name: '36氪',
    category: 'ai',
    kind: 'rss',
    url: 'https://rsshub.app/36kr/newsflashes',
    headers: { 'User-Agent': UA },
    limit: 10,
  },
  {
    id: 'ithome',
    name: 'IT之家',
    category: 'ai',
    kind: 'rss',
    url: 'https://www.ithome.com/rss/',
    headers: { 'User-Agent': UA },
    limit: 10,
  },
  {
    id: 'qbitai',
    name: '量子位',
    category: 'ai',
    kind: 'rss',
    url: 'https://www.qbitai.com/feed',
    headers: { 'User-Agent': UA },
    limit: 10,
  },
  {
    id: 'infoq',
    name: 'InfoQ',
    category: 'ai',
    kind: 'rss',
    url: 'https://www.infoq.cn/feed',
    headers: { 'User-Agent': UA },
    limit: 10,
  },

  // —— 社会热点（JSON 热榜）——
  {
    id: 'weibo',
    name: '微博热搜',
    category: 'hot',
    kind: 'json',
    url: 'https://weibo.com/ajax/side/hotSearch',
    headers: { Referer: 'https://weibo.com/', 'User-Agent': UA },
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
    itemPath: ['data', 'cards', 0, 'content', 0, 'content'],
    titlePath: ['word'],
    urlPath: ['url'],
    limit: 15,
  },

  // —— 今日头条（JSON 热榜，带热度值）——
  {
    id: 'toutiao',
    name: '今日头条',
    category: 'toutiao',
    kind: 'json',
    url: 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc',
    headers: { Referer: 'https://www.toutiao.com/', 'User-Agent': UA },
    itemPath: ['data'],
    titlePath: ['Title'],
    urlPath: ['Url'],
    heatPath: ['HotValue'],
    limit: 20,
  },
]
