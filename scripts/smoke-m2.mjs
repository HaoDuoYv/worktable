import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('screenshots', { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })

// Library
await page.goto('http://localhost:5173/tutorials', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const cardTitle = await page.locator('.panel__title').first().textContent()
console.log('library first card:', cardTitle?.trim())
await page.screenshot({ path: 'screenshots/m2-library.png', fullPage: true })

// Enter player
await page.getByRole('button', { name: '继续学习' }).click()
await page.waitForURL(/\/tutorials\/uring-redis/)
await page.waitForTimeout(500)
const stepTitle = await page.locator('.step-item.is-current .step-item__t').textContent()
console.log('player step:', stepTitle?.trim())
await page.screenshot({ path: 'screenshots/m2-player-step1.png' })

// Go next via stepper
await page.getByRole('button', { name: '下一步' }).click()
await page.waitForTimeout(400)
const step2 = await page.locator('.step-item.is-current .step-item__t').textContent()
console.log('after next:', step2?.trim())

// Open a changed file
const fileBtn = page.locator('.file-tag:not(.muted)').first()
if (await fileBtn.count()) {
  await fileBtn.click()
  await page.waitForTimeout(300)
  const fileHead = await page.locator('.file-view__head span').first().textContent()
  console.log('file view:', fileHead?.trim())
  await page.screenshot({ path: 'screenshots/m2-player-file.png' })
  await page.getByRole('button', { name: '关闭' }).click()
}

// Note
const noteBox = page.locator('.notes-input')
await noteBox.fill('M2 备注冒烟：TCP 三次握手与 backlog')
await page.waitForTimeout(700)
const noteMeta = await page.locator('.notes-meta').textContent()
console.log('note meta:', noteMeta?.trim())

// Reload and verify progress + note
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const restoredStep = await page.locator('.step-item.is-current .step-item__t').textContent()
const restoredNote = await page.locator('.notes-input').inputValue()
console.log('restored step:', restoredStep?.trim())
console.log('restored note:', restoredNote)
await page.screenshot({ path: 'screenshots/m2-player-restored.png' })

// Diff visible
const diffFiles = await page.locator('.diff-file summary').count()
console.log('diff file sections:', diffFiles)

await browser.close()

const ok =
  (cardTitle ?? '').includes('uRedis') &&
  restoredNote.includes('M2 备注冒烟') &&
  (restoredStep ?? '').includes('步骤 2')
if (!ok) {
  console.error('M2 smoke FAILED')
  process.exit(1)
}
console.log('M2 smoke OK')
