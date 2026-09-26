/**
 * 主题配置 —— 类型、令牌白名单与校验。
 * 规范文档：docs/THEME_SPEC.md（修改本文件须同步规范 §2/§4）。
 */

export const THEME_SCHEMA_ID = 'worktable-theme/v1'

export type ThemeBase = 'dark' | 'light'

/** colors 白名单（不带 -- 前缀），与 tokens.css / THEME_SPEC §2 对齐 */
export const THEME_COLOR_KEYS = [
  'ink-950',
  'ink-900',
  'ink-800',
  'ink-700',
  'line',
  'line-strong',
  'text',
  'text-muted',
  'text-subtle',
  'accent',
  'accent-soft',
  'accent-fg',
  'signal',
  'signal-soft',
  'warn',
  'danger',
  'focus',
  'panel',
  'panel-2',
  'canvas',
  'elevated',
  'diff-add-bg',
  'diff-add-fg',
  'diff-del-bg',
  'diff-del-fg',
] as const

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number]

export interface ThemeConfigMeta {
  name: string
  author?: string
  version?: string
  description?: string
}

export interface ThemeConfigEffects {
  glass?: boolean
  glassBlur?: number
  glassOpacity?: number
}

export interface ThemeConfig {
  $schema?: string
  meta: ThemeConfigMeta
  base: ThemeBase
  colors?: Partial<Record<ThemeColorKey, string>>
  effects?: ThemeConfigEffects
  radius?: number
  font?: { ui?: string; mono?: string }
}

export interface ThemeValidation {
  ok: boolean
  /** 阻断导入的错误（已合并为可读文案） */
  errors: string[]
  /** 仅提示的警告（自动修正或不阻断） */
  warnings: string[]
  /** 校验并自动修正后的主题（ok 时可用） */
  theme?: ThemeConfig
}

const COLOR_RE =
  /^(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\))$/

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** 简易相对亮度（0–255），用于对比度提示 */
function luminance(hex: string): number | null {
  const m = /^#([0-9a-fA-F]{6})/.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * 校验并规范化主题配置。
 * error → ok=false 拒绝导入；warning → 自动修正后 ok=true。
 */
export function validateThemeConfig(raw: unknown): ThemeValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['主题文件必须是一个 JSON 对象'], warnings }
  }
  const input = raw as Record<string, unknown>

  // meta.name
  const meta = (input.meta ?? {}) as Record<string, unknown>
  if (typeof meta.name !== 'string' || !meta.name.trim()) {
    errors.push('meta.name 必填且不能为空（规则 meta-name）')
  }

  // base
  if (input.base !== 'dark' && input.base !== 'light') {
    errors.push('base 必须是 "dark" 或 "light"（规则 base-enum）')
  }

  // colors
  const colors: Partial<Record<ThemeColorKey, string>> = {}
  if (input.colors != null) {
    if (typeof input.colors !== 'object' || Array.isArray(input.colors)) {
      errors.push('colors 必须是对象（规则 color-key）')
    } else {
      const unknown: string[] = []
      const invalid: string[] = []
      for (const [k, v] of Object.entries(input.colors as Record<string, unknown>)) {
        if (!THEME_COLOR_KEYS.includes(k as ThemeColorKey)) {
          unknown.push(k)
          continue
        }
        if (typeof v !== 'string' || !COLOR_RE.test(v.trim())) {
          invalid.push(k)
          continue
        }
        colors[k as ThemeColorKey] = v.trim()
      }
      if (unknown.length) {
        errors.push(`未知令牌：${unknown.join('、')}（规则 color-key，白名单见 THEME_SPEC §2）`)
      }
      if (invalid.length) {
        errors.push(`颜色格式非法：${invalid.join('、')}（规则 color-format）`)
      }
    }
  }

  // radius
  let radius: number | undefined
  if (input.radius != null) {
    const r = Number(input.radius)
    if (!Number.isFinite(r)) {
      warnings.push('radius 不是数字，已忽略')
    } else if (r < 0 || r > 20) {
      radius = clamp(r, 0, 20)
      warnings.push(`radius=${r} 超出 0–20，已收敛为 ${radius}`)
    } else {
      radius = r
    }
  }

  // effects
  const effects: ThemeConfigEffects = {}
  const rawEffects = (input.effects ?? {}) as Record<string, unknown>
  if (typeof rawEffects.glass === 'boolean') effects.glass = rawEffects.glass
  if (rawEffects.glassBlur != null) {
    const b = Number(rawEffects.glassBlur)
    if (Number.isFinite(b)) {
      effects.glassBlur = clamp(b, 0, 40)
      if (b !== effects.glassBlur) warnings.push(`glassBlur=${b} 超出 0–40，已收敛为 ${effects.glassBlur}`)
    }
  }
  if (rawEffects.glassOpacity != null) {
    const o = Number(rawEffects.glassOpacity)
    if (Number.isFinite(o)) {
      effects.glassOpacity = clamp(o, 0, 1)
      if (o !== effects.glassOpacity) {
        warnings.push(`glassOpacity=${o} 超出 0–1，已收敛为 ${effects.glassOpacity}`)
      } else if (o < 0.5) {
        warnings.push('glassOpacity 低于 0.5 可能影响面板可读性')
      }
    }
  }

  // font
  let font: ThemeConfig['font']
  if (input.font != null && typeof input.font === 'object') {
    const f = input.font as Record<string, unknown>
    font = {}
    if (typeof f.ui === 'string' && f.ui.trim()) {
      font.ui = f.ui.trim()
      if (!font.ui.includes(',')) warnings.push('font.ui 缺少回退字体（规则 font-fallback）')
    }
    if (typeof f.mono === 'string' && f.mono.trim()) {
      font.mono = f.mono.trim()
      if (!font.mono.includes(',')) warnings.push('font.mono 缺少回退字体（规则 font-fallback）')
    }
  }

  // 对比度提示（仅在同时提供 text 与 ink-950 时粗判）
  const textLum = colors.text ? luminance(colors.text) : null
  const bgLum = colors['ink-950'] ? luminance(colors['ink-950']) : null
  if (textLum != null && bgLum != null && Math.abs(textLum - bgLum) < 80) {
    warnings.push('text 与 ink-950 亮度接近，正文对比度可能不足（规则 contrast-hint）')
  }

  if (errors.length > 0) return { ok: false, errors, warnings }

  const theme: ThemeConfig = {
    $schema: typeof input.$schema === 'string' ? input.$schema : undefined,
    meta: {
      name: String(meta.name).trim(),
      author: typeof meta.author === 'string' ? meta.author : undefined,
      version: typeof meta.version === 'string' ? meta.version : undefined,
      description: typeof meta.description === 'string' ? meta.description : undefined,
    },
    base: input.base as ThemeBase,
    colors: Object.keys(colors).length > 0 ? colors : undefined,
    effects: Object.keys(effects).length > 0 ? effects : undefined,
    radius,
    font,
  }
  return { ok: true, errors, warnings, theme }
}
