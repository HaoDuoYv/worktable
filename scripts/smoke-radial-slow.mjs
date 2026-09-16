import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('screenshots', { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('worktable.theme', 'dark'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(400)

const btn = page.getByRole('button', { name: '切换到明亮主题' })
const box = await btn.boundingBox()

await btn.click({ position: { x: box.width / 2, y: box.height / 2 } })

// sample data-r every 80ms
const samples = []
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(80)
  const s = await page.evaluate(() => {
    const el = document.querySelector('.theme-clone-overlay')
    if (!el) return null
    return {
      r: Number(el.getAttribute('data-r') || '0'),
      mask: (el.style.maskImage || el.style.webkitMaskImage || '').slice(0, 90),
      theme: document.documentElement.dataset.theme,
    }
  })
  samples.push(s)
  if (i === 2) await page.screenshot({ path: 'screenshots/radial-mid-a.png' })
  if (i === 5) await page.screenshot({ path: 'screenshots/radial-mid-b.png' })
}

await page.screenshot({ path: 'screenshots/radial-end.png' })
console.log('samples', JSON.stringify(samples, null, 0))

const radii = samples.filter(Boolean).map((s) => s.r)
const growing = radii.length >= 3 && radii[radii.length - 1] > radii[0]
const finalTheme = await page.evaluate(() => document.documentElement.dataset.theme)
console.log('radii', radii, 'growing', growing, 'final', finalTheme)

if (finalTheme !== 'light' || !growing) {
  console.error('radial still not visible')
  process.exit(1)
}
await browser.close()
console.log('radial visible OK')
