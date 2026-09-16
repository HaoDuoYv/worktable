import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('screenshots', { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

await page.goto('http://localhost:5173/algorithms', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

const listCount = await page.locator('.algo-item__main').count()
console.log('list count', listCount)
if (listCount < 4) {
  console.error('expected seeded builtins')
  process.exit(1)
}

// New algorithm
await page.getByRole('button', { name: '新建', exact: true }).click()
await page.waitForTimeout(400)
const title = page.locator('.algo-title-input')
await title.fill('我的测试算法')
await page.getByRole('button', { name: '保存', exact: true }).click()
await page.waitForTimeout(400)
const toast = await page.locator('.algo-toast').textContent().catch(() => null)
console.log('save toast', toast)

// Favorite
await page.getByRole('button', { name: '收藏', exact: true }).click()
await page.waitForTimeout(300)
await page.getByRole('radio', { name: '收藏' }).click()
await page.waitForTimeout(200)
const favCount = await page.locator('.algo-item__main').count()
console.log('favorite filter count', favCount)
if (favCount < 1) {
  console.error('favorite filter empty')
  process.exit(1)
}

// Search
await page.getByRole('radio', { name: '全部', exact: true }).click()
await page.locator('.algo-search').fill('冒泡')
await page.waitForTimeout(200)
const searchCount = await page.locator('.algo-item__main').count()
console.log('search 冒泡', searchCount)
if (searchCount < 1) {
  console.error('search failed')
  process.exit(1)
}
await page.locator('.algo-search').fill('')

// Save as
await page.locator('.algo-search').fill('我的测试算法')
await page.waitForTimeout(200)
await page.locator('.algo-item__main').first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '另存为' }).click()
await page.waitForTimeout(300)
const titleVal = await title.inputValue()
console.log('after save-as title', titleVal)

// Delete copy
await page.locator('.algo-item__del').first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '删除', exact: true }).click()
await page.waitForTimeout(300)

await page.screenshot({ path: 'screenshots/m4-algo-library.png' })
await browser.close()
console.log('M4 smoke OK')
