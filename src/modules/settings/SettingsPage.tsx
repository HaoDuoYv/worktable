import { PageHeader } from '@/components/Page'
import { Disclosure } from '@/components/Disclosure'
import { ChipRow, type ChipOption } from '@/components/Chip'
import { useState } from 'react'
import { Stepper } from '@/components/Stepper'
import { AiSettingsPanel } from '@/modules/ai/AiSettingsPanel'
import { SettingsSwitchGroup, Switch, type SwitchOption } from '@/components/Switch'
import { AccountPanel, SyncPanel } from '@/modules/sync/SyncPanel'
import { CppSettingsPanel } from '@/modules/settings/CppSettingsPanel'
import {
  invalidateWeatherCache,
  ensureWeather,
  loadWeatherSettings,
  saveWeatherSettings,
} from '@/modules/weather/weatherService'

type Density = 'comfortable' | 'compact'

const DENSITY: ChipOption<Density>[] = [
  { value: 'comfortable', label: '舒适' },
  { value: 'compact', label: '紧凑' },
]

type GroupKey = 'ai' | 'ui' | 'player' | 'cpp' | 'data' | 'account'

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'ai', label: 'AI 接口' },
  { key: 'ui', label: '界面偏好' },
  { key: 'player', label: '播放与编辑' },
  { key: 'cpp', label: '编译环境' },
  { key: 'data', label: '数据管理' },
  { key: 'account', label: '账号与同步' },
]

/** 界面偏好组：密度 + 天气 */
function UiPrefsGroup() {
  const [density, setDensity] = useState<Density>('comfortable')
  const [weather, setWeather] = useState(loadWeatherSettings)
  const [cityDraft, setCityDraft] = useState(weather.city)
  const [savedMsg, setSavedMsg] = useState('')

  const persist = (next: Partial<typeof weather>) => {
    const merged = { ...weather, ...next }
    setWeather(merged)
    saveWeatherSettings(merged)
    invalidateWeatherCache()
    void ensureWeather(true).catch(() => undefined)
    setSavedMsg('已保存并刷新天气')
    window.setTimeout(() => setSavedMsg(''), 2400)
  }

  return (
    <>
      <section className="panel">
        <h2 className="panel__title">界面密度</h2>
        <p className="panel__text" style={{ marginBottom: 12 }}>
          影响列表与面板间距。偏好保存在本地。
        </p>
        <ChipRow ariaLabel="界面密度" options={DENSITY} value={density} onChange={setDensity} />
      </section>

      <section className="panel">
        <h2 className="panel__title">天气</h2>
        <p className="panel__text" style={{ marginBottom: 12 }}>
          用于主页「当日天气」。优先使用浏览器定位；定位关闭或失败时使用下方城市。
        </p>
        <div className="settings-weather">
          <label className="settings-field">
            <span className="settings-field__label">默认城市</span>
            <input
              className="settings-field__input"
              value={cityDraft}
              onChange={(e) => setCityDraft(e.target.value)}
              onBlur={() => {
                const city = cityDraft.trim() || '北京市'
                setCityDraft(city)
                if (city !== weather.city) persist({ city })
              }}
              placeholder="北京市"
            />
          </label>
          <Switch
            checked={weather.autoLocation}
            onChange={(checked) => persist({ autoLocation: checked })}
            label="自动定位"
          />
        </div>
        {savedMsg ? <p className="settings-saved">{savedMsg}</p> : null}
      </section>
    </>
  )
}

/** 播放与编辑组：开关组 + 交互预览 */
function PlayerPrefsGroup() {
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
    <>
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
    </>
  )
}

export function SettingsPage() {
  const [group, setGroup] = useState<GroupKey>('ai')

  return (
    <div className="page settings-page">
      <PageHeader
        title="设置"
        desc="AI 接口、界面偏好、数据管理。所有密钥仅保存在本机。"
      />

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置分组">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              className={`settings-nav__item${group === g.key ? ' is-active' : ''}`}
              aria-current={group === g.key ? 'true' : undefined}
              onClick={() => setGroup(g.key)}
            >
              {g.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {group === 'ai' ? <AiSettingsPanel /> : null}
          {group === 'ui' ? <UiPrefsGroup /> : null}
          {group === 'player' ? <PlayerPrefsGroup /> : null}
          {group === 'cpp' ? <CppSettingsPanel /> : null}
          {group === 'data' ? <SyncPanel /> : null}
          {group === 'account' ? <AccountPanel /> : null}
        </div>
      </div>
    </div>
  )
}
