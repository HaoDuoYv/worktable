import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { store } from './db.js'

export function now() {
  return Date.now()
}

export function id(prefix = '') {
  return `${prefix}${crypto.randomUUID()}`
}

export function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex')
}

export function randomCode6() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0')
}

export function hashPassword(pw) {
  return bcrypt.hashSync(pw, 12)
}

export function verifyPassword(pw, hash) {
  try {
    return bcrypt.compareSync(pw, hash)
  } catch {
    return false
  }
}

export function signAccess(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: config.accessTtl,
  })
}

export function verifyAccess(token) {
  return jwt.verify(token, config.jwtSecret)
}

export function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(48).toString('hex')
  const hash = sha256(raw)
  const expiresAt = now() + config.refreshTtlDays * 24 * 3600 * 1000
  store.insertToken({
    id: id('rt_'),
    user_id: userId,
    token_hash: hash,
    expires_at: expiresAt,
    revoked_at: null,
    created_at: now(),
  })
  return { raw, expiresAt }
}

export function rotateRefreshToken(raw) {
  const hash = sha256(raw)
  const row = store.findTokenByHash(hash)
  if (!row) return null
  store.revokeTokenById(row.id)
  const user = store.findUserById(row.user_id)
  if (!user) return null
  return { user, ...issueRefreshToken(user.id) }
}

export function revokeRefreshToken(raw) {
  store.revokeTokenByHash(sha256(raw))
}

export function audit(userId, action, ip) {
  store.audit({
    user_id: userId ?? null,
    action,
    ip: ip ?? null,
    created_at: now(),
  })
}

export function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name || u.email.split('@')[0],
    createdAt: u.created_at,
  }
}
