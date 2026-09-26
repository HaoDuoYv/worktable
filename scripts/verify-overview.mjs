/* 冒烟验证：主页 / 新闻页 / 设置页 重设计渲染 + 头条源抓取 */
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'

const results = []
function check(name, ok, extra = '') {
  results.push({ name, ok, extra })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
const badResponses = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
// 记录 4xx/5xx 响应的 URL，用于区分「预期内的源失败」与真错误
page.on('response', (r) => {
  if (r.status() >= 500) badResponses.push(`${r.status()} ${r.url()}`)
})

// —— 1. 头条源抓取（通过 vite 代理）——
const resp = await page.request.post(`${BASE}/news/proxy`, {
  data: {
    url: 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc',
    headers: { Referer: 'https://www.toutiao.com/' },
  },
  timeout: 15000,
})
const body = await resp.text()
let ttCount = 0
try {
  const j = JSON.parse(body)
  ttCount = (j.data || []).length
} catch { /* keep 0 */ }
check('头条 hot-board 代理可抓取', resp.ok() && ttCount > 10, `条数=${ttCount}`)
if (ttCount > 0) {
  const j = JSON.parse(body)
  console.log('  示例:', j.data.slice(0, 2).map((x) => `${x.Title}(${x.HotValue})`).join(' / '))
}

// —— 2. 主页面板 ——
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
// 等待新闻生成完成（头条行出现即生成完毕；最多 40s）
await page.waitForSelector('.ov-hotlist__row', { timeout: 40000 }).catch(() => null)
await page.waitForTimeout(1000)

check('主页：问候行渲染', (await page.locator('.ov-head__title').count()) > 0)
check('主页：4 个统计块', (await page.locator('.stat-tile').count()) === 4)
check('主页：当日天气卡', (await page.locator('.ov-rail .ov-card').count()) >= 2)
const weatherText = await page.locator('.ov-weather__temp').textContent().catch(() => null)
check('主页：天气温度已获取', /\d+°C/.test(weatherText ?? ''), weatherText ?? '无')
const hotRows = await page.locator('.ov-hotlist__row').count()
check('主页：今日头条热榜条目', hotRows >= 3, `${hotRows} 条`)
const heats = await page.locator('.ov-hotlist__heat').allTextContents()
check('主页：热度值展示', heats.some((h) => h.includes('万')), heats.slice(0, 3).join(','))
check('主页：AI 新闻速览或提示', (await page.locator('.ov-digest__row, .ov-card .ov-muted').count()) > 0)

// —— 3. 新闻面板 ——
await page.goto(BASE + '/news', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.news-item', { timeout: 40000 }).catch(() => null)
await page.waitForTimeout(500)
const tabs = await page.locator('.news-tabs .chip').allTextContents()
check('新闻页：三个分类标签', tabs.length === 3 && tabs.some((t) => t.includes('今日头条')), tabs.join(' | '))
check('新闻页：右栏数据源状态卡', (await page.locator('.news-rail__source').count()) >= 5)
check('新闻页：今日概览统计', (await page.locator('.news-rail__stat').count()) === 3)

// 切到头条 tab
await page.locator('.news-tabs .chip', { hasText: '今日头条' }).click()
await page.waitForTimeout(600)
const ttRows = await page.locator('.news-item__rank').count()
check('新闻页：头条 tab 排名列表', ttRows >= 5, `${ttRows} 条`)

// —— 4. 设置面板 ——
await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
const navItems = await page.locator('.settings-nav__item').allTextContents()
check('设置页：6 个分组导航', navItems.length === 6, navItems.join('/'))
check('设置页：默认显示 AI 接口组', (await page.locator('.settings-content .panel').count()) > 0)
await page.locator('.settings-nav__item', { hasText: '界面偏好' }).click()
await page.waitForTimeout(400)
check('设置页：天气城市输入框（默认北京市）', (await page.locator('.settings-field__input').inputValue()) === '北京市')
check('设置页：自动定位开关', (await page.locator('.settings-weather .switch').count()) === 1)

check('无页面 JS 异常', errors.filter((e) => !e.includes('502')).length === 0, errors.slice(0, 2).join(' ; '))
check(
  '5xx 仅来自抓取代理（源失败属预期）',
  badResponses.every((u) => u.includes('/news/proxy')),
  badResponses.slice(0, 2).join(' ; '),
)

const passed = results.filter((r) => r.ok).length
console.log(`\n${passed}/${results.length} 通过`)
await page.screenshot({ path: 'screenshots/overview-v2.png', fullPage: false })
await browser.close()
process.exit(passed === results.length ? 0 : 1)
