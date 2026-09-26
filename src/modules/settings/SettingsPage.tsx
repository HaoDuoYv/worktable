import { PageHeader } from '@/components/Page'
import { Disclosure } from '@/components/Disclosure'
import { ChipRow, type ChipOption } from '@/components/Chip'
import { useRef, useState } from 'react'
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
import { validateThemeConfig } from '@/core/theme/themeConfig'
import {
  ACCENT_PRESETS,
  getThemePrefs,
  resetTheme,
  setAccentPreset,
  setCustomTheme,
  setGlassEnabled,
} from '@/core/theme/themePrefs'

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

/** 主题区：简单配色预设 + 玻璃液态 + 自定义主题导入 */
function ThemeSection() {
  const [prefs, setPrefs] = useState(getThemePrefs)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const refresh = () => setPrefs(getThemePrefs())

  const onImportFile = async (file: File) => {
    setImportErrors([])
    setImportWarnings([])
    setImportMsg('')
    try {
      const text = await file.text()
      let raw: unknown
      try {
        raw = JSON.parse(text)
      } catch {
        setImportErrors(['文件不是合法 JSON'])
        return
      }
      const result = validateThemeConfig(raw)
      if (!result.ok || !result.theme) {
        setImportErrors(result.errors)
        return
      }
      setCustomTheme(result.theme)
      setImportWarnings(result.warnings)
      setImportMsg(`已应用主题「${result.theme.meta.name}」`)
      refresh()
    } catch (e) {
      setImportErrors([e instanceof Error ? e.message : String(e)])
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onExport = () => {
    const theme = prefs.customTheme
    if (!theme) return
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${theme.meta.name.replace(/\s+/g, '-')}.theme.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <section className="panel">
        <h2 className="panel__title">主题色</h2>
        <p className="panel__text" style={{ marginBottom: 12 }}>
          简单配色修改：只调整主操作色。启用自定义主题后此预设不生效。
        </p>
        <div className="theme-presets">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`theme-preset${prefs.accent === p.id && !prefs.customTheme ? ' is-active' : ''}`}
              onClick={() => {
                setAccentPreset(p.id)
                refresh()
              }}
              disabled={prefs.customTheme != null && p.id !== 'default'}
              title={prefs.customTheme != null ? '自定义主题启用中，预设不生效' : p.label}
            >
              <span className="theme-preset__dot" style={{ background: p.dark.accent }} />
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title">玻璃液态</h2>
        <p className="panel__text" style={{ marginBottom: 12 }}>
          面板半透明 + 背景模糊 + 极光底纹。与主题色、自定义主题可叠加。
        </p>
        <Switch
          checked={prefs.glass || prefs.customTheme?.effects?.glass === true}
          onChange={(v) => {
            setGlassEnabled(v)
            refresh()
          }}
          label="开启玻璃液态"
        />
        {prefs.customTheme?.effects?.glass ? (
          <p className="panel__text" style={{ marginTop: 8 }}>
            当前自定义主题内置了玻璃效果（模糊 {prefs.customTheme.effects.glassBlur ?? 14}px）。
          </p>
        ) : null}
      </section>

      <section className="panel">
        <h2 className="panel__title">自定义主题</h2>
        <p className="panel__text" style={{ marginBottom: 12 }}>
          按 <code>docs/THEME_SPEC.md</code> 规范编写 JSON 主题文件后导入。未覆盖的令牌继承当前深色/浅色基底。
        </p>
        {prefs.customTheme ? (
          <p className="panel__text" style={{ marginBottom: 12 }}>
            当前主题：<strong>{prefs.customTheme.meta.name}</strong>
            {prefs.customTheme.meta.author ? ` · ${prefs.customTheme.meta.author}` : ''}
            {prefs.customTheme.meta.version ? ` · v${prefs.customTheme.meta.version}` : ''}
          </p>
        ) : null}
        <div className="theme-actions">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImportFile(f)
            }}
          />
          <button className="btn btn--primary" onClick={() => fileRef.current?.click()}>
            导入主题文件
          </button>
          {prefs.customTheme ? (
            <>
              <button className="btn btn--ghost" onClick={onExport}>
                导出当前主题
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => {
                  resetTheme()
                  setImportErrors([])
                  setImportWarnings([])
                  setImportMsg('已恢复默认主题')
                  refresh()
                }}
              >
                恢复默认
              </button>
            </>
          ) : null}
        </div>
        {importMsg ? <p className="settings-saved">{importMsg}</p> : null}
        {importErrors.length > 0 ? (
          <ul className="theme-errors">
            {importErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        ) : null}
        {importWarnings.length > 0 ? (
          <ul className="theme-warnings">
            {importWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  )
}

/** 界面偏好组：密度 + 天气 + 主题 */
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

      <ThemeSection />
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
