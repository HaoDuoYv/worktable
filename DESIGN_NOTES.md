# DESIGN NOTES — Worktable

## v1.1 (2026-09-14)

- 按用户要求将 UI/交互对齐两份规范：
  - `frontend-design`：Convention 为主，签名只留给可视化画布
  - `advanced-interaction-design`：10 模式中 v1 选 8 个场景，明确主/辅与降级
- 避免默认 AI 风：不做近黑+酸绿撞色堆砌、不做奶油+衬线营销风、不做无意义卡片墙
- 令牌从自由变量改为命名系统（ink-950/900/800、accent、signal、focus）
- 签名时刻定义为「命令回放光标」——画布与代码行同步高亮 160ms

## 下轮编码注意

1. 先落 CSS 变量与四态组件，再写业务页
2. Disclosure / Stepper / Chip 三个组件复用度最高，优先
3. 播放器是业务控件，不要硬套 10 模式
4. 改 UI 前先读本文件 + DESIGN.md §7

## 交互增强（advanced-interaction-design）

- §3 Staggered Bulk Selection：算法库多选 + 全选，勾选 pop 动画
- §6 Spring Stepper：当前段 scaleX 过冲再回弹
- §7 Ripple Feedback：设置开关组，邻居仅视觉涟漪
- §8 Curved Card Deletion：删除前曲线飞向回收区，动画结束再删数据
- §10 Expanding Tag：Chip 选中 scale(1.06)
- 冒烟：scripts/smoke-interactions.mjs
