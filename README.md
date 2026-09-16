# Worktable · 个人学习工作台

本地优先的个人学习工作台：**教程学习 · 算法可视化 · AI 助手 · 多语言运行时**。  
数据默认存在浏览器 IndexedDB；可选启动本地云端同步 API；Windows 提供 Electron 便携版，内置 C++ 运行服务。

## 功能

| 模块 | 说明 |
|------|------|
| 概览 | 工作区入口与状态 |
| 教程 | 三栏阅读（目录 / 正文 / 备注），进度与笔记本地保存 |
| 算法实验室 | JS / Python / C++ 可视化回放；算法库 CRUD、收藏、导入导出 |
| AI 助手 | OpenAI 兼容接口（DeepSeek / Ollama 等）；可静默把源码转成可视化代码 |
| 账号与同步 | 邮箱注册 + 验证码；登录后上传 / 拉取云端快照（可选） |
| 桌面版 | Electron 窗口 + 内嵌本地 C++ 服务（调用本机 g++ / clang++） |

## 快速开始

### 开发（浏览器）

```bash
npm install
npm run dev
```

打开 http://localhost:5173

### 构建

```bash
npm run build
npm run preview
```

### Windows 桌面版

```bash
npm install
npm run electron:build     # 产出 release/Worktable-0.1.0-portable.exe
npm run electron:start     # 本地试跑（需先 build）
```

- 桌面版会内置启动 C++ 服务（默认 `http://127.0.0.1:8787`）。
- 编译器需本机已安装（MinGW-w64 或 LLVM）。未加入 PATH 时，在 **设置 → C++ 运行** 填写完整路径，例如 `C:\mingw64\bin\g++.exe`。
- 环境变量：`WORKTABLE_CXX_PATH`、`WORKTABLE_CXX`（`g++`|`clang++`）、`WORKTABLE_CPP_PORT`。
- 可视化头文件源：`server-cpp/av.h`。

## 多语言算法

| 语言 | 运行方式 |
|------|----------|
| JavaScript | 浏览器 Worker，默认可用 |
| Python | Pyodide（首次运行会下载运行时） |
| C++ | 本机 `g++` / `clang++`；桌面版已内置服务，浏览器模式需自行启动 |

浏览器模式启动 C++ 服务：

```bash
npm run cpp
# 或 node server-cpp/index.mjs  →  http://127.0.0.1:8787
```

在 **设置 → C++ 运行** 可配置服务地址、首选编译器、编译器完整路径与超时。

## AI 配置

设置页填写 Base URL / API Key / 模型。示例：

- DeepSeek：`https://api.deepseek.com/v1` · `deepseek-chat`
- Ollama：`http://127.0.0.1:11434/v1` · `qwen2.5`

密钥仅保存在本机，不会写入同步快照。

## 云端同步（可选）

详见 [docs/CLOUD_SYNC_PLAN.md](./docs/CLOUD_SYNC_PLAN.md)。

```bash
# 1) 启动 API
cd server
cp .env.example .env   # 填写 JWT_SECRET、SMTP_*（授权码）
npm install
npm run dev            # http://127.0.0.1:8788

# 2) 前端
npm run dev            # http://localhost:5173
```

- 游客：仅本机 IndexedDB  
- 设置 → 账号 / 云端同步：登录后「同步到云端」「从云端恢复」  
- 未配 SMTP 时：`DEV_FAKE_MAIL=true`，注册页会显示开发验证码  

## 项目结构

```
worktable/
├── src/                 # React 前端（Vite + TypeScript）
│   ├── layouts/         # AppShell 外壳
│   ├── modules/         # 教程 / 算法 / AI / 设置 / 鉴权 / 同步
│   ├── core/            # 可视化引擎、JS/Python/C++ runner
│   ├── components/      # 通用 UI
│   └── styles/          # 设计 token 与主题
├── server/              # 可选云端 API（账号、同步、邮件）
├── server-cpp/          # 本地 C++ 可视化运行服务
├── electron/            # 桌面壳（内嵌 UI + C++ 服务）
├── public/tutorials/    # 教程 JSON
├── docs/                # 设计与规范文档
└── scripts/             # 冒烟与辅助脚本
```

## 设计文档

- [DESIGN.md](./DESIGN.md) — 产品与交互设计
- [docs/VIS_SPEC.md](./docs/VIS_SPEC.md) — 算法可视化协议
- [docs/UI_REDESIGN_BLUEPRINT.md](./docs/UI_REDESIGN_BLUEPRINT.md) — UI 重构蓝图
- [docs/CLOUD_SYNC_PLAN.md](./docs/CLOUD_SYNC_PLAN.md) — 云端同步方案

## 冒烟测试

```bash
node scripts/smoke-js-quick.mjs
node scripts/smoke-electron-cpp.mjs
# 更多见 scripts/smoke-*.mjs
```

## 技术栈

- 前端：React 18 · Vite 5 · TypeScript · React Router · CodeMirror 6
- 可视化：自研 AV 引擎 + algorithm-visualizer 协议子集
- Python：Pyodide（浏览器）
- C++：Node 本地 HTTP 服务 + g++/clang++
- 桌面：Electron 33 + electron-builder（portable / NSIS）
- 云端（可选）：Express + JSON 文件库 + JWT + nodemailer

## License

仅供个人学习使用。若需开源授权协议，可在仓库中补充 LICENSE。
