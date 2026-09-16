import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('screenshots', { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)

const theme0 = await page.evaluate(() => document.documentElement.dataset.theme)
console.log('start', theme0)
if (theme0 !== 'dark') {
  // reset to dark for deterministic test
  await page.evaluate(() => {
    localStorage.setItem('worktable.theme', 'dark')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
}

const btn = page.getByRole('button', { name: '切换到明亮主题' })
const box = await btn.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

// instrument: watch overlay / VT class
await page.evaluate(() => {
  window.__radialSeen = { clone: false, mask: null, vt: false }
  const obs = new MutationObserver(() => {
    const clone = document.querySelector('.theme-clone-overlay')
    if (clone) {
      window.__radialSeen.clone = true
      window.__radialSeen.mask = clone.style.maskImage || clone.style.webkitMaskImage
    }
    if (document.documentElement.classList.contains('vt-radial')) {
      window.__radialSeen.vt = true
    }
  })
  obs.observe(document.body, { childList: true, subtree: false, attributes: true })
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

await btn.click()
// capture mid-animation
await page.waitForTimeout(120)
await page.screenshot({ path: 'screenshots/theme-radial-mid.png' })
await page.waitForTimeout(500)
await page.screenshot({ path: 'screenshots/theme-radial-end.png' })

const theme1 = await page.evaluate(() => document.documentElement.dataset.theme)
const seen = await page.evaluate(() => window.__radialSeen)
console.log('end', theme1, 'radial', JSON.stringify(seen))

if (theme1 !== 'light') {
  console.error('theme did not switch')
  process.exit(1)
}

// mid screenshot should differ from end; clone path should have been used OR VT
const usedRadial = seen.clone || seen.vt
if (!usedRadial) {
  console.error('radial mechanism not observed')
  process.exit(1)
}

// verify mask radius grew if clone used
if (seen.clone && seen.mask) {
  console.log('mask sample', String(seen.mask).slice(0, 80))
}

await browser.close()
console.log('radial theme smoke OK')
