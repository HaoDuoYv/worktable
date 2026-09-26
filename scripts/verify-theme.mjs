/* 冒烟验证：主题色预设 / 玻璃液态 / 自定义主题导入校验 / 持久化 / 恢复默认 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = 'http://localhost:5173'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const results = []
function check(name, ok, extra = '') {
  results.push({ name, ok, extra })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
}

// 非法主题 fixture：缺 meta.name 且含非法颜色
const badThemePath = join(ROOT, 'scripts', '.tmp-bad.theme.json')
writeFileSync(
  badThemePath,
  JSON.stringify({ meta: {}, base: 'dark', colors: { accent: 'not-a-color' } }),
)
// 告警主题 fixture：合法但 radius 超范围（应自动修正为 warning）
const warnThemePath = join(ROOT, 'scripts', '.tmp-warn.theme.json')
writeFileSync(
  warnThemePath,
  JSON.stringify({ meta: { name: '测试告警' }, base: 'dark', radius: 99, colors: { accent: '#ff0000' } }),
)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

// 清空主题偏好，从干净状态开始
await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => localStorage.removeItem('worktable.theme.prefs'))
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)

// 进入界面偏好分组
await page.locator('.settings-nav__item', { hasText: '界面偏好' }).click()
await page.waitForTimeout(400)

// —— 1. 主题色预设 ——
const presetBtns = await page.locator('.theme-preset').count()
check('主题色预设：5 个按钮', presetBtns === 5, `${presetBtns} 个`)

const rootVar = (name) => page.evaluate((n) => document.documentElement.style.getPropertyValue(n).trim(), name)
const before = await rootVar('--accent')
await page.locator('.theme-preset', { hasText: '青' }).click()
await page.waitForTimeout(300)
const tealAccent = await rootVar('--accent')
check('主题色预设：点击「青」写入 --accent', tealAccent === '#2dd4bf', `${before || '(空)'} → ${tealAccent}`)
check('主题色预设：「青」按钮激活', (await page.locator('.theme-preset.is-active').textContent()).includes('青'))
const prefsRaw = await page.evaluate(() => JSON.parse(localStorage.getItem('worktable.theme.prefs') || '{}'))
check('主题色预设：偏好已持久化', prefsRaw.accent === 'teal', `accent=${prefsRaw.accent}`)

// —— 2. 玻璃液态 ——
await page.locator('.panel', { hasText: '玻璃液态' }).locator('.switch').click()
await page.waitForTimeout(300)
const glassOn = await page.evaluate(() => document.documentElement.dataset.glass)
check('玻璃液态：开启后 data-glass=on', glassOn === 'on', glassOn)
const backdrop = await page.locator('.settings-content .panel').first().evaluate((el) => getComputedStyle(el).backdropFilter)
check('玻璃液态：面板 backdrop-filter 生效', /blur/.test(backdrop), backdrop.slice(0, 40))
const glassBlur = await rootVar('--glass-blur')
check('玻璃液态：--glass-blur 默认值 14px', glassBlur === '14px', glassBlur)

// —— 3. 自定义主题导入（合法 aurora）——
const fileInput = page.locator('.theme-actions input[type="file"]')
await fileInput.setInputFiles(join(ROOT, 'docs', 'themes', 'aurora.theme.json'))
await page.waitForTimeout(400)
const themeName = await page.locator('.panel:has(.theme-actions)').textContent()
check('自定义主题：导入后显示主题名', themeName.includes('极光 Aurora'))
const ink950 = await rootVar('--ink-950')
check('自定义主题：颜色令牌内联应用', ink950 === '#0d1220', `--ink-950=${ink950}`)
const radius = await rootVar('--radius')
check('自定义主题：radius 应用并派生', radius === '10px', `--radius=${radius}`)
check('自定义主题：主题内 glass 自动开启', (await page.evaluate(() => document.documentElement.dataset.glass)) === 'on')
check('自定义主题：--glass-blur 用主题值 16px', (await rootVar('--glass-blur')) === '16px', await rootVar('--glass-blur'))
const tealDisabled = await page.locator('.theme-preset', { hasText: '青' }).isDisabled()
check('自定义主题：非默认预设被禁用', tealDisabled)

// —— 4. 持久化：刷新后自定义主题仍在 ——
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)
check('持久化：刷新后 --ink-950 仍在', (await rootVar('--ink-950')) === '#0d1220')

// —— 5. 恢复默认：旧自定义颜色内联变量必须清干净 ——
await page.locator('.settings-nav__item', { hasText: '界面偏好' }).click()
await page.waitForTimeout(300)
await page.locator('.theme-actions .btn--ghost', { hasText: '恢复默认' }).click()
await page.waitForTimeout(300)
check('恢复默认：--ink-950 已清除', (await rootVar('--ink-950')) === '', `"${await rootVar('--ink-950')}"`)
check('恢复默认：--accent 已清除', (await rootVar('--accent')) === '')

// —— 6. 非法主题：错误列表展示且不被应用 ——
await fileInput.setInputFiles(badThemePath)
await page.waitForTimeout(300)
const errItems = await page.locator('.theme-errors li').allTextContents()
check('非法主题：错误列表展示', errItems.length >= 2, errItems.slice(0, 2).join(' / '))
check('非法主题：未写入 --accent', (await rootVar('--accent')) === '')

// —— 7. 告警主题：radius 超范围自动修正 ——
await fileInput.setInputFiles(warnThemePath)
await page.waitForTimeout(300)
const warnItems = await page.locator('.theme-warnings li').allTextContents()
check('告警主题：警告列表展示', warnItems.length >= 1, warnItems[0] ?? '')
check('告警主题：radius 被钳制到上限', (await rootVar('--radius')) === '20px', await rootVar('--radius'))

check('无页面 JS 异常', errors.filter((e) => !e.includes('502')).length === 0, errors.slice(0, 2).join(' ; '))

const passed = results.filter((r) => r.ok).length
console.log(`\n${passed}/${results.length} 通过`)
await page.locator('.settings-content').screenshot({ path: 'screenshots/theme-settings.png' })
await browser.close()
process.exit(passed === results.length ? 0 : 1)
