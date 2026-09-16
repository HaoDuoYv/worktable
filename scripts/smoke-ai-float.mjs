import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('screenshots', { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

await page.goto('http://localhost:5173/tutorials/uring-redis', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.getByRole('button', { name: '问 AI' }).click()
await page.waitForTimeout(300)

const win = page.locator('.ai-float')
if ((await win.count()) < 1) {
  console.error('float missing')
  process.exit(1)
}
const box0 = await win.boundingBox()
console.log('float at', box0)

// drag by header
const head = page.locator('.ai-float__head')
const hb = await head.boundingBox()
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
await page.mouse.down()
await page.mouse.move(hb.x + 80, hb.y + 120, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(200)
const box1 = await win.boundingBox()
console.log('after drag', box1)
if (Math.abs(box1.x - box0.x) < 20 && Math.abs(box1.y - box0.y) < 20) {
  console.error('drag did not move window')
  process.exit(1)
}

// minimize
await page.getByRole('button', { name: '最小化' }).click()
await page.waitForTimeout(200)
const min = await page.locator('.ai-float.is-min').count()
const msgs = await page.locator('.ai-float__messages').count()
console.log('minimized', min, 'messages hidden', msgs === 0)

await page.screenshot({ path: 'screenshots/ai-float.png' })
await browser.close()
console.log('ai float OK')
