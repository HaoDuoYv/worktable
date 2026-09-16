import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuth } from '@/modules/auth/AuthContext'
import { cloudMeta, pullFromCloud, pushToCloud } from './syncService'

export function AccountPanel() {
  const { user, isGuest, logout } = useAuth()
  return (
    <section className="panel">
      <h2 className="panel__title">账号</h2>
      {isGuest ? (
        <>
          <p className="panel__text">
            当前为<strong>游客模式</strong>，数据只存在本机浏览器。注册/登录后可云端同步。
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Link to="/login">
              <Button variant="primary">登录</Button>
            </Link>
            <Link to="/register">
              <Button variant="ghost">注册</Button>
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="panel__text">
            已登录：<strong>{user?.email}</strong>
          </p>
          <div style={{ marginTop: 12 }}>
            <Button variant="ghost" onClick={() => void logout()}>
              退出登录
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

export function SyncPanel() {
  const { user, isGuest, session, setSession } = useAuth()
  const [meta, setMeta] = useState<{ exists: boolean; updatedAt?: number; size?: number } | null>(
    null,
  )
  const [busy, setBusy] = useState<'push' | 'pull' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshMeta = useCallback(async () => {
    if (isGuest || !session) {
      setMeta(null)
      return
    }
    try {
      const m = await cloudMeta(setSession)
      setMeta(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取云端状态失败')
    }
  }, [isGuest, session, setSession])

  useEffect(() => {
    void refreshMeta()
  }, [refreshMeta])

  const onPush = async () => {
    setBusy('push')
    setError(null)
    setMsg(null)
    try {
      const res = await pushToCloud(setSession)
      setMsg(`已上传云端（${Math.round((res.size || 0) / 1024)} KB）`)
      await refreshMeta()
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败')
    } finally {
      setBusy(null)
    }
  }

  const onPull = async () => {
    if (!window.confirm('将用云端数据覆盖本机教程/算法/备注，继续？')) return
    setBusy('pull')
    setError(null)
    setMsg(null)
    try {
      const snap = await pullFromCloud(setSession)
      setMsg(`已从云端恢复（${new Date(snap.updatedAt).toLocaleString()}）`)
      await refreshMeta()
    } catch (e) {
      setError(e instanceof Error ? e.message : '拉取失败')
    } finally {
      setBusy(null)
    }
  }

  if (isGuest) {
    return (
      <section className="panel">
        <h2 className="panel__title">云端同步</h2>
        <p className="panel__text">登录后可上传/拉取云端快照。游客数据仅在本机。</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <h2 className="panel__title">云端同步</h2>
      <p className="panel__text">
        {meta?.exists
          ? `云端快照：${new Date(meta.updatedAt || 0).toLocaleString()}${
              meta.size ? ` · ${Math.round(meta.size / 1024)} KB` : ''
            }`
          : '云端暂无快照'}
      </p>
      <p className="panel__text" style={{ marginTop: 6 }}>
        账号 <strong>{user?.email}</strong> · 不含 API Key
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button variant="primary" busy={busy === 'push'} onClick={() => void onPush()}>
          同步到云端
        </Button>
        <Button variant="ghost" busy={busy === 'pull'} disabled={!meta?.exists} onClick={() => void onPull()}>
          从云端恢复
        </Button>
        <Button variant="ghost" onClick={() => void refreshMeta()}>
          刷新状态
        </Button>
      </div>
      {msg ? (
        <p className="auth-info" role="status">
          {msg}
        </p>
      ) : null}
      {error ? (
        <div className="algo-lab__error" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  )
}
