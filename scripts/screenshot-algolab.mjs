// 截取算法实验室新布局效果图（桌面 + 移动端）
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5173'
const browser = await chromium.launch()

// 桌面端：运行冒泡排序后的完整工作区
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`${base}/algorithms`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.locator('.algo-search').fill('冒泡')
await page.waitForTimeout(300)
await page.locator('.algo-item__main').first().click()
await page.waitForTimeout(300)
await page.locator('.algo-search').fill('')
await page.getByRole('button', { name: '运行', exact: true }).click()
await page.waitForTimeout(3200)
await page.screenshot({ path: 'screenshots/algolab-new-desktop.png' })

// 桌面端：专注可视化预设
await page.locator('.algo-lab__viz .select-menu__trigger').click()
await page.getByText('专注可视化').click()
await page.waitForTimeout(400)
await page.screenshot({ path: 'screenshots/algolab-new-focus.png' })
await page.getByRole('button', { name: '重置布局' }).click()

// 移动端：可视化 + 代码
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
await mob.goto(`${base}/algorithms`, { waitUntil: 'networkidle' })
await mob.waitForTimeout(800)
await mob.getByRole('button', { name: '运行', exact: true }).click()
await mob.waitForTimeout(3200)
await mob.screenshot({ path: 'screenshots/algolab-new-mobile.png' })

await browser.close()
