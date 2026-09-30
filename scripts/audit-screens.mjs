// UI/UX 审计截图：桌面 1440x900 + 移动 390x844 全页面
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const PAGES = [
  ['/', 'overview'],
  ['/news', 'news'],
  ['/tutorials', 'tutorials'],
  ['/algorithms', 'algorithms'],
  ['/ai', 'ai'],
  ['/settings', 'settings'],
]

mkdirSync('screenshots/audit', { recursive: true })

const browser = await chromium.launch()

async function shoot(viewport, tag) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  for (const [path, name] of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2200)
    await page.screenshot({ path: `screenshots/audit/${tag}-${name}.png`, fullPage: true })
    const overflow = await page.evaluate(() => {
      const d = document.documentElement
      return { w: d.scrollWidth, c: d.clientWidth, h: d.scrollHeight }
    })
    console.log(`${tag}-${name}: overflow=${overflow.w > overflow.c + 2} (${overflow.w}/${overflow.c}) pageH=${overflow.h}`)
  }
  await ctx.close()
}

await shoot({ width: 1440, height: 900 }, 'desktop')
await shoot({ width: 390, height: 844 }, 'mobile')

await browser.close()
console.log('audit done')
