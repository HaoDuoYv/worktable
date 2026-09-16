import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:4173/algorithms', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(1200)

// language filter: JavaScript
const jsChip = page.getByRole('radio', { name: 'JavaScript' }).or(page.getByRole('button', { name: 'JavaScript' }))
if (await jsChip.count()) {
  await jsChip.first().click()
  await page.waitForTimeout(400)
}

// click bubble sort list item
const bubble = page.locator('.algo-item__title', { hasText: '冒泡' }).first()
if (await bubble.count()) {
  await bubble.click()
} else {
  await page.locator('.algo-item__main').first().click()
}
await page.waitForTimeout(500)

const title = await page.locator('.algo-title-input').inputValue().catch(() => '')
console.log('TITLE', title)

await page.getByRole('button', { name: '运行' }).click()
await page.waitForTimeout(4000)

const error = await page.locator('.algo-lab__error').textContent().catch(() => null)
const canvasText = await page.locator('.algo-lab__canvas').innerText().catch(() => '')
const tracerCount = await page.locator('.algo-lab__canvas svg').count()
console.log('ERROR:', error)
console.log('CANVAS:', canvasText.slice(0, 200))
console.log('SVG_COUNT:', tracerCount)
await page.screenshot({ path: 'screenshots/js-run-fixed.png' })
await browser.close()
if (error) process.exit(1)
