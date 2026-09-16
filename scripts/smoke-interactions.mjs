import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('screenshots', { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

// Settings switches + ripple
await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const switches = page.locator('.switch')
const swCount = await switches.count()
console.log('switches', swCount)
if (swCount < 3) {
  console.error('expected switch group')
  process.exit(1)
}
const firstChecked = await switches.nth(0).getAttribute('aria-checked')
await switches.nth(0).click()
await page.waitForTimeout(100)
const firstChecked2 = await switches.nth(0).getAttribute('aria-checked')
const secondChecked = await switches.nth(1).getAttribute('aria-checked')
const hadRipple = await page.locator('.switch.is-ripple').count()
console.log('toggle', firstChecked, '->', firstChecked2, 'neighbor unchanged', secondChecked, 'ripple els', hadRipple)
if (firstChecked === firstChecked2) {
  console.error('source switch did not toggle')
  process.exit(1)
}
await page.screenshot({ path: 'screenshots/ix-settings-switches.png' })

// Stepper spring
const next = page.getByRole('button', { name: '下一步' })
await next.click()
await page.waitForTimeout(80)
const bump = await page.locator('.stepper__seg.is-bumping').count()
console.log('stepper bump class', bump)
await page.screenshot({ path: 'screenshots/ix-stepper.png' })

// Chip expanding
await page.goto('http://localhost:5173/algorithms', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const pythonChip = page.getByRole('radio', { name: 'Python' })
await pythonChip.click()
await page.waitForTimeout(250)
const selected = await pythonChip.getAttribute('aria-checked')
const hasScale = await pythonChip.evaluate((el) => el.classList.contains('chip--selected'))
console.log('chip selected', selected, hasScale)

// Bulk select + staggered
await page.getByRole('button', { name: '多选', exact: true }).click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '全选' }).click()
await page.waitForTimeout(400)
const checkedBoxes = await page.locator('.bulk-check.is-checked').count()
console.log('bulk checked', checkedBoxes)
await page.screenshot({ path: 'screenshots/ix-bulk.png' })

// Curved delete (confirm one item)
await page.getByRole('button', { name: '退出多选' }).click()
await page.waitForTimeout(200)
const delBtn = page.locator('.algo-item__del').first()
await delBtn.click()
await page.waitForTimeout(150)
await page.getByRole('button', { name: '删除', exact: true }).first().click()
await page.waitForTimeout(150)
const exiting = await page.locator('.algo-item.is-exiting').count()
console.log('exiting cards', exiting)
await page.waitForTimeout(350)
await page.screenshot({ path: 'screenshots/ix-delete.png' })

await browser.close()
console.log('interaction smoke OK')
