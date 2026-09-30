/* 移动端布局验证：底部 Tab / 单列 / 顶栏 AI·设置 / 我的页 */
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'

const results = []
function check(name, ok, extra = '') {
  results.push({ name, ok, extra })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
}

const browser = await chromium.launch()
// 移动端视口（iPhone 12/13 尺寸）
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const isVisible = (sel) =>
  page.locator(sel).first().evaluate((el) => {
    const s = getComputedStyle(el)
    return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().width > 0
  }).catch(() => false)

// —— 1. 概览页 ——
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.ov-head__title', { timeout: 30000 }).catch(() => null)
await page.waitForTimeout(800)

check('底部 Tab 栏可见', await isVisible('.app-shell__tabbar'))
check('底部 Tab 共 5 项', (await page.locator('.app-shell__tab').count()) === 5)
const tabLabels = await page.locator('.app-shell__tab-label').allTextContents()
check('Tab 顺序：概览/教程/算法/新闻/我的', tabLabels.join(',') === '概览,教程,算法,新闻,我的', tabLabels.join(','))
check('桌面侧栏已隐藏', !(await isVisible('.app-shell__nav')))
check('顶栏 AI + 设置按钮可见', (await page.locator('.app-shell__m-action').count()) === 2)
const ovCols = await page.locator('.ov-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns).catch(() => '')
check('概览：双栏折叠为单列', !ovCols.includes('360px') && ovCols.split(' ').length <= 2, ovCols)
check('概览：问候行渲染', (await page.locator('.ov-head__title').count()) > 0)
await page.screenshot({ path: 'screenshots/mobile-overview.png' })

// —— 2. 新闻页 ——
await page.goto(BASE + '/news', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
const newsCols = await page.locator('.news-page__body').evaluate((el) => getComputedStyle(el).gridTemplateColumns).catch(() => '')
check('新闻页：右栏折叠为单列', !newsCols.includes('300px'), newsCols)
check('新闻页：分类标签渲染', (await page.locator('.news-tabs .chip').count()) === 3)

// —— 3. 设置页 ——
await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
check('设置页：分组导航渲染', (await page.locator('.settings-nav__item').count()) === 6)
const settingsCols = await page.locator('.settings-layout').evaluate((el) => getComputedStyle(el).gridTemplateColumns).catch(() => '')
check('设置页：导航+正文折叠单列', !settingsCols.includes('200px'), settingsCols)

// —— 4. 我的页 ——
await page.goto(BASE + '/profile', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)
check('我的页：账号卡渲染', (await page.locator('.profile-card').count()) === 1)
check('我的页：玻璃液态开关渲染', (await page.locator('.profile-page .switch').count()) >= 1)
check('我的页：快捷入口行渲染', (await page.locator('.profile-row').count()) >= 4)
await page.screenshot({ path: 'screenshots/mobile-profile.png' })

// —— 5. 点击底部 Tab 切换 ——
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(500)
await page.locator('.app-shell__tab', { hasText: '新闻' }).click()
await page.waitForTimeout(600)
check('点击底部 Tab 可切换路由', page.url().includes('/news'), page.url())

check('无页面 JS 异常', errors.filter((e) => !e.includes('502')).length === 0, errors.slice(0, 2).join(' ; '))

const passed = results.filter((r) => r.ok).length
console.log(`\n${passed}/${results.length} 通过`)
await browser.close()
process.exit(passed === results.length ? 0 : 1)
