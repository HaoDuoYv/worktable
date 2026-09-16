import { Router } from 'express'
import { store } from './db.js'
import { audit, now } from './auth.js'
import { requireAuth } from './routesAuth.js'

const MAX_PAYLOAD = 2 * 1024 * 1024

export function syncRouter() {
  const r = Router()
  r.use(requireAuth)

  r.get('/meta', (req, res) => {
    const row = store.getSnapshot(req.userId)
    if (!row) return res.json({ exists: false })
    res.json({
      exists: true,
      schemaVersion: row.schema_version,
      device: row.device,
      updatedAt: row.updated_at,
      size: row.size,
    })
  })

  r.get('/snapshot', (req, res) => {
    const row = store.getSnapshot(req.userId)
    if (!row) return res.status(404).json({ error: '云端暂无数据' })
    res.json({
      schemaVersion: row.schema_version,
      device: row.device,
      updatedAt: row.updated_at,
      payload: row.payload,
    })
  })

  r.put('/snapshot', (req, res) => {
    const body = req.body
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: '请求体无效' })
    }
    const payload = body.payload ?? body
    const device = String(body.device || req.headers['x-device'] || 'unknown').slice(0, 64)
    const schemaVersion = Number(body.schemaVersion || payload?.schemaVersion || 1)

    let text
    try {
      text = JSON.stringify(payload)
    } catch {
      return res.status(400).json({ error: 'payload 无法序列化' })
    }
    if (text.length > MAX_PAYLOAD) {
      return res.status(413).json({ error: '快照超过 2MB，请精简后再同步' })
    }

    const t = now()
    store.setSnapshot(req.userId, {
      payload,
      schema_version: schemaVersion,
      device,
      updated_at: t,
      size: text.length,
    })
    audit(req.userId, 'sync_upload', req.ip)
    res.json({ ok: true, updatedAt: t, size: text.length })
  })

  r.delete('/snapshot', (req, res) => {
    store.deleteSnapshot(req.userId)
    audit(req.userId, 'sync_clear', req.ip)
    res.json({ ok: true })
  })

  return r
}
