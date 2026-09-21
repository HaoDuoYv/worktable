// Smoke test: 算法实验室新布局（面板系统 / 可视化重排 / 移动端适配）
// 运行: node scripts/verify-algolab.mjs [baseURL]
import { chromium } from 'playwright'
import fs from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:5173'
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra })
}

let fatal = null
try {
  await main()
} catch (err) {
  fatal = String(err?.stack ?? err)
}

const failed = results.filter((r) => !r.ok)
const report = {
  fatal,
  passed: results.length - failed.length,
  total: results.length,
  results,
}
fs.writeFileSync('verify-result.json', JSON.stringify(report, null, 2), 'utf8')
process.exit(fatal || failed.length > 0 ? 1 : 0)

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (err) => results.push({ name: `页面脚本错误: ${err.message}`, ok: false }))

  await page.goto(`${base}/algorithms`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // 1. 三面板 + 面板头 + 状态栏
  check('算法库面板存在', await page.locator('.algo-lab__nav').isVisible())
  check('可视化面板存在', await page.locator('.algo-lab__viz').isVisible())
  check('代码面板存在', await page.locator('.algo-lab__editor').isVisible())
  check('面板标题栏数量 = 3', (await page.locator('.panel-chrome').count()) === 3)
  check('底部状态栏存在', await page.locator('.algo-lab__statusbar').isVisible())
  check('关键变量标志区存在', await page.locator('.viz-vars__label').isVisible())
  check('日志区标签（日志/统计）', (await page.locator('.viz-logsec__tab').count()) === 2)
  check('自动滚动开关存在', await page.locator('.viz-logsec__bar .switch').isVisible())

  // 2. 选中数组类算法并运行 → 画布 + 日志 + 变量
  await page.locator('.algo-search').fill('冒泡')
  await page.waitForTimeout(300)
  await page.locator('.algo-item__main').first().click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await page.waitForTimeout(3000)
  check('运行后画布出现可视化单元', (await page.locator('.viz-cell').count()) > 0)
  check('画布包含非日志可视化面板', (await page.locator('.algo-lab__canvas .viz-panel').count()) > 0)
  check('日志区出现日志文本', (await page.locator('.viz-logsec__body pre.viz-log').count()) > 0)
  check('步数胶囊出现', await page.locator('.viz-step-badge').isVisible())
  check('日志区有内容或空态提示', await page.locator('.viz-logsec__body').isVisible())
  await page.locator('.algo-search').fill('')

  // 3. 播放控制：步进 / 速度
  await page.getByRole('button', { name: '下一步' }).click()
  await page.waitForTimeout(300)
  check('步进可点击（未禁用）', true)
  await page.locator('.speed-tick').nth(2).click()
  check('速度切换可点击', true)

  // 4. 统计标签页
  await page.getByRole('tab', { name: '统计' }).click()
  check('统计页显示播放进度', await page.locator('.viz-stat__value').first().isVisible())
  await page.getByRole('tab', { name: '日志' }).click()

  // 5. 面板折叠 → 图标栏 → 展开
  await page.getByRole('button', { name: '折叠算法库' }).click()
  check('算法库折叠为图标栏', await page.locator('.panel-rail--lib').isVisible())
  await page.getByRole('button', { name: '展开算法库' }).click()
  check('算法库恢复展开', await page.locator('.algo-lab__nav').isVisible())

  // 6. 布局预设
  await page.locator('.algo-lab__viz .select-menu__trigger').click()
  await page.getByText('专注可视化').click()
  await page.waitForTimeout(300)
  check('预设「专注可视化」两侧折叠', (await page.locator('.panel-rail').count()) === 2)
  await page.getByRole('button', { name: '重置布局' }).click()
  await page.waitForTimeout(300)
  check('重置布局后三面板恢复', (await page.locator('.panel-chrome').count()) === 3)

  // 7. 分隔条拖拽调宽
  const navBefore = await page.locator('.algo-lab__nav').boundingBox()
  const hb = await page.locator('.algo-lab__split').first().boundingBox()
  await page.mouse.move(hb.x + 3, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(hb.x + 63, hb.y + hb.height / 2, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const navAfter = await page.locator('.algo-lab__nav').boundingBox()
  check(
    '分隔条拖拽调整算法库宽度',
    Math.abs(navAfter.width - navBefore.width) > 20,
    `${Math.round(navBefore.width)}px → ${Math.round(navAfter.width)}px`,
  )

  // 8. 算法库功能：搜索 / 多选按钮
  await page.locator('.algo-search').fill('冒泡')
  await page.waitForTimeout(300)
  check('算法库搜索过滤', (await page.locator('.algo-item').count()) >= 1)
  await page.locator('.algo-search').fill('')
  check('多选按钮存在', await page.getByRole('button', { name: '多选' }).isVisible())

  // 9. 代码面板操作按钮齐全
  for (const label of ['保存', '另存为副本', 'AI 问答', '生成可视化代码']) {
    check(`代码面板操作「${label}」存在`, await page.getByRole('button', { name: label }).isVisible())
  }

  // 10. 移动端 390px：分段切换
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mob.goto(`${base}/algorithms`, { waitUntil: 'networkidle' })
  await mob.waitForTimeout(800)
  check('移动端分段切换可见', await mob.locator('.algo-lab__seg').isVisible())
  check('移动端默认显示可视化面板', await mob.locator('.algo-lab__viz').isVisible())
  check('移动端状态栏隐藏', !(await mob.locator('.algo-lab__statusbar').isVisible()))
  await mob.getByRole('button', { name: '代码' }).click()
  await mob.waitForTimeout(300)
  check('移动端切换到代码面板', await mob.locator('.algo-lab__editor').isVisible())
  check('移动端代码面板编辑器可见', await mob.locator('.cm-editor').isVisible())
  await mob.getByRole('button', { name: '算法库' }).click()
  await mob.waitForTimeout(300)
  check('移动端切换到算法库面板', await mob.locator('.algo-lab__nav').isVisible())

  await browser.close()
}
