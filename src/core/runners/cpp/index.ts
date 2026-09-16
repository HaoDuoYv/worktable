/**
 * Minimal local C++ runner bridge.
 * Talks to optional worktable-cpp server (default http://127.0.0.1:8787).
 */

export type CppCompilerInfo = {
  name: string
  cmd: string
  version: string
}

export type CppRunResult =
  | { ok: true; commands: { key: string | null; method: string; args: unknown[] }[] }
  | { ok: false; error: string }

export const DEFAULT_CPP_BASE = 'http://127.0.0.1:8787'
export const DEFAULT_CPP_TIMEOUT_MS = 15000

export type CppPreferred = 'auto' | 'g++' | 'clang++'

export type CppSettings = {
  baseUrl: string
  preferredCompiler: CppPreferred
  compilerPath: string
  timeoutMs: number
}

const KEYS = {
  baseUrl: 'worktable.cpp.baseUrl',
  preferredCompiler: 'worktable.cpp.preferredCompiler',
  compilerPath: 'worktable.cpp.compilerPath',
  timeoutMs: 'worktable.cpp.timeoutMs',
} as const

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export function loadCppSettings(): CppSettings {
  const preferred = read(KEYS.preferredCompiler, 'auto') as CppPreferred
  const timeoutRaw = Number(read(KEYS.timeoutMs, String(DEFAULT_CPP_TIMEOUT_MS)))
  return {
    baseUrl: read(KEYS.baseUrl, DEFAULT_CPP_BASE).replace(/\/+$/, ''),
    preferredCompiler:
      preferred === 'g++' || preferred === 'clang++' || preferred === 'auto' ? preferred : 'auto',
    compilerPath: read(KEYS.compilerPath, '').trim(),
    timeoutMs:
      Number.isFinite(timeoutRaw) && timeoutRaw >= 1000 && timeoutRaw <= 120000
        ? timeoutRaw
        : DEFAULT_CPP_TIMEOUT_MS,
  }
}

export function saveCppSettings(settings: Partial<CppSettings>): CppSettings {
  const next = { ...loadCppSettings(), ...settings }
  next.baseUrl = next.baseUrl.replace(/\/+$/, '') || DEFAULT_CPP_BASE
  next.compilerPath = next.compilerPath.trim()
  write(KEYS.baseUrl, next.baseUrl)
  write(KEYS.preferredCompiler, next.preferredCompiler)
  write(KEYS.compilerPath, next.compilerPath)
  write(KEYS.timeoutMs, String(next.timeoutMs))
  return next
}

/** @deprecated use loadCppSettings().baseUrl */
export function loadCppBaseUrl(): string {
  return loadCppSettings().baseUrl
}

/** @deprecated use saveCppSettings({ baseUrl }) */
export function saveCppBaseUrl(url: string): void {
  saveCppSettings({ baseUrl: url })
}

export async function detectCppServer(
  baseUrl = loadCppSettings().baseUrl,
): Promise<{
  ok: boolean
  compilers: string[]
  details: CppCompilerInfo[]
  detail?: string
}> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/health`, {
      method: 'GET',
    })
    if (!res.ok) {
      return { ok: false, compilers: [], details: [], detail: `HTTP ${res.status}` }
    }
    const data = (await res.json()) as {
      ok?: boolean
      compilers?: string[]
      details?: CppCompilerInfo[]
    }
    const details = Array.isArray(data.details) ? data.details : []
    const compilers =
      Array.isArray(data.compilers) && data.compilers.length > 0
        ? data.compilers
        : details.map((d) => d.name)
    return {
      ok: Boolean(data.ok) && compilers.length > 0,
      compilers,
      details,
      detail: data.ok && compilers.length > 0 ? undefined : '服务未报告可用编译器',
    }
  } catch {
    return { ok: false, compilers: [], details: [], detail: '无法连接 C++ 服务' }
  }
}

export async function runCppAlgorithm(
  code: string,
  baseUrl = loadCppSettings().baseUrl,
  timeoutMs = loadCppSettings().timeoutMs,
): Promise<CppRunResult> {
  const settings = loadCppSettings()
  const base = baseUrl || settings.baseUrl
  const timeout = timeoutMs || settings.timeoutMs
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/run/cpp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        timeoutMs: timeout,
        preferredCompiler: settings.preferredCompiler,
        compilerPath: settings.compilerPath,
      }),
    })
    const data = (await res.json()) as {
      ok?: boolean
      commands?: { key: string | null; method: string; args: unknown[] }[]
      error?: string
    }
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` }
    }
    return { ok: true, commands: data.commands ?? [] }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'C++ 服务请求失败',
    }
  }
}

export function isElectronRuntime(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Electron/i.test(navigator.userAgent)
}
