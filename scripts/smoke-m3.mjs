import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('screenshots', { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

page.on('pageerror', (err) => console.error('PAGEERROR', err.message))
page.on('console', (msg) => {
  console.log('BROWSER', msg.type(), msg.text())
})

await page.goto('http://localhost:5173/algorithms', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

const placeholder = await page.locator('.viz-placeholder').textContent()
console.log('placeholder:', placeholder?.trim().slice(0, 40))
await page.screenshot({ path: 'screenshots/m3-lab-idle.png' })

// Run bubble sort
await page.getByRole('button', { name: '运行' }).click()
await page.waitForTimeout(2500)

const count = await page.locator('.player-bar__count').textContent()
console.log('player count:', count?.trim())
const cells = await page.locator('.viz-array1d .viz-cell').count()
console.log('array cells:', cells)
const logText = await page.locator('.viz-log').first().textContent()
console.log('log snippet:', (logText ?? '').trim().slice(0, 60))
await page.screenshot({ path: 'screenshots/m3-lab-running.png' })

// Pause and step
await page.getByRole('button', { name: '暂停' }).click().catch(() => {})
await page.waitForTimeout(200)
await page.getByRole('button', { name: '上一步' }).click()
await page.waitForTimeout(200)
const count2 = await page.locator('.player-bar__count').textContent()
console.log('after step back:', count2?.trim())

// Switch to BFS
await page.getByRole('button', { name: /图的 BFS/ }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: '运行' }).click()
await page.waitForTimeout(2500)
const graphNodes = await page.locator('.viz-node').count()
console.log('graph nodes:', graphNodes)
await page.screenshot({ path: 'screenshots/m3-lab-graph.png' })

// Editor active line present
const hasEditor = await page.locator('.cm-editor').count()
console.log('editor present:', hasEditor > 0)

await browser.close()

const ok = cells > 0 && graphNodes > 0 && (count ?? '').includes('/')
if (!ok) {
  console.error('M3 smoke FAILED')
  process.exit(1)
}
console.log('M3 smoke OK')
