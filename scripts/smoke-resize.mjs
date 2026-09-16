import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('screenshots', { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })

await page.goto('http://localhost:5173/tutorials/uring-redis', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

const getLeft = async () => {
  const box = await page.locator('.three-pane__left').boundingBox()
  return box?.width ?? -1
}
const getRight = async () => {
  const box = await page.locator('.three-pane__right').boundingBox()
  return box?.width ?? -1
}

const left0 = await getLeft()
const right0 = await getRight()
console.log('before', { left0, right0 })

const handles = page.locator('.three-pane > .resize-handle')
const handleCount = await handles.count()
console.log('handles', handleCount)

// drag left handle +80px
const h0 = handles.nth(0)
const hb = await h0.boundingBox()
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
await page.mouse.down()
await page.mouse.move(hb.x + 80, hb.y + hb.height / 2, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(150)

const left1 = await getLeft()
console.log('after left drag', left1)
if (left1 <= left0 + 40) {
  console.error('left resize failed')
  process.exit(1)
}

// drag right handle -100px (expand right pane)
const h1 = handles.nth(1)
const hb1 = await h1.boundingBox()
await page.mouse.move(hb1.x + hb1.width / 2, hb1.y + hb1.height / 2)
await page.mouse.down()
await page.mouse.move(hb1.x - 100, hb1.y + hb1.height / 2, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(150)

const right1 = await getRight()
console.log('after right drag', right1)
if (right1 <= right0 + 40) {
  console.error('right resize failed')
  process.exit(1)
}

// persist after reload
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const left2 = await getLeft()
const right2 = await getRight()
console.log('after reload', { left2, right2 })
if (Math.abs(left2 - left1) > 2 || Math.abs(right2 - right1) > 2) {
  console.error('persist failed')
  process.exit(1)
}

await page.screenshot({ path: 'screenshots/tutorial-resizable.png' })
await browser.close()
console.log('resize smoke OK')
