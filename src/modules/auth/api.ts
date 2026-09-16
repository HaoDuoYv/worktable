export interface AuthUser {
  id: string
  email: string
  displayName: string
  createdAt: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  refreshExpiresAt?: number
}

export interface AuthSession extends AuthTokens {
  user: AuthUser
}

const API_KEY = 'worktable.api.baseUrl'
const MODE_KEY = 'worktable.api.mode'
const SESSION_KEY = 'worktable.auth.session'

/** Built-in Worktable cloud endpoint — never shown in the UI. */
const OFFICIAL_API_BASE = 'https://dquapi.qzz.io'

export type ApiEndpointMode = 'official' | 'custom'

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export function loadApiMode(): ApiEndpointMode {
  const mode = readStorage(MODE_KEY)
  if (mode === 'official' || mode === 'custom') return mode
  const stored = readStorage(API_KEY)
  if (!stored) return 'official'
  // Migrate legacy local-dev default to official product endpoint.
  if (stored === 'http://127.0.0.1:8788' || stored === OFFICIAL_API_BASE) return 'official'
  return 'custom'
}

export function loadCustomApiBase(): string {
  const stored = readStorage(API_KEY) || ''
  if (!stored || stored === OFFICIAL_API_BASE || stored === 'http://127.0.0.1:8788') return ''
  return stored.replace(/\/+$/, '')
}

export function loadApiBase(): string {
  if (loadApiMode() === 'official') return OFFICIAL_API_BASE
  return loadCustomApiBase() || OFFICIAL_API_BASE
}

export function saveApiEndpoint(mode: ApiEndpointMode, customUrl?: string): void {
  writeStorage(MODE_KEY, mode)
  if (mode === 'official') {
    writeStorage(API_KEY, OFFICIAL_API_BASE)
    return
  }
  writeStorage(API_KEY, (customUrl ?? loadCustomApiBase()).replace(/\/+$/, ''))
}

/** @deprecated prefer saveApiEndpoint */
export function saveApiBase(url: string) {
  const cleaned = url.replace(/\/+$/, '')
  if (!cleaned || cleaned === OFFICIAL_API_BASE) {
    saveApiEndpoint('official')
    return
  }
  if (cleaned === 'http://127.0.0.1:8788') {
    saveApiEndpoint('official')
    return
  }
  saveApiEndpoint('custom', cleaned)
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export function saveSession(s: AuthSession | null) {
  if (!s) localStorage.removeItem(SESSION_KEY)
  else localStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function rawFetch(path: string, init: RequestInit = {}, token?: string) {
  const base = loadApiBase()
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error || `HTTP ${res.status}`)
  }
  return data
}

export async function sendCode(email: string, purpose: 'register' | 'reset' = 'register') {
  return rawFetch('/api/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ email, purpose }),
  }) as Promise<{ ok: boolean; devCode?: string }>
}

export async function register(email: string, password: string, code: string) {
  return rawFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, code }),
  }) as Promise<AuthSession>
}

export async function resetPassword(email: string, password: string, code: string) {
  return rawFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, password, code }),
  }) as Promise<{ ok: boolean; message: string }>
}

export async function login(email: string, password: string) {
  return rawFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }) as Promise<AuthSession>
}

export async function refreshSession(refreshToken: string) {
  return rawFetch('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  }) as Promise<AuthSession>
}

export async function logoutApi(refreshToken: string) {
  return rawFetch('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
}

export async function getMe(accessToken: string) {
  return rawFetch('/api/auth/me', {}, accessToken) as Promise<{ user: AuthUser }>
}

export async function getSyncMeta(accessToken: string) {
  return rawFetch('/api/sync/meta', {}, accessToken) as Promise<{
    exists: boolean
    updatedAt?: number
    size?: number
    device?: string
  }>
}

export async function downloadSnapshot(accessToken: string) {
  return rawFetch('/api/sync/snapshot', {}, accessToken) as Promise<{
    schemaVersion: number
    device?: string
    updatedAt: number
    payload: Record<string, unknown>
  }>
}

export async function uploadSnapshot(
  accessToken: string,
  payload: Record<string, unknown>,
  device: string,
) {
  return rawFetch(
    '/api/sync/snapshot',
    {
      method: 'PUT',
      body: JSON.stringify({ payload, device, schemaVersion: 1 }),
    },
    accessToken,
  ) as Promise<{ ok: boolean; updatedAt: number; size: number }>
}

export async function clearSnapshot(accessToken: string) {
  return rawFetch('/api/sync/snapshot', { method: 'DELETE' }, accessToken)
}

/** api helper with auto refresh once on 401 */
export async function withAuth<T>(
  fn: (token: string) => Promise<T>,
  onSession?: (s: AuthSession) => void,
): Promise<T> {
  const s = loadSession()
  if (!s) throw new ApiError(401, '未登录')
  try {
    return await fn(s.accessToken)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const next = await refreshSession(s.refreshToken)
      saveSession(next)
      onSession?.(next)
      return fn(next.accessToken)
    }
    throw e
  }
}

export function deviceLabel(): string {
  const ua = navigator.userAgent
  if (/Windows/i.test(ua)) return 'windows-web'
  if (/Mac/i.test(ua)) return 'mac-web'
  if (/Android/i.test(ua)) return 'android-web'
  if (/iPhone|iPad/i.test(ua)) return 'ios-web'
  return 'web'
}
