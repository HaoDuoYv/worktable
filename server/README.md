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
