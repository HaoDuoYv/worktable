// 验证 AI 新闻三层分类（topics.ts）在 UI 生效
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(BASE + '/news', { waitUntil: 'domcontentloaded' })

// 等待新闻生成（AI tab 默认），出现列表行即说明抓取完成
let rows = 0
try {
  await page.waitForSelector('.news-item', { timeout: 60000 })
  rows = await page.locator('.news-item').count()
} catch {
  console.log('新闻未在 60s 内生成')
}

await page.waitForTimeout(1500)

const stats = await page.evaluate(() => {
  const tags = [...document.querySelectorAll('.news-item__tag')].map((el) => el.textContent)
  const negatives = document.querySelectorAll('.news-item__flag.is-negative').length
  const signals = document.querySelectorAll('.news-item__flag.is-signal').length
  const topicSet = [...new Set(tags)]
  return { tagCount: tags.length, topics: topicSet, negatives, signals }
})

console.log(`新闻行=${rows} 主题标签=${stats.tagCount} 主题种类=${JSON.stringify(stats.topics)} 反面标记=${stats.negatives} 信号标记=${stats.signals} JS错误=${errors.length ? errors[0] : '无'}`)

// 主页 AI 速览卡标签
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)
const ov = await page.evaluate(() => {
  const tags = [...document.querySelectorAll('.ov-digest__tag')].map((el) => el.textContent)
  const flags = document.querySelectorAll('.ov-digest__flag').length
  return { tags, flags }
})
console.log(`概览 AI 速览标签=${JSON.stringify(ov.tags)} 反面=${ov.flags}`)

await page.screenshot({ path: 'screenshots/audit/redesign-news-tags.png', fullPage: true })
await browser.close()
console.log('done')
