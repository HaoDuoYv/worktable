import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuth } from './AuthContext'
import { saveApiBase, loadApiBase } from './api'

function AuthHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="auth-header">
      <h1 className="auth-header__title">{title}</h1>
      {desc ? <p className="auth-header__desc">{desc}</p> : null}
    </div>
  )
}

function AuthError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="auth-error" role="alert">
      {message}
    </div>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [api, setApi] = useState(() => loadApiBase())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    saveApiBase(api)
    try {
      await login(email.trim(), password)
      nav('/settings')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AuthHeader title="登录" desc="登录后可将本地数据同步到云端，换设备拉取。" />
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-field">
          <span>API 地址</span>
          <input value={api} onChange={(e) => setApi(e.target.value)} placeholder="http://127.0.0.1:3000" />
        </label>
        <label className="auth-field">
          <span>邮箱</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="auth-field">
          <span>密码</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入密码"
          />
        </label>
        <AuthError message={error} />
        <Button type="submit" variant="primary" busy={busy} className="auth-submit">
          登录
        </Button>
        <p className="auth-links">
          <span className="auth-links__text">还没有账号？</span>
          <Link to="/register" className="auth-links__pill">邮箱注册</Link>
          <span className="auth-links__sep" aria-hidden="true" />
          <Link to="/forgot-password" className="auth-links__pill">忘记密码</Link>
          <span className="auth-links__sep" aria-hidden="true" />
          <Link to="/" className="auth-links__pill">以游客身份使用</Link>
        </p>
      </form>
    </>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [codeBusy, setCodeBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [api, setApi] = useState(() => loadApiBase())

  const sendCode = async () => {
    setCodeBusy(true)
    setError(null)
    setInfo(null)
    saveApiBase(api)
    try {
      const { sendCode: apiSend } = await import('./api')
      const res = await apiSend(email.trim(), 'register')
      if (res.devCode) {
        setDevCode(res.devCode)
        setInfo('本地验证码已生成（未配置邮件服务）')
      } else {
        setInfo('验证码已发送到邮箱，请查收')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败')
    } finally {
      setCodeBusy(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    saveApiBase(api)
    try {
      await register(email.trim(), password, code.trim())
      nav('/settings')
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AuthHeader title="注册" desc="邮箱 + 6 位验证码。密码至少 8 位。" />
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-field">
          <span>API 地址</span>
          <input value={api} onChange={(e) => setApi(e.target.value)} placeholder="http://127.0.0.1:3000" />
        </label>
        <label className="auth-field">
          <span>邮箱</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="auth-field">
          <span>密码（≥8 位）</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="设置密码"
          />
        </label>
        <div className="auth-field-row">
          <label className="auth-field" style={{ flex: 1 }}>
            <span>验证码</span>
            <input
              required
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="6 位数字"
            />
          </label>
          <Button type="button" variant="ghost" busy={codeBusy} onClick={() => void sendCode()}>
            发送验证码
          </Button>
        </div>
        {devCode ? (
          <p className="auth-devcode">本地验证码：{devCode}</p>
        ) : null}
        {info ? <p className="auth-info">{info}</p> : null}
        <AuthError message={error} />
        <Button type="submit" variant="primary" busy={busy} className="auth-submit">
          注册并登录
        </Button>
        <p className="auth-links">
          <span className="auth-links__text">已有账号？</span>
          <Link to="/login" className="auth-links__pill">登录</Link>
          <span className="auth-links__sep" aria-hidden="true" />
          <Link to="/forgot-password" className="auth-links__pill">忘记密码</Link>
          <span className="auth-links__sep" aria-hidden="true" />
          <Link to="/" className="auth-links__pill">游客使用</Link>
        </p>
      </form>
    </>
  )
}

export function ForgotPasswordPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [codeBusy, setCodeBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [api, setApi] = useState(() => loadApiBase())

  const sendResetCode = async () => {
    if (!email.trim()) {
      setError('请先填写邮箱')
      return
    }
    setCodeBusy(true)
    setError(null)
    setInfo(null)
    setDevCode(null)
    saveApiBase(api)
    try {
      const { sendCode: apiSend } = await import('./api')
      const res = await apiSend(email.trim(), 'reset')
      if (res.devCode) {
        setDevCode(res.devCode)
        setInfo('本地验证码已生成（未配置邮件服务）')
      } else {
        setInfo('重置验证码已发送到邮箱')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败')
    } finally {
      setCodeBusy(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    saveApiBase(api)
    try {
      const { resetPassword } = await import('./api')
      const res = await resetPassword(email.trim(), password, code.trim())
      setInfo(res.message || '密码已重置')
      window.setTimeout(() => nav('/login'), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AuthHeader
        title="找回密码"
        desc="通过邮箱验证码重置密码。重置后所有设备需重新登录。"
      />
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-field">
          <span>API 地址</span>
          <input value={api} onChange={(e) => setApi(e.target.value)} placeholder="http://127.0.0.1:3000" />
        </label>
        <label className="auth-field">
          <span>注册邮箱</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <div className="auth-field-row">
          <label className="auth-field" style={{ flex: 1 }}>
            <span>验证码</span>
            <input
              required
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="6 位数字"
            />
          </label>
          <Button type="button" variant="ghost" busy={codeBusy} onClick={() => void sendResetCode()}>
            发送验证码
          </Button>
        </div>
        {devCode ? <p className="auth-devcode">本地验证码：{devCode}</p> : null}
        <label className="auth-field">
          <span>新密码（≥8 位）</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="设置新密码"
          />
        </label>
        <label className="auth-field">
          <span>确认新密码</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="再次输入"
          />
        </label>
        {info ? (
          <p className="auth-info" role="status">
            {info}
          </p>
        ) : null}
        <AuthError message={error} />
        <Button type="submit" variant="primary" busy={busy} className="auth-submit">
          重置密码
        </Button>
        <p className="auth-links">
          <span className="auth-links__text">想起密码了？</span>
          <Link to="/login" className="auth-links__pill">返回登录</Link>
          <span className="auth-links__sep" aria-hidden="true" />
          <Link to="/register" className="auth-links__pill">注册新账号</Link>
        </p>
      </form>
    </>
  )
}
