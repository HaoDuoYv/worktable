import { PageHeader } from '@/components/Page'
import { Disclosure } from '@/components/Disclosure'
import { ChipRow, type ChipOption } from '@/components/Chip'
import { useState } from 'react'
import { Stepper } from '@/components/Stepper'
import { AiSettingsPanel } from '@/modules/ai/AiSettingsPanel'
import { SettingsSwitchGroup, type SwitchOption } from '@/components/Switch'
import { AccountPanel, SyncPanel } from '@/modules/sync/SyncPanel'
import { CppSettingsPanel } from '@/modules/settings/CppSettingsPanel'

type Density = 'comfortable' | 'compact'

const DENSITY: ChipOption<Density>[] = [
  { value: 'comfortable', label: '舒适' },
  { value: 'compact', label: '紧凑' },
]

export function SettingsPage() {
  const [density, setDensity] = useState<Density>('comfortable')
  const [demoStep, setDemoStep] = useState(1)
  const [prefs, setPrefs] = useState<SwitchOption[]>([
    {
      id: 'autoPlay',
      label: '运行后自动播放',
      checked: true,
      hint: '算法运行完立即从第 0 步播放',
    },
    {
      id: 'keepLine',
      label: '步进时保持代码行高亮',
      checked: true,
      hint: '签名：画布与编辑器同步',
    },
    {
      id: 'confirmDelete',
      label: '删除前二次确认',
      checked: true,
      hint: '算法库删除保护',
    },
  ])

  return (
    <div className="page">
      <PageHeader
        title="设置"
        desc="AI 接口、界面偏好、数据导入导出。密钥仅保存在本机。"
      />

      <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
        <AccountPanel />
        <SyncPanel />
        <AiSettingsPanel />
        <CppSettingsPanel />

        <section className="panel">
          <h2 className="panel__title">播放与编辑</h2>
          <p className="panel__text" style={{ marginBottom: 12 }}>
            同组开关：切换其中一个时，邻近开关只做视觉涟漪，不会改变它们的真实状态。
          </p>
          <SettingsSwitchGroup
            options={prefs}
            onChange={(id, checked) => {
              setPrefs((list) => list.map((p) => (p.id === id ? { ...p, checked } : p)))
            }}
          />
        </section>

        <section className="panel">
          <h2 className="panel__title">界面密度</h2>
          <p className="panel__text" style={{ marginBottom: 12 }}>
            影响列表与面板间距。偏好保存在本地。
          </p>
          <ChipRow ariaLabel="界面密度" options={DENSITY} value={density} onChange={setDensity} />
        </section>

        <section className="panel">
          <h2 className="panel__title">交互预览</h2>
          <p className="panel__text" style={{ marginBottom: 12 }}>
            步骤条弹簧回弹、Disclosure、标签挤开（对齐 advanced-interaction-design）。
          </p>
          <Stepper total={5} current={demoStep} onChange={setDemoStep} />
          <div style={{ marginTop: 16 }}>
            <Disclosure label="备注面板（Disclosure）" defaultOpen>
              展开时按真实高度过渡，chevron 旋转 180°。教程备注与分类树共用此组件。
            </Disclosure>
          </div>
        </section>
      </div>
    </div>
  )
}
