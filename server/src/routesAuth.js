import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { store } from './db.js'
import { config } from './config.js'
import { sendVerificationEmail, smtpConfigured } from './mailer.js'
import {
  audit,
  hashPassword,
  id,
  issueRefreshToken,
  now,
  publicUser,
  randomCode6,
  revokeRefreshToken,
  rotateRefreshToken,
  sha256,
  signAccess,
  verifyAccess,
  verifyPassword,
} from './auth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function authRouter() {
  const r = Router()

  const sendCodeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '发送过于频繁，请 60 秒后再试' },
  })
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '尝试过于频繁，请稍后再试' },
  })

  r.get('/health', (_req, res) => {
    res.json({
      ok: true,
      smtpConfigured: smtpConfigured(),
      devFakeMail: config.devFakeMail,
    })
  })

  r.post('/send-code', sendCodeLimiter, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const purpose = String(req.body?.purpose || 'register')
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: '邮箱格式不正确' })
    if (!['register', 'reset'].includes(purpose)) {
      return res.status(400).json({ error: 'purpose 无效' })
    }

    const existing = store.findUserByEmail(email)
    if (purpose === 'register' && existing) {
      return res.status(409).json({ error: '该邮箱已注册，请直接登录' })
    }
    if (purpose === 'reset' && !existing) {
      return res.status(404).json({ error: '该邮箱未注册' })
    }

    const code = randomCode6()
    store.insertCode({
      id: id('vc_'),
      email,
      purpose,
      code_hash: sha256(code),
      expires_at: now() + 10 * 60 * 1000,
      used_at: null,
      created_at: now(),
    })

    try {
      const result = await sendVerificationEmail(email, code, purpose)
      audit(null, `send_code:${purpose}`, req.ip)
      return res.json({
        ok: true,
        devCode: result.dev ? code : undefined,
      })
    } catch (e) {
      console.error('send mail failed', e.message)
      return res.status(502).json({
        error: e.message || '邮件发送失败，请检查 SMTP 配置与授权码',
      })
    }
  })

  r.post('/register', authLimiter, (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const code = String(req.body?.code || '').trim()

    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: '邮箱格式不正确' })
    if (password.length < 8) return res.status(400).json({ error: '密码至少 8 位' })
    if (!/^[0-9]{6}$/.test(code)) return res.status(400).json({ error: '验证码为 6 位数字' })
    if (store.findUserByEmail(email)) return res.status(409).json({ error: '该邮箱已注册' })

    const vc = store.latestUnusedCode(email, 'register')
    if (!vc || vc.code_hash !== sha256(code)) {
      return res.status(400).json({ error: '验证码错误或已过期' })
    }
    store.markCodeUsed(vc.id)

    const uid = id('usr_')
    const t = now()
    store.insertUser({
      id: uid,
      email,
      password_hash: hashPassword(password),
      display_name: email.split('@')[0],
      created_at: t,
      updated_at: t,
    })

    const user = store.findUserById(uid)
    const refresh = issueRefreshToken(uid)
    audit(uid, 'register', req.ip)
    res.json({
      user: publicUser(user),
      accessToken: signAccess(user),
      refreshToken: refresh.raw,
      refreshExpiresAt: refresh.expiresAt,
    })
  })

  /** 忘记密码：邮箱 + 验证码 + 新密码 */
  r.post('/reset-password', authLimiter, (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const code = String(req.body?.code || '').trim()

    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: '邮箱格式不正确' })
    if (password.length < 8) return res.status(400).json({ error: '密码至少 8 位' })
    if (!/^[0-9]{6}$/.test(code)) return res.status(400).json({ error: '验证码为 6 位数字' })

    const user = store.findUserByEmail(email)
    if (!user) {
      // 不暴露是否注册；但 send-code 已区分，这里仍返回统一错误
      return res.status(400).json({ error: '验证码错误或已过期' })
    }

    const vc = store.latestUnusedCode(email, 'reset')
    if (!vc || vc.code_hash !== sha256(code)) {
      return res.status(400).json({ error: '验证码错误或已过期' })
    }
    store.markCodeUsed(vc.id)
    store.updateUserPassword(user.id, hashPassword(password))
    // 重置后吊销全部会话
    store.revokeAllTokensForUser(user.id)
    audit(user.id, 'reset_password', req.ip)

    res.json({ ok: true, message: '密码已重置，请使用新密码登录' })
  })

  r.post('/login', authLimiter, (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const user = store.findUserByEmail(email)
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: '邮箱或密码错误' })
    }
    const refresh = issueRefreshToken(user.id)
    audit(user.id, 'login', req.ip)
    res.json({
      user: publicUser(user),
      accessToken: signAccess(user),
      refreshToken: refresh.raw,
      refreshExpiresAt: refresh.expiresAt,
    })
  })

  r.post('/refresh', (req, res) => {
    const raw = String(req.body?.refreshToken || '')
    if (!raw) return res.status(400).json({ error: '缺少 refreshToken' })
    const rotated = rotateRefreshToken(raw)
    if (!rotated) return res.status(401).json({ error: '登录已失效，请重新登录' })
    res.json({
      user: publicUser(rotated.user),
      accessToken: signAccess(rotated.user),
      refreshToken: rotated.raw,
      refreshExpiresAt: rotated.expiresAt,
    })
  })

  r.post('/logout', (req, res) => {
    const raw = String(req.body?.refreshToken || '')
    if (raw) revokeRefreshToken(raw)
    res.json({ ok: true })
  })

  r.get('/me', (req, res) => {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) return res.status(401).json({ error: '未登录' })
    try {
      const payload = verifyAccess(token)
      const user = store.findUserById(payload.sub)
      if (!user) return res.status(401).json({ error: '用户不存在' })
      res.json({ user: publicUser(user) })
    } catch {
      return res.status(401).json({ error: '登录已过期' })
    }
  })

  return r
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ error: '未登录' })
  try {
    const payload = verifyAccess(token)
    req.userId = payload.sub
    req.userEmail = payload.email
    next()
  } catch {
    return res.status(401).json({ error: '登录已过期' })
  }
}
