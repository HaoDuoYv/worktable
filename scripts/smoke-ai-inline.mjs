import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('screenshots', { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

// Tutorial inline AI
await page.goto('http://localhost:5173/tutorials/uring-redis', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.getByRole('button', { name: '问 AI' }).click()
await page.waitForTimeout(300)
const drawer = await page.locator('.inline-ai').count()
const url1 = page.url()
console.log('tutorial drawer', drawer, 'url', url1)
if (url1.includes('/ai?')) {
  console.error('should NOT navigate')
  process.exit(1)
}
if (drawer < 1) {
  console.error('inline drawer missing')
  process.exit(1)
}
await page.screenshot({ path: 'screenshots/ai-inline-tutorial.png' })
await page.getByRole('button', { name: '关闭' }).click()
await page.waitForTimeout(200)

// Algorithms: mode switch + inline AI + silent viz button
await page.goto('http://localhost:5173/algorithms', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const hasSource = await page.getByRole('radio', { name: '源码' }).count()
const hasViz = await page.getByRole('radio', { name: '可视化代码' }).count()
console.log('mode chips', hasSource, hasViz)
if (!hasSource || !hasViz) {
  console.error('missing mode switch')
  process.exit(1)
}

// switch to source
await page.getByRole('radio', { name: '源码' }).click()
await page.waitForTimeout(300)
const hint = await page.locator('.algo-lab__mode-bar').textContent()
console.log('hint', hint?.trim())
await page.screenshot({ path: 'screenshots/algo-source-mode.png' })

// switch back to viz
await page.getByRole('radio', { name: '可视化代码' }).click()
await page.waitForTimeout(300)

// ask AI inline
await page.getByRole('button', { name: '问 AI' }).click()
await page.waitForTimeout(300)
const algoDrawer = await page.locator('.inline-ai').count()
const url2 = page.url()
console.log('algo drawer', algoDrawer, 'url', url2)
if (url2.includes('/ai?')) {
  console.error('algo should not navigate')
  process.exit(1)
}
await page.screenshot({ path: 'screenshots/ai-inline-algo.png' })

// AI visualize silent - without key will show error in page, not navigate
await page.getByRole('button', { name: '关闭' }).click()
await page.waitForTimeout(150)
await page.getByRole('button', { name: 'AI 可视化' }).click()
await page.waitForTimeout(800)
const url3 = page.url()
const err = await page.locator('.algo-lab__error').textContent().catch(() => null)
console.log('silent viz url', url3, 'err', (err ?? '').slice(0, 60))
if (url3.includes('/ai?')) {
  console.error('silent viz should not navigate')
  process.exit(1)
}

await browser.close()
console.log('AI UX smoke OK')
