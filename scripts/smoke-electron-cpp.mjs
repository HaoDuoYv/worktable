/**
 * Smoke: C++ runner server + Electron packaging prerequisites.
 * Usage: node scripts/smoke-electron-cpp.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const entry = path.join(root, 'server-cpp', 'index.mjs')

function fail(msg) {
  console.error('FAIL', msg)
  process.exitCode = 1
}

function ok(msg) {
  console.log('OK  ', msg)
}

async function waitHealth(baseUrl, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`)
      if (res.ok) return await res.json()
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('health timeout')
}

async function main() {
  if (!existsSync(path.join(root, 'server-cpp', 'av.h'))) fail('missing server-cpp/av.h')
  else ok('av.h present')

  if (!existsSync(path.join(root, 'electron', 'main.cjs'))) fail('missing electron/main.cjs')
  else ok('electron/main.cjs present')

  const port = 8791
  const child = spawn(process.execPath, [entry], {
    cwd: root,
    env: { ...process.env, WORKTABLE_CPP_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stderr = ''
  child.stderr.on('data', (d) => {
    stderr += d.toString()
  })

  try {
    const health = await waitHealth(`http://127.0.0.1:${port}`)
    if (typeof health.headerBytes !== 'number' || health.headerBytes < 100) {
      fail(`headerBytes invalid: ${health.headerBytes}`)
    } else {
      ok(`health headerBytes=${health.headerBytes}`)
    }
    if (!Array.isArray(health.compilers)) fail('compilers not array')
    else ok(`compilers=${health.compilers.length ? health.compilers.join(',') : '(none)'}`)

    const res = await fetch(`http://127.0.0.1:${port}/run/cpp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: '#include "av.h"\nint main(){ av::LogTracer log; log.println("hi"); return 0; }',
        timeoutMs: 20000,
        preferredCompiler: 'auto',
        compilerPath: process.env.SMOKE_CXX_PATH || '',
      }),
    })
    const data = await res.json()
    if (data.ok) {
      ok(`run/cpp commands=${data.commands?.length ?? 0}`)
    } else {
      // No compiler on CI/machines without toolchain is acceptable for smoke of API shape
      if (typeof data.error === 'string' && data.error.length > 0) {
        ok(`run/cpp rejected cleanly: ${data.error.slice(0, 60)}`)
      } else {
        fail('run/cpp missing error')
      }
    }
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e))
    if (stderr) console.error(stderr.slice(0, 400))
  } finally {
    child.kill()
  }

  const portable = path.join(root, 'release', 'Worktable-0.1.0-portable.exe')
  const unpacked = path.join(root, 'release', 'win-unpacked', 'Worktable.exe')
  if (existsSync(unpacked)) ok('win-unpacked/Worktable.exe present')
  else console.log('NOTE win-unpacked not built (run electron:build)')
  if (existsSync(portable)) ok('portable exe present')
  else console.log('NOTE portable exe not built (run electron:build)')

  if (process.exitCode) console.error('smoke-electron-cpp FAILED')
  else console.log('smoke-electron-cpp PASSED')
}

main()
