import { chromium } from 'playwright'

const base = 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

const errors = []
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) errors.push(name)
}

await page.goto(`${base}/news`, { waitUntil: 'domcontentloaded' })

// 1. 页面标题渲染
await page.waitForSelector('.news-page__head h1', { timeout: 10000 })
const h1 = await page.textContent('.news-page__head h1')
check('新闻页标题为「每日新闻」', h1?.includes('每日新闻'))

// 2. 两个分类 tab
await page.waitForSelector('.news-tabs', { timeout: 5000 })
const tabCount = await page.locator('.news-tabs .chip').count()
check('存在两个分类 tab（AI 新闻 / 社会热点）', tabCount === 2)

// 3. 等待抓取完成（新闻条目或错误态出现，最多 25s）
let itemCount = 0
try {
  await page.waitForSelector('.news-item, .empty-state', { timeout: 25000 })
  itemCount = await page.locator('.news-item').count()
} catch {
  /* 超时视为失败 */
}
check('抓取后出现新闻条目', itemCount > 0)

const status = await page.textContent('.news-status')
console.log('  状态徽标：', (status || '').trim())

// 4. 首页卡片
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.news-card', { timeout: 10000 })
const cardHas = await page.locator('.news-card').count()
check('首页存在「今日新闻」卡片', cardHas > 0)

// 截图存档
await page.goto(`${base}/news`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.news-item, .empty-state', { timeout: 25000 }).catch(() => {})
await page.screenshot({ path: 'screenshots/news-verify.png', fullPage: true })
await page.locator('.news-tabs .chip').nth(1).click().catch(() => {})
await page.screenshot({ path: 'screenshots/news-verify-hot.png', fullPage: true })

console.log('\n结果：', errors.length === 0 ? '全部通过' : `失败 ${errors.length} 项：${errors.join('、')}`)
await browser.close()
process.exit(errors.length === 0 ? 0 : 1)
