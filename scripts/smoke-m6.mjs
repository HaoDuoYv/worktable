import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'

mkdirSync('screenshots', { recursive: true })

// start cpp server if possible
const cpp = spawn('node', ['server-cpp/index.mjs'], {
  cwd: 'E:/study/gitproject/worktable',
  stdio: 'pipe',
})
cpp.stdout.on('data', (d) => process.stdout.write('[cpp] ' + d))
cpp.stderr.on('data', (d) => process.stderr.write('[cpp-err] ' + d))

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))

await page.goto('http://localhost:5173/algorithms', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// JS still works
await page.getByRole('radio', { name: 'JavaScript' }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: '运行' }).click()
await page.waitForTimeout(2000)
const jsCells = await page.locator('.viz-array1d .viz-cell').count()
console.log('js cells', jsCells)

// Python
await page.getByRole('radio', { name: 'Python' }).click()
await page.waitForTimeout(500)
const pyTitle = await page.locator('.algo-item__title').first().textContent()
console.log('python list first', pyTitle?.trim())
await page.getByRole('button', { name: '运行' }).click()
// pyodide download can take a while
await page.waitForTimeout(25000)
const err = await page.locator('.algo-lab__error').textContent().catch(() => null)
const pyCells = await page.locator('.viz-array1d .viz-cell').count()
console.log('python cells', pyCells, 'error', err)
await page.screenshot({ path: 'screenshots/m6-python.png' })
if (pyCells < 1) {
  console.error('python visualization failed')
  // don't exit yet - check cpp
}

// C++
await page.getByRole('radio', { name: 'C++' }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: '运行' }).click()
await page.waitForTimeout(4000)
const cppErr = await page.locator('.algo-lab__error').textContent().catch(() => null)
const cppCells = await page.locator('.viz-array1d .viz-cell').count()
console.log('cpp cells', cppCells, 'error', (cppErr ?? '').slice(0, 120))
await page.screenshot({ path: 'screenshots/m6-cpp.png' })

await browser.close()
cpp.kill()

if (pyCells < 1 && cppCells < 1) {
  console.error('M6 smoke FAILED (neither python nor cpp produced cells)')
  process.exit(1)
}
console.log('M6 smoke OK')
