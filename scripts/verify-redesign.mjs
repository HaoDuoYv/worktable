// 改版验证：hero 数据加载后截图 + 断言
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const browser = await chromium.launch()

async function check(tag, viewport) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })

  let hotRows = 0
  try {
    await page.waitForSelector('.ov-hotlist__row', { timeout: 45000 })
    hotRows = await page.locator('.ov-hotlist__row').count()
  } catch {
    /* 热榜可能仍为空 */
  }
  await page.waitForTimeout(1500)

  const r = await page.evaluate(() => {
    const hero = document.querySelector('.ov-hero')
    const temp = document.querySelector('.ov-hero__temp')
    const statRow = document.querySelector('.stat-row')
    const grid = document.querySelector('.ov-grid')
    const order = hero && statRow && grid
      ? [hero, statRow, grid].map((el) => el.getBoundingClientRect().top)
      : null
    return {
      heroVisible: !!hero,
      tempText: temp?.textContent ?? null,
      orderOk: order ? order[0] < order[1] && order[1] < order[2] : false,
      docW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      animCount: document.getAnimations().length,
    }
  })

  console.log(
    `${tag}: hero=${r.heroVisible} temp=${r.tempText} 热榜行=${hotRows} hero>统计>内容=${r.orderOk} 溢出=${r.docW > r.clientW + 2} 活跃动画=${r.animCount} JS错误=${errors.length ? errors[0] : '无'}`,
  )
  await page.screenshot({ path: `screenshots/audit/redesign-${tag}-overview.png`, fullPage: true })

  // 新闻页截图（列表 stagger）
  await page.goto(BASE + '/news', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `screenshots/audit/redesign-${tag}-news.png`, fullPage: true })
  await ctx.close()
}

await check('desktop', { width: 1440, height: 900 })
await check('mobile', { width: 390, height: 844 })
await browser.close()
console.log('redesign check done')
