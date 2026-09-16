# Worktable UI 重构蓝图（design-blueprint）

> 基线：`DESIGN.md` §7（Move 0 复用，本文件为 **Taste 增量**）  
> 范围：**仅 UI/布局/可读性**；路由、API、数据模型、算法/AI 逻辑 **零改动**  
> 日期：2026-09-16 · 版本：UI-BP-1

---

## Identity

**Product UI Designer** — 首问：「用户 90% 时间处在哪个状态？」  
答：教程步骤阅读 / 算法运行回放 / 设置里同步与 AI 配置。登录注册是**一次性门禁**，不是日常态。

---

## Grounding

已有明确信号（非 5-Direction Picker）：

1. 产品：开发者个人工作台（教程 + 算法可视化 + AI）  
2. 痛点 A：登录/注册挤在 AppShell 内，像「侧栏里的一个面板」  
3. 痛点 B：主题切换后文字对比不足（浅色下 muted/代码区/克隆层）  
4. 约束：功能冻结，只重构视觉与信息架构壳层  

**假设**：门禁页采用「全屏 Auth Stage」——无主导航、居中单栏、品牌条极简；工作台内继续 Convention IDE，不把门禁做成营销落地页。  
**刻意推迟**：品牌插画/插图、引导 onboarding 多步向导。

---

## DESIGN.md 增量（覆盖 §7.2 / §7.3 相关段）

### A. 令牌修订（主题可读性强制）

问题根因：浅色主题下部分文字/描边与底色对比不足；切换瞬间克隆层变量未完全对齐。

```
对比度硬约束（WCAG）
  正文 text on ink-950 / panel     ≥ 4.5:1
  次要 text-muted on panel         ≥ 4.5:1（禁止仅靠 opacity 压到 3:1 以下）
  text-subtle 仅用于装饰/元信息，且 ≥ 3:1
  焦点环 focus 对相邻底色          ≥ 3:1
  禁用态：opacity 0.55 + 保持可读字号，禁止再叠一层灰字

Dark（收紧）
  --ink-950 #0B1220
  --ink-900 #111827
  --ink-800 #1F2937
  --line    #374151
  --text    #F9FAFB
  --text-muted #D1D5DB      # 从 #94A3B8 提亮，保证面板上 ≥4.5
  --text-subtle #9CA3AF
  --accent  #60A5FA
  --accent-fg #0B1220       # 蓝底上的字色
  --signal  #34D399
  --panel   #111827
  --canvas  #030712

Light（收紧）
  --ink-950 #F3F4F6
  --ink-900 #FFFFFF
  --ink-800 #F9FAFB
  --line    #D1D5DB
  --text    #111827
  --text-muted #4B5563      # 禁止 #94A3B8 类灰
  --text-subtle #6B7280
  --accent  #1D4ED8
  --accent-fg #FFFFFF
  --signal  #047857
  --panel   #FFFFFF
  --canvas  #E5E7EB
  --focus   #1D4ED8

规则
  · 禁止在浅色主题使用「深色专用的高饱和荧光」作正文色
  · 代码区/编辑器：背景 --canvas，字 --text，关键字用 token 色而非继承 muted
  · 主题切换：克隆层必须复制完整 token 块（已实现）；禁止只换 body background
  · Radial 扩散期间禁止降低 opacity 到 <0.92 的「闪灰」
```

### B. 路由壳层（功能不变，壳变）

| 路由 | 壳 | 说明 |
|------|----|------|
| `/login` `/register` `/forgot-password` | **AuthLayout**（独立） | 无侧栏、无顶栏工作导航 |
| `/` `/tutorials/*` `/algorithms` `/ai` `/settings` | **AppShell** | 现有 IDE 壳，视觉重绘 |

AuthLayout 不读 flush handle；AppShell 不再包 auth 子路由。

### C. 字体与密度（微调）

```
TYPE  ui 14/1.5；页标题 20/650；Auth 标题 24/700
      mono 13；行高 1.55
SPACE 4 / 8 / 12 / 16 / 24 / 32
RADIUS 6（控件）/ 10（面板）/ 999（chip）
```

---

## Structure（按页）

### 1. Auth Stage（登录 / 注册 / 找回密码）

```
┌─────────────────────────────────────────────────────────┐
│  [WT] Worktable                    明暗切换（小）          │
│                                                         │
│              ┌─────────────────────────┐                │
│              │  标题 + 一句说明          │                │
│              │  表单字段（单栏 360–400）  │                │
│              │  主按钮（全宽）           │                │
│              │  次链接：注册/忘记/游客    │                │
│              └─────────────────────────┘                │
│  底部：本地优先 · 隐私说明（极小 muted）                   │
└─────────────────────────────────────────────────────────┘
```

- 背景：`--ink-950` 实色 + 可选 1px 细网格纹理（低对比，禁止渐变大块）  
- 卡片：`--panel`，单列，**无**六宫格功能介绍  
- 错误：卡片内 role=alert，danger 字 + 左侧 2px 竖线  
- 移动：卡片贴边 16px，主按钮高 44  

### 2. AppShell（工作台）

```
侧栏 208px 深/浅 panel-2
  品牌 一行
  导航 5 项，active = accent 软底 + 左 2px 指示条（不用大色块）
  底部 版本
顶栏 48px
  面包屑/标题 | 未保存点 | 登录态（邮箱或「登录」） | 主题
主区 flex
```

- 侧栏文字 `--text-muted`，active `--text`  
- 顶栏与主区分界仅 `1px --line`，无阴影堆叠  

### 3. 教程学习

- 三栏可拖（保持）  
- 步骤列表：当前步 `accent` 左条 + `text`；完成 `signal` 序号；未读 `muted`  
- 讲解区 `--panel`，正文 16  
- Diff：增删背景与前景成对出现，禁止只靠底色  
- 底栏 Stepper：轨道 `--line`，完成 `--signal`，当前 `--accent`  

### 4. 算法实验室

- 左列表 / 中可视化 / 右编辑器  
- 语言 Chip：选中 `accent-soft` + 边框 accent，字 `--text`  
- 播放条图标按钮：≥32px，tooltip 必备  
- 错误条：页内，不挡播放器  

### 5. 设置

- 竖向 panel 栈，标题 + 一句 muted  
- 开关组 Ripple 保持  
- 账号/同步/AI 分区，主操作仅各 1 个 filled  

### 6. AI 悬浮窗

- 右下默认，可拖  
- 标题栏 `--panel-2`，消息区 `--panel`  
- 用户气泡 accent 底 + **accent-fg** 文字（保证浅色下可读）  

---

## Decision Trace

```json
[
  {
    "decision": "登录/注册/找回改为独立 AuthLayout，不挂 AppShell",
    "reason": "门禁是低频任务，嵌在 IDE 侧栏会误读为「设置里的一个功能」",
    "alternatives": ["AppShell 下半屏模态", "保留侧栏仅隐藏导航"],
    "tradeoff": "多一个布局组件；游客从工作台跳登录会离开当前页（可用 returnTo 缓解，本版不做）"
  },
  {
    "decision": "浅色主题 text-muted 提到 #4B5563，禁止用 #94A3B8",
    "reason": "用户明确反馈主题切换后文字不清；#94A3B8 在白底约 2.8:1",
    "alternatives": ["只加大字号", "浅色强制深色代码区"],
    "tradeoff": "浅色界面「更实」，少了灰度层次，靠字重与间距补层次"
  },
  {
    "decision": "为主题切换保留 Radial 扩散，但限制最低不透明度 0.92",
    "reason": "保留签名交互，避免扩散期整体发灰导致「字糊」",
    "alternatives": ["去掉动画只瞬时换肤", "View Transition 默认时长"],
    "tradeoff": "扩散对比略弱，但仍可感知圆心扩张"
  },
  {
    "decision": "Auth 页不做营销 Hero / 功能九宫格",
    "reason": "工作台是工具；门禁页唯一任务是完成登录",
    "alternatives": ["产品介绍左栏 + 表单右栏"],
    "tradeoff": "首屏品牌感弱，用 WT 标与字体承担识别"
  },
  {
    "decision": "编辑器/代码区颜色改为 token 驱动，浅色用浅灰底深字",
    "reason": "主题切换后编辑器若仍近黑底，与整页浅色割裂且对比抖动",
    "alternatives": ["浅色也保持 OLED 黑编辑器"],
    "tradeoff": "浅色下代码语法色需重映射，工作量增加"
  },
  {
    "decision": "功能零改动，只动壳层与样式层",
    "reason": "用户明确「功能不要改变」",
    "alternatives": ["顺手合并设置项", "改同步策略"],
    "tradeoff": "部分结构债（如 AI 页 flush）延后"
  }
]
```

---

## Anti-slop self-check

| 模式 | 状态 |
|------|------|
| U1 渐变 Hero | 未使用；Auth 为实色 + 细网格可选 |
| U2 圆角卡片六宫格 | Auth 单卡；概览保持 3 功能入口（业务导航非装饰墙） |
| U3 Emoji 图标 | 侧栏已用 SVG；继续禁止 emoji 装饰 |
| U4 等距插画 | 无 |
| U5 悬浮统计三连 | 无 |
| U6 全是实心主按钮 | Auth 每步 1 个 primary；其余 ghost/text |
| U7 空洞文案 | Auth 文案具体：「登录后同步云端」 |
| U8 破折号滥用 | 文案避免 |

**结论**：clean（Auth 不做营销页为有意约束，已 Decision Trace）。

---

## 实现清单（编码阶段按序）

1. **P0 可读性**  
   - 重写 `tokens.css` 双主题对比  
   - 审计 `text-muted`/`text-subtle` 使用处  
   - CodeEditor 主题跟 token  
   - AI 气泡字色 accent-fg  

2. **P0 AuthLayout**  
   - `layouts/AuthLayout.tsx`  
   - 路由 `/login` `/register` `/forgot-password` 改挂 AuthLayout  
   - AppShell 移除 auth 子路由  
   - Auth 页视觉重绘（卡片、间距、错误态）  

3. **P1 AppShell 视觉**  
   - 侧栏 active 指示条、顶栏账号区、导航 SVG 统一 16px  

4. **P1 教程/算法/设置/AI**  
   - 按 Structure 校正对比与控件尺寸  
   - 不改交互逻辑  

5. **P2 验收**  
   - 双主题截图对比  
   - Playwright：contrast 抽样、Auth 无侧栏、功能冒烟回归  

---

## 验收标准

- [ ] `/login` 无 `.app-shell__nav`  
- [ ] 浅色/深色下正文与 muted 抽样 ≥ 4.5:1  
- [ ] 主题切换后 200ms 内文字仍可辨（无整页灰蒙）  
- [ ] 教程/算法/AI/设置/同步/忘记密码功能回归通过  
- [ ] 无新增功能入口  

---

## 执行说明

本文件为蓝图；**下一步编码**以本文件 + `DESIGN.md` §7 为唯一视觉来源。  
实现时优先 P0，再 P1；每完成一页跑一次主题双态截图。
