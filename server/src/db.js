import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'

/**
 * 轻量 JSON 文件库（无原生依赖，Windows 友好）。
 * 生产可换 SQLite/Postgres，接口保持一致。
 */

const file = config.dbPath.replace(/\.db$/, '.json')
fs.mkdirSync(path.dirname(file), { recursive: true })

let data = {
  users: [],
  verification_codes: [],
  refresh_tokens: [],
  sync_snapshots: {},
  audit_log: [],
}

if (fs.existsSync(file)) {
  try {
    data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) }
  } catch (e) {
    console.error('db file corrupt, starting empty', e.message)
  }
}

let saveTimer = null
function persist() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data), 'utf8')
    fs.renameSync(tmp, file)
  }, 50)
}

function persistNow() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8')
  fs.renameSync(tmp, file)
}

process.on('exit', persistNow)

export const store = {
  get users() {
    return data.users
  },
  get codes() {
    return data.verification_codes
  },
  get tokens() {
    return data.refresh_tokens
  },
  get snapshots() {
    return data.sync_snapshots
  },
  findUserByEmail(email) {
    const e = String(email).toLowerCase()
    return data.users.find((u) => u.email === e)
  },
  findUserById(id) {
    return data.users.find((u) => u.id === id)
  },
  insertUser(user) {
    data.users.push(user)
    persist()
    return user
  },
  updateUserPassword(userId, passwordHash) {
    const u = data.users.find((x) => x.id === userId)
    if (!u) return null
    u.password_hash = passwordHash
    u.updated_at = Date.now()
    persist()
    return u
  },
  revokeAllTokensForUser(userId) {
    const t = Date.now()
    for (const tok of data.refresh_tokens) {
      if (tok.user_id === userId && !tok.revoked_at) tok.revoked_at = t
    }
    persist()
  },
  insertCode(row) {
    data.verification_codes.push(row)
    persist()
    return row
  },
  latestUnusedCode(email, purpose) {
    const list = data.verification_codes
      .filter(
        (c) =>
          c.email === String(email).toLowerCase() &&
          c.purpose === purpose &&
          !c.used_at &&
          c.expires_at > Date.now(),
      )
      .sort((a, b) => b.created_at - a.created_at)
    return list[0] || null
  },
  markCodeUsed(id) {
    const c = data.verification_codes.find((x) => x.id === id)
    if (c) {
      c.used_at = Date.now()
      persist()
    }
  },
  insertToken(row) {
    data.refresh_tokens.push(row)
    persist()
    return row
  },
  findTokenByHash(hash) {
    return data.refresh_tokens.find(
      (t) => t.token_hash === hash && !t.revoked_at && t.expires_at > Date.now(),
    )
  },
  revokeTokenByHash(hash) {
    const t = data.refresh_tokens.find((x) => x.token_hash === hash && !x.revoked_at)
    if (t) {
      t.revoked_at = Date.now()
      persist()
    }
  },
  revokeTokenById(id) {
    const t = data.refresh_tokens.find((x) => x.id === id)
    if (t) {
      t.revoked_at = Date.now()
      persist()
    }
  },
  getSnapshot(userId) {
    return data.sync_snapshots[userId] || null
  },
  setSnapshot(userId, snap) {
    data.sync_snapshots[userId] = snap
    persist()
  },
  deleteSnapshot(userId) {
    delete data.sync_snapshots[userId]
    persist()
  },
  audit(row) {
    data.audit_log.push(row)
    if (data.audit_log.length > 5000) data.audit_log = data.audit_log.slice(-3000)
    persist()
  },
  file,
}
