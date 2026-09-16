import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('screenshots', { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

const pages = [
  ['http://localhost:5173/', 'overview'],
  ['http://localhost:5173/tutorials', 'tutorials'],
  ['http://localhost:5173/algorithms', 'algorithms'],
  ['http://localhost:5173/ai', 'ai'],
  ['http://localhost:5173/settings', 'settings'],
]

for (const [url, name] of pages) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(250)
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true })
  const title = await page.locator('.app-shell__header-title').textContent()
  const navActive = await page.locator('.app-shell__nav-link.is-active').textContent()
  console.log(`${name}: title=${title?.trim()} nav=${navActive?.trim()}`)
}

await page.goto('http://localhost:5173/algorithms', { waitUntil: 'networkidle' })
await page.getByRole('radio', { name: 'Python' }).click()
const selected = await page.getByRole('radio', { name: 'Python' }).getAttribute('aria-checked')
console.log('python chip selected:', selected)

await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' })
const disclosure = page.locator('.disclosure__trigger').first()
const wasOpen = await page.locator('.disclosure').first().evaluate((el) => el.classList.contains('is-open'))
await disclosure.click()
await page.waitForTimeout(350)
const nowOpen = await page.locator('.disclosure').first().evaluate((el) => el.classList.contains('is-open'))
console.log('disclosure toggle:', wasOpen, '->', nowOpen)

await page.getByRole('button', { name: '下一步' }).click()
await page.waitForTimeout(200)
const meta = await page.locator('.stepper__meta span').first().textContent()
console.log('stepper meta:', meta?.trim())

await browser.close()
