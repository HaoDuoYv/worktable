# Worktable 云端 API

账号注册（邮箱验证码）、登录、云端快照同步。

## 快速开始

```bash
cd server
cp .env.example .env
# 编辑 .env：JWT_SECRET、SMTP_*（授权码）
npm install
npm run dev
```

开发未配 SMTP 时：`DEV_FAKE_MAIL=true`，验证码打印在控制台，并在响应里返回 `devCode`。

## 邮箱授权码

- QQ 邮箱：设置 → 账户 → 开启 SMTP → 生成授权码 → `SMTP_PASS`
- 163：类似，SMTP 服务器 `smtp.163.com`

## API

见 `docs/CLOUD_SYNC_PLAN.md` §3–§4。

## Docker 部署

```bash
cd server
cp .env.example .env   # 填写 JWT_SECRET、SMTP_*
docker compose up -d --build
curl http://127.0.0.1:8788/health
```

- 数据持久化：`./data/worktable.json`（compose 挂载 `./data`）
- 生产必须设置强随机 `JWT_SECRET`，并按前端域名配置 `CORS_ORIGIN`
- 桌面端 Origin `http://127.0.0.1:*` 由服务端 CORS 自动放行
- 停止：`docker compose down`；看日志：`docker compose logs -f api`

