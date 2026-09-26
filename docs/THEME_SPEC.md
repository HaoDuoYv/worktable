# Worktable 主题配置规范（THEME_SPEC）

> 版本：v1.0 · 对齐 `src/styles/tokens.css` 设计令牌与 `src/core/theme/` 主题引擎
> 用户按本规范编写 **JSON 主题文件**（建议命名 `*.theme.json`），在「设置 → 界面偏好 → 自定义主题」导入即可生效。

---

## 1. 文件结构总览

```json
{
  "$schema": "worktable-theme/v1",
  "meta": {
    "name": "极光 Aurora",
    "author": "your-name",
    "version": "1.0.0",
    "description": "深蓝底 + 青紫极光的暗色主题"
  },
  "base": "dark",
  "colors": {
    "ink-950": "#0f1420",
    "panel": "#151b2b",
    "accent": "#22d3ee"
  },
  "effects": {
    "glass": true,
    "glassBlur": 14,
    "glassOpacity": 0.72
  },
  "radius": 8,
  "font": {
    "ui": "'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif",
    "mono": "Consolas, 'Cascadia Code', monospace"
  }
}
```

| 顶层字段 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `$schema` | string | 建议 | 固定为 `worktable-theme/v1`，缺失时警告但仍尝试解析 |
| `meta` | object | **是** | 至少含 `name`；`author` / `version` / `description` 可选 |
| `base` | `"dark"` \| `"light"` | **是** | 回退基底：**未在 `colors` 中覆盖的令牌继承内置深色/浅色主题** |
| `colors` | object | 否 | 令牌名 → 颜色值，见 §2 白名单；可只覆盖少量令牌 |
| `effects` | object | 否 | 玻璃液态等视觉效果，见 §3 |
| `radius` | number | 否 | 基础圆角 px（0–20），派生 `radius-sm = radius-2`、`radius-lg = radius+4` |
| `font` | object | 否 | `ui` / `mono` 字体栈字符串；必须含 fallback |

---

## 2. `colors` 令牌白名单

只允许下列 key（不带 `--` 前缀）；**出现未知 key 会导致导入失败并列出名单**。

| 令牌 | 含义 | dark 默认 | light 默认 |
|------|------|-----------|------------|
| `ink-950` | 全局底色 | `#1e1e1e` | `#f3f4f6` |
| `ink-900` | 主面板 | `#252526` | `#ffffff` |
| `ink-800` | 抬升面 / 次面板 | `#2d2d30` | `#f9fafb` |
| `ink-700` | 悬停 / 更浅层级 | `#3f3f46` | `#e5e7eb` |
| `line` | 分割线 / 边框 | `#3f3f46` | `#d1d5db` |
| `line-strong` | 强边框 | `#52525b` | `#9ca3af` |
| `text` | 正文 | `#e4e4e7` | `#111827` |
| `text-muted` | 次要文字 | `#9d9d9d` | `#4b5563` |
| `text-subtle` | 装饰 / 元信息 | `#6a6a6a` | `#6b7280` |
| `accent` | 主操作 / 链接 | `#007acc` | `#1d4ed8` |
| `accent-soft` | 主色淡底（选中等） | `rgba(0,122,204,.16)` | `rgba(29,78,216,.1)` |
| `accent-fg` | 主色上的文字 | `#ffffff` | `#ffffff` |
| `signal` | 成功 / 算法域 | `#4ec9b0` | `#047857` |
| `signal-soft` | 成功淡底 | `rgba(78,201,176,.16)` | `rgba(4,120,87,.12)` |
| `warn` | 警告 | `#dcdcaa` | `#b45309` |
| `danger` | 破坏性 / 错误 | `#f85149` | `#dc2626` |
| `focus` | 焦点环 | `#4a9ede` | `#1d4ed8` |
| `panel` | 卡片面板 | `#252526` | `#ffffff` |
| `panel-2` | 面板内嵌块 | `#2d2d30` | `#f9fafb` |
| `canvas` | 画布底 | `#181818` | `#e5e7eb` |
| `elevated` | 浮层 | `#2d2d30` | `#ffffff` |
| `diff-add-bg` / `diff-add-fg` | diff 增 | `#14301f` / `#86efac` | `#dcfce7` / `#14532d` |
| `diff-del-bg` / `diff-del-fg` | diff 删 | `#331818` / `#fca5a5` | `#fee2e2` / `#7f1d1d` |

**颜色值格式**（字符串）：

- `#rgb` / `#rrggbb` / `#rrggbbaa`
- `rgb(r, g, b)` / `rgba(r, g, b, a)`

**对比度约定（建议遵守，引擎做警告不阻断）**：

- `text` 对 `ink-950` / `panel` ≥ 4.5:1
- `text-muted` 对 `panel` ≥ 4.5:1
- `text-subtle` 仅用于装饰性信息，≥ 3:1
- `focus` 对相邻底色 ≥ 3:1

---

## 3. `effects` 视觉效果

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `glass` | boolean | `false` | **玻璃液态开关**：面板半透明 + 背景模糊 + 极光底纹 |
| `glassBlur` | number | `14` | 背景模糊 px（0–40，越界自动收敛） |
| `glassOpacity` | number | `0.72` | 面板不透明度 0–1（建议 0.5–0.85，过低影响可读性） |

玻璃模式下这些面会变为半透明 + `backdrop-filter: blur()`：侧边导航、卡片（`.panel`）、统计块、输入框、悬浮层。`base: dark` 时底纹为蓝紫极光，`base: light` 时为浅色柔光。

---

## 4. 校验规则（`validateThemeConfig`）

| 规则 ID | 检查 | 级别 |
|---------|------|------|
| `meta-name` | `meta.name` 非空 | error |
| `base-enum` | `base` 为 `dark` / `light` | error |
| `color-key` | `colors` key 全部在 §2 白名单 | error（列出未知 key） |
| `color-format` | 颜色值匹配 §2 格式 | error（列出非法字段） |
| `radius-range` | 0–20，越界收敛 | warning（自动修正） |
| `blur-range` | 0–40，越界收敛 | warning（自动修正） |
| `opacity-range` | 0–1，越界收敛 | warning（自动修正） |
| `font-fallback` | 字体栈含 `,`（有回退） | warning |
| `contrast-hint` | 正文/面板亮度差过小时提示 | warning |

error 任一命中 → 拒绝导入并在设置页展示全部错误；warning 仅提示、自动修正后生效。

---

## 5. 与「简单主题切换」的关系

应用内提供三层主题能力，优先级从低到高：

1. **外观模式**：深色 / 浅色 / 跟随系统（顶栏太阳图标，已有）
2. **简单配色**：主题色预设（默认蓝 / 青 / 紫 / 橙 / 绯红）——只改 `accent` 系列令牌
3. **自定义主题**：按本规范导入 JSON，可覆盖全部令牌 + 玻璃液态

规则：**启用自定义主题后，主题色预设不再生效**（自定义优先）；在预设中重新选择主题色 → 自动退出自定义主题。玻璃液态开关与两者独立，可随时叠加。

---

## 6. 最小示例

只改主题色和圆角的最小合法文件：

```json
{
  "meta": { "name": "我的紫色主题" },
  "base": "dark",
  "colors": { "accent": "#8b5cf6", "focus": "#a78bfa" },
  "radius": 10
}
```

完整示例见 `docs/themes/aurora.theme.json`（可直接在设置中导入体验）。

---

## 7. 版本与变更

| 版本 | 变更 |
|------|------|
| v1.0 | 首版：colors 白名单 24 令牌 + effects 玻璃液态 + radius/font；`validateThemeConfig` 同步实现 |

修改本规范时请同步：`src/core/theme/themeConfig.ts` 与本文件。
