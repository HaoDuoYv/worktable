import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('screenshots', { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

// Settings AI panel
await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const hasBase = await page.getByPlaceholder('https://api.deepseek.com/v1').count()
console.log('ai base url field', hasBase > 0)
await page.getByPlaceholder('sk-...').fill('test-key-not-real')
await page.getByPlaceholder('deepseek-chat').fill('deepseek-chat')
await page.getByRole('button', { name: '保存 AI 配置' }).click()
await page.waitForTimeout(200)
const status = await page.locator('[role="status"]').textContent()
console.log('save status', status)
await page.screenshot({ path: 'screenshots/m5-ai-settings.png' })

// AI page empty -> after config should show chat UI
await page.goto('http://localhost:5173/ai', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const emptyOrChat =
  (await page.getByText('开始提问').count()) > 0 || (await page.locator('.ai-page').count()) > 0
console.log('ai page shell', emptyOrChat)
await page.getByRole('button', { name: '新对话' }).first().click()
await page.waitForTimeout(200)
await page.locator('.ai-page__composer textarea').fill('你好，请只回复 pong')
// send will fail without real API - just ensure UI updates
await page.getByRole('button', { name: '发送' }).click()
await page.waitForTimeout(1500)
const errorVisible = await page.locator('.algo-lab__error').count()
const bubble = await page.locator('.ai-bubble--user').count()
console.log('after send user bubbles', bubble, 'error shown', errorVisible > 0)
await page.screenshot({ path: 'screenshots/m5-ai-chat.png' })

// Tutorial deep link injects context
await page.goto('http://localhost:5173/ai?tutorial=uring-redis&step=1', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const inject = await page.locator('.ai-page__inject').textContent().catch(() => '')
console.log('inject preview', (inject ?? '').slice(0, 60))
if (!(inject ?? '').includes('uRedis') && !(inject ?? '').includes('步骤')) {
  console.error('tutorial context not injected')
  process.exit(1)
}

// Algorithms AI buttons
await page.goto('http://localhost:5173/algorithms', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const hasVizAi = await page.getByRole('button', { name: 'AI 可视化' }).count()
const hasAskAi = await page.getByRole('button', { name: '问 AI' }).count()
console.log('algo AI buttons', hasAskAi, hasVizAi)
if (!hasVizAi || !hasAskAi) {
  console.error('missing AI buttons on algorithms')
  process.exit(1)
}
await page.getByRole('button', { name: 'AI 可视化' }).click()
await page.waitForTimeout(1000)
const url = page.url()
console.log('nav url', url)
if (!url.includes('/ai?algorithm=')) {
  console.error('did not navigate to AI with algorithm context')
  process.exit(1)
}

await browser.close()
console.log('M5 smoke OK')
