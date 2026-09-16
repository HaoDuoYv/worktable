import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('screenshots', { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)

const theme0 = await page.evaluate(() => document.documentElement.dataset.theme)
console.log('initial theme', theme0)
await page.screenshot({ path: 'screenshots/theme-dark.png', fullPage: true })

await page.getByRole('button', { name: '切换到明亮主题' }).click()
await page.waitForTimeout(500)
const theme1 = await page.evaluate(() => document.documentElement.dataset.theme)
console.log('after toggle', theme1)
await page.screenshot({ path: 'screenshots/theme-light.png', fullPage: true })

if (theme1 !== 'light') {
  console.error('light theme not applied')
  process.exit(1)
}

// cycle mode button
await page.getByRole('button', { name: /主题模式/ }).click()
await page.waitForTimeout(200)
const modeLabel = await page.locator('.theme-toggle__cycle').textContent()
console.log('mode label', modeLabel)

// tutorials light
await page.goto('http://localhost:5173/tutorials/uring-redis', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const theme2 = await page.evaluate(() => document.documentElement.dataset.theme)
console.log('tutorial theme', theme2)
await page.screenshot({ path: 'screenshots/theme-light-tutorial.png' })

// algorithms light
await page.goto('http://localhost:5173/algorithms', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.screenshot({ path: 'screenshots/theme-light-algo.png' })

// persist
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const theme3 = await page.evaluate(() => document.documentElement.dataset.theme)
console.log('after reload', theme3)
if (theme3 !== 'light') {
  console.error('theme not persisted')
  process.exit(1)
}

// skip link
const skip = await page.locator('.skip-link').count()
console.log('skip link', skip > 0)

await browser.close()
console.log('theme smoke OK')
