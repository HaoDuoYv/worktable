# 云端保存方案 · 实施计划

> 状态：计划 → 实施  
> 标准：可实际上线（鉴权、验证码、同步、安全基线）  
> 邮箱 SMTP 授权码：由用户后续填入 `.env`

---

## 1. 目标

| 角色 | 数据位置 | 能力 |
|------|----------|------|
| **游客** | 仅浏览器 IndexedDB / localStorage | 学习、算法、AI 配置（本地） |
| **注册用户** | 云端账号 + 云同步快照 | 本地数据可上传云端；换设备登录后拉取 |

不在范围（v1）：多人协作、实时同步、OAuth 第三方登录、对象存储附件。

---

## 2. 总体架构

```
┌─────────────────────────────────────────────┐
│  Worktable SPA (React)                      │
│  · 游客：直接读写 IndexedDB                 │
│  · 用户：AccessToken + 同步编排             │
└──────────────────┬──────────────────────────┘
                   │ HTTPS / JSON
┌──────────────────▼──────────────────────────┐
│  server/  Node + Express                    │
│  · /api/auth  注册·验证码·登录·刷新         │
│  · /api/sync  拉取快照 / 推送快照 / 元数据   │
│  · /api/me    资料                          │
│  SQLite (better-sqlite3)                    │
│  SMTP (nodemailer) 发验证码                 │
└─────────────────────────────────────────────┘
```

- 前端：现有 Vite SPA  
- 后端：新建 `server/`（与 `server-cpp` 并列）  
- 存储：`server/data/worktable.db`（SQLite，可备份）  
- 邮件：SMTP + 授权码（用户配置）

---

## 3. 账号与鉴权

### 3.1 注册流程（邮箱 + 验证码）

1. `POST /api/auth/send-code` `{ email, purpose: "register"|"reset" }`  
   - 频率限制：同邮箱 60s 一次，同 IP 20/小时  
   - 生成 6 位数字码，TTL 10 分钟，存哈希  
   - SMTP 发送（失败则 502 + 明确文案）  
2. `POST /api/auth/register` `{ email, password, code }`  
   - 校验码、邮箱唯一  
   - 密码 bcrypt（cost 12）  
   - 返回用户 + tokens  
3. `POST /api/auth/login` `{ email, password }`  
4. `POST /api/auth/refresh` `{ refreshToken }` → 新 access  
5. `POST /api/auth/logout` 吊销 refresh  

### 3.2 Token

| Token | 有效期 | 存储 |
|-------|--------|------|
| Access JWT | 15 min | 内存 / sessionStorage（前端） |
| Refresh | 30 天 | httpOnly Cookie（生产）或 localStorage（开发可配） |

JWT payload：`{ sub: userId, email }`，HS256，`JWT_SECRET` 环境变量。

### 3.3 密码

- 最少 8 位，建议含字母+数字  
- bcrypt 哈希，永不存明文  
- 登录失败统一提示「邮箱或密码错误」

---

## 4. 同步模型

### 4.1 快照（Snapshot）

一次同步 = 一份完整 JSON 快照（简单、可回滚）：

```json
{
  "schemaVersion": 1,
  "updatedAt": 1710000000000,
  "device": "chrome-win",
  "payload": {
    "tutorials": [...],
    "tutorialNotes": [...],
    "algorithms": [...],
    "chatSessions": [...],
    "preferences": { "theme": "dark", "density": "comfortable" }
  }
}
```

不含：AI apiKey、refreshToken、密码。

### 4.2 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sync/snapshot` | 拉取最新云端快照 + meta |
| PUT | `/api/sync/snapshot` | 上传完整快照（覆盖式） |
| GET | `/api/sync/meta` | `{ updatedAt, size, device }` |
| DELETE | `/api/sync/snapshot` | 清空云端数据 |

冲突策略 v1：**Last-Write-Wins**，客户端在上传前提示「将覆盖云端」；拉取前提示「将覆盖本地」。

### 4.3 客户端编排

```
游客 ──注册成功──► 可选「上传本地数据」
游客 ──登录已有账号──► 提示「拉取云端 / 保留本地并上传」
登录中 ──手动「同步到云端」──► PUT snapshot
登录中 ──手动「从云端恢复」──► 确认后 merge/replace 本地
```

自动同步：设置项 `autoSync`（默认关），在算法保存/教程进度后 debounce 上传。

---

## 5. 数据表（SQLite）

```sql
users(id, email UNIQUE, password_hash, display_name, created_at, updated_at)
verification_codes(id, email, purpose, code_hash, expires_at, used_at, created_at)
refresh_tokens(id, user_id, token_hash, expires_at, revoked_at, created_at)
sync_snapshots(user_id PK, payload TEXT, schema_version, device, updated_at)
audit_log(id, user_id, action, ip, created_at)
```

---

## 6. 前端模块

```
src/modules/auth/
  types.ts
  api.ts          # fetch 封装 + token 刷新
  AuthContext.tsx # session / guest / login / logout
  LoginPage.tsx
  RegisterPage.tsx
  AuthModal.tsx   # 可选：内嵌登录
src/modules/sync/
  syncService.ts  # 导出/导入 IndexedDB ↔ 快照
  SyncPanel.tsx   # 设置页区块
```

路由：

- `/login` `/register`  
- 设置页：账号区 + 同步区  

侧栏/顶栏：游客显示「登录」；已登录显示邮箱 + 同步状态。

---

## 7. 安全与上线清单

- [ ] `JWT_SECRET`、`SMTP_*`、`CORS_ORIGIN` 仅环境变量  
- [ ] Helmet、限流（express-rate-limit）  
- [ ] 验证码哈希存储、一次性、TTL  
- [ ] 注册/登录/发码限流  
- [ ] HTTPS 反代（生产 Nginx）  
- [ ] SQLite 定期备份  
- [ ] 日志不含密码/验证码明文  
- [ ] 前端不把 apiKey 写入云端快照  
- [ ] `npm audit`、依赖锁定  

---

## 8. 配置（.env.example）

```env
PORT=8788
JWT_SECRET=change-me-long-random
ACCESS_TTL=15m
REFRESH_TTL_DAYS=30
DB_PATH=./data/worktable.db
CORS_ORIGIN=http://localhost:5173

# 邮箱（用户填授权码）
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@qq.com
SMTP_PASS=your-auth-code
MAIL_FROM=Worktable <you@qq.com>
```

QQ/163 等需在邮箱设置里开启 SMTP 并生成**授权码**，填入 `SMTP_PASS`。

---

## 9. 实施顺序

| 阶段 | 内容 | 验收 |
|------|------|------|
| P1 计划 | 本文档 | 用户确认 |
| P2 后端骨架 | Express + SQLite + /health | 启动、建表 |
| P3 邮件验证码 | send-code + 注册 | 配好 SMTP 可收到信 |
| P4 登录 Token | login/refresh/me | JWT 可用 |
| P5 同步 API | snapshot GET/PUT | curl 往返 |
| P6 前端鉴权 | 游客/登录/注册页 | 流程通 |
| P7 前端同步 | 导出导入 + UI | 本地↔云端 |
| P8 加固 | 限流、helmet、README | 上线清单勾选 |

---

## 10. 风险

| 风险 | 缓解 |
|------|------|
| SMTP 发信失败 | 明确错误；支持控制台验证码 DEV 模式 |
| 快照过大 | 限制 2MB；压缩 gzip 可选 |
| Token 被盗 | 短 access + 可吊销 refresh |
| 冲突丢数据 | 操作前二次确认；可选导出 JSON 备份 |
| 未配 SMTP | 注册不可用，游客模式仍完整 |

---

## 11. 用户待办

1. 在邮箱服务商开启 SMTP，生成**授权码**  
2. 复制 `server/.env.example` → `server/.env`，填写 `SMTP_*` 与 `JWT_SECRET`  
3. `cd server && npm i && npm run dev`  
4. 前端设置页指向 API：默认 `http://127.0.0.1:8788`
