/**
 * 主题偏好 —— 简单配色预设 / 玻璃液态 / 自定义主题。
 * 单例服务（与 newsService 同构）：localStorage 持久化 + 启动时应用到 :root 内联变量。
 *
 * 优先级：外观模式（ThemeProvider 的 dark/light）→ 自定义主题 → 主题色预设。
 * 自定义主题启用时预设不生效；选择预设自动退出自定义主题。
 */

import type { ThemeConfig } from './themeConfig'

export type AccentPresetId = 'default' | 'teal' | 'violet' | 'amber' | 'crimson'

export interface AccentPreset {
  id: AccentPresetId
  label: string
  /** 预设色板（同时给出 dark / light 两套取值） */
  dark: { accent: string; accentSoft: string; focus: string }
  light: { accent: string; accentSoft: string; focus: string }
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: 'default',
    label: '默认蓝',
    dark: { accent: '#007acc', accentSoft: 'rgba(0,122,204,0.16)', focus: '#4a9ede' },
    light: { accent: '#1d4ed8', accentSoft: 'rgba(29,78,216,0.1)', focus: '#1d4ed8' },
  },
  {
    id: 'teal',
    label: '青',
    dark: { accent: '#2dd4bf', accentSoft: 'rgba(45,212,191,0.16)', focus: '#5eead4' },
    light: { accent: '#0f766e', accentSoft: 'rgba(15,118,110,0.12)', focus: '#0f766e' },
  },
  {
    id: 'violet',
    label: '紫',
    dark: { accent: '#8b5cf6', accentSoft: 'rgba(139,92,246,0.18)', focus: '#a78bfa' },
    light: { accent: '#6d28d9', accentSoft: 'rgba(109,40,217,0.1)', focus: '#6d28d9' },
  },
  {
    id: 'amber',
    label: '橙',
    dark: { accent: '#f59e0b', accentSoft: 'rgba(245,158,11,0.18)', focus: '#fbbf24' },
    light: { accent: '#b45309', accentSoft: 'rgba(180,83,9,0.12)', focus: '#b45309' },
  },
  {
    id: 'crimson',
    label: '绯红',
    dark: { accent: '#f43f5e', accentSoft: 'rgba(244,63,94,0.18)', focus: '#fb7185' },
    light: { accent: '#be123c', accentSoft: 'rgba(190,18,60,0.1)', focus: '#be123c' },
  },
]

export interface ThemePrefs {
  /** 主题色预设 */
  accent: AccentPresetId
  /** 玻璃液态总开关（与自定义主题内的 effects.glass 叠加为「任一为真」） */
  glass: boolean
  /** 自定义主题（导入并通过校验后存在；null 表示未启用） */
  customTheme: ThemeConfig | null
}

const PREFS_KEY = 'worktable.theme.prefs'

const DEFAULT_PREFS: ThemePrefs = {
  accent: 'default',
  glass: false,
  customTheme: null,
}

/** 应用到 :root 的可清除内联变量清单（避免越积越多） */
const MANAGED_VARS = [
  '--accent',
  '--accent-soft',
  '--focus',
  '--radius',
  '--radius-sm',
  '--radius-lg',
  '--font-ui',
  '--font-mono',
  '--glass-blur',
  '--glass-opacity',
] as const

let state: ThemePrefs = loadPrefs()
const listeners = new Set<() => void>()

/** 上一轮应用过的自定义颜色 key（恢复默认/换主题时才能精确清干净） */
let appliedColorKeys: string[] = []

function loadPrefs(): ThemePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const p = JSON.parse(raw) as Partial<ThemePrefs>
    return {
      accent: ACCENT_PRESETS.some((x) => x.id === p.accent) ? (p.accent as AccentPresetId) : 'default',
      glass: p.glass === true,
      customTheme: p.customTheme ?? null,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function persist() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function setState(next: Partial<ThemePrefs>) {
  state = { ...state, ...next }
  persist()
  applyThemePrefs()
  for (const l of listeners) l()
}

export function getThemePrefs(): ThemePrefs {
  return state
}

export function subscribeThemePrefs(listener: () => void): () => void {
  listeners.add(listener)
  listener()
  return () => {
    listeners.delete(listener)
  }
}

function currentMode(): 'dark' | 'light' {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

/** 把当前偏好应用到 :root（内联变量优先级高于样式表） */
export function applyThemePrefs(): void {
  const root = document.documentElement
  const { accent, glass, customTheme } = state

  // 1) 清掉上一轮写入的内联变量（含上一轮自定义主题写过的颜色）
  for (const v of MANAGED_VARS) root.style.removeProperty(v)
  for (const k of appliedColorKeys) root.style.removeProperty(`--${k}`)
  appliedColorKeys = []

  // 2) 自定义主题优先；否则应用主题色预设
  if (customTheme) {
    appliedColorKeys = []
    for (const [k, v] of Object.entries(customTheme.colors ?? {})) {
      if (v) {
        root.style.setProperty(`--${k}`, v)
        appliedColorKeys.push(k)
      }
    }
    if (customTheme.radius != null) {
      root.style.setProperty('--radius', `${customTheme.radius}px`)
      root.style.setProperty('--radius-sm', `${Math.max(0, customTheme.radius - 2)}px`)
      root.style.setProperty('--radius-lg', `${customTheme.radius + 4}px`)
    }
    if (customTheme.font?.ui) root.style.setProperty('--font-ui', customTheme.font.ui)
    if (customTheme.font?.mono) root.style.setProperty('--font-mono', customTheme.font.mono)
  } else if (accent !== 'default') {
    const preset = ACCENT_PRESETS.find((p) => p.id === accent)
    if (preset) {
      const c = currentMode() === 'dark' ? preset.dark : preset.light
      root.style.setProperty('--accent', c.accent)
      root.style.setProperty('--accent-soft', c.accentSoft)
      root.style.setProperty('--focus', c.focus)
    }
  }

  // 3) 玻璃液态：偏好开关 或 自定义主题 effects.glass
  const glassOn = glass || customTheme?.effects?.glass === true
  root.dataset.glass = glassOn ? 'on' : 'off'
  if (glassOn) {
    const blur = customTheme?.effects?.glassBlur ?? 14
    const opacity = customTheme?.effects?.glassOpacity ?? 0.72
    root.style.setProperty('--glass-blur', `${blur}px`)
    root.style.setProperty('--glass-opacity', String(opacity))
  }
}

/** 选择主题色预设；非默认预设会自动退出自定义主题 */
export function setAccentPreset(id: AccentPresetId): void {
  setState({ accent: id, customTheme: id === 'default' ? state.customTheme : null })
}

/** 玻璃液态开关 */
export function setGlassEnabled(on: boolean): void {
  setState({ glass: on })
}

/** 导入自定义主题（须已通过 validateThemeConfig） */
export function setCustomTheme(theme: ThemeConfig): void {
  setState({ customTheme: theme })
}

/** 恢复默认：退出自定义主题并回到默认主题色 */
export function resetTheme(): void {
  setState({ accent: 'default', customTheme: null })
}
