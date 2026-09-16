/**
 * Local C++ algorithm runner for Worktable.
 * Usage: node server-cpp/index.mjs
 * Or embed: import { startCppServer } from './server-cpp/index.mjs'
 * Requires g++ or clang++ on PATH, or a configured compiler path.
 */
import http from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AV_H_PATH = path.join(__dirname, 'av.h')

const DEFAULT_PORT = Number(process.env.WORKTABLE_CPP_PORT || 8787)
const CANDIDATE_COMPILERS = ['g++', 'clang++']

let cachedHeader = null

async function loadHeader() {
  if (cachedHeader != null) return cachedHeader
  try {
    cachedHeader = await readFile(AV_H_PATH, 'utf8')
  } catch {
    cachedHeader = ''
  }
  return cachedHeader
}

function run(cmd, args, { cwd, timeoutMs = 15000, shell = false } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, shell })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      try {
        p.kill()
      } catch {
        /* ignore */
      }
      resolve({ code: -1, stdout, stderr: (stderr + '\n超时').trim() })
    }, timeoutMs)
    p.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    p.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    p.on('error', (e) => {
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: e.message })
    })
    p.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}

async function probeCompiler(cmd, shell = !isAbsolutePath(cmd)) {
  const r = await run(cmd, ['--version'], { shell, timeoutMs: 8000 })
  if (r.code !== 0) return null
  const first = (r.stdout || r.stderr).split(/\r?\n/).find((l) => l.trim()) || cmd
  return {
    name: path.basename(cmd).replace(/\.exe$/i, ''),
    cmd,
    version: first.trim().slice(0, 120),
  }
}

function isAbsolutePath(p) {
  return path.isAbsolute(p) || /^[a-zA-Z]:[\\/]/.test(p)
}

/**
 * Detect available compilers.
 * @param {{ preferred?: string, compilerPath?: string }} opts
 */
export async function findCompilers(opts = {}) {
  const found = []
  const seen = new Set()

  if (opts.compilerPath && opts.compilerPath.trim()) {
    const p = await probeCompiler(opts.compilerPath.trim(), false)
    if (p) {
      found.push(p)
      seen.add(p.name)
    }
  }

  const candidates = [...CANDIDATE_COMPILERS]
  if (opts.preferred && opts.preferred !== 'auto') {
    candidates.sort((a, b) => (a === opts.preferred ? -1 : b === opts.preferred ? 1 : 0))
  }

  await Promise.all(
    candidates.map(async (c) => {
      if (seen.has(c)) return
      const p = await probeCompiler(c, true)
      if (p && !seen.has(p.name)) {
        seen.add(p.name)
        found.push(p)
      }
    }),
  )

  if (opts.preferred && opts.preferred !== 'auto') {
    found.sort((a, b) => (a.name === opts.preferred ? -1 : b.name === opts.preferred ? 1 : 0))
  }

  return found
}

function parseCommands(stdout) {
  const commands = []
  for (const line of stdout.split(/\r?\n/)) {
    const idx = line.indexOf('AVCMD')
    if (idx < 0) continue
    const json = line.slice(idx + 'AVCMD'.length).trim()
    try {
      const obj = JSON.parse(json)
      if (obj && typeof obj.method === 'string') {
        commands.push({
          key: obj.key ?? null,
          method: obj.method,
          args: Array.isArray(obj.args) ? obj.args : [],
        })
      }
    } catch {
      /* skip malformed */
    }
  }
  return commands
}

async function runCpp(code, compiler, timeoutMs) {
  const header = await loadHeader()
  const dir = await mkdtemp(path.join(tmpdir(), 'worktable-cpp-'))
  const exe = path.join(dir, process.platform === 'win32' ? 'main.exe' : 'main')
  try {
    await writeFile(path.join(dir, 'av.h'), header, 'utf8')
    await writeFile(path.join(dir, 'main.cpp'), code, 'utf8')

    const shell = !isAbsolutePath(compiler.cmd)
    const compile = await run(
      compiler.cmd,
      ['-std=c++17', '-O0', '-I.', 'main.cpp', '-o', exe],
      { cwd: dir, timeoutMs, shell },
    )
    if (compile.code !== 0) {
      return { ok: false, error: compile.stderr || '编译失败' }
    }
    const exec = await run(exe, [], { cwd: dir, timeoutMs, shell: false })
    if (exec.code !== 0 && !exec.stdout.includes('AVCMD')) {
      return { ok: false, error: exec.stderr || `运行失败 exit=${exec.code}` }
    }
    return { ok: true, commands: parseCommands(exec.stdout) }
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(payload)
}

/**
 * Start the C++ runner HTTP server.
 * @param {{ port?: number, host?: string, preferredCompiler?: string, compilerPath?: string }} options
 * @returns {Promise<{ server: import('node:http').Server, port: number, close: () => Promise<void> }>}
 */
export function startCppServer(options = {}) {
  const port = Number(options.port || DEFAULT_PORT)
  const host = options.host || '127.0.0.1'
  const defaultPreferred = options.preferredCompiler || process.env.WORKTABLE_CXX || 'auto'
  const defaultCompilerPath = options.compilerPath || process.env.WORKTABLE_CXX_PATH || ''

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === 'GET' && req.url === '/health') {
      const compilers = await findCompilers({
        preferred: defaultPreferred,
        compilerPath: defaultCompilerPath,
      })
      const header = await loadHeader()
      json(res, 200, {
        ok: compilers.length > 0,
        compilers: compilers.map((c) => c.name),
        details: compilers,
        platform: process.platform,
        headerPath: AV_H_PATH,
        headerBytes: Buffer.byteLength(header || '', 'utf8'),
      })
      return
    }

    if (req.method === 'POST' && req.url === '/run/cpp') {
      let body = ''
      req.on('data', (d) => {
        body += d
      })
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}')
          const code = String(payload.code || '')
          const timeoutMs = Number(payload.timeoutMs || 15000)
          const preferred = String(payload.preferredCompiler || defaultPreferred || 'auto')
          const compilerPath = String(payload.compilerPath || defaultCompilerPath || '')

          if (!code.trim()) {
            json(res, 400, { ok: false, error: '代码为空' })
            return
          }

          const compilers = await findCompilers({ preferred, compilerPath })
          if (compilers.length === 0) {
            json(res, 200, {
              ok: false,
              error:
                '未检测到 C++ 编译器。可在设置中指定完整路径（如 C:\\mingw64\\bin\\g++.exe），或安装 MinGW-w64 / LLVM。',
            })
            return
          }

          const result = await runCpp(code, compilers[0], timeoutMs)
          json(res, 200, result)
        } catch (e) {
          json(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      })
      return
    }

    json(res, 404, { ok: false, error: 'not found' })
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      const addr = server.address()
      const actualPort = typeof addr === 'object' && addr ? addr.port : port
      resolve({
        server,
        port: actualPort,
        close: () =>
          new Promise((done) => {
            server.close(() => done())
          }),
      })
    })
  })
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isDirectRun) {
  const started = await startCppServer({})
  console.log(`Worktable C++ server http://127.0.0.1:${started.port}`)
  const compilers = await findCompilers({
    preferred: process.env.WORKTABLE_CXX || 'auto',
    compilerPath: process.env.WORKTABLE_CXX_PATH || '',
  })
  console.log(
    'compilers:',
    compilers.length ? compilers.map((c) => `${c.name} (${c.version})`).join(', ') : '(none)',
  )
}
