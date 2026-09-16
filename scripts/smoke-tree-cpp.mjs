import { chromium } from 'playwright'
import { readdirSync } from 'node:fs'

const workerFile = readdirSync('dist/assets').find((f) => f.startsWith('worker-'))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })

const code = `const { TreeTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const tree = new TreeTracer('BST');
const log = new LogTracer('日志');
const N = 4;
const adj = Array.from({ length: N }, () => Array(N).fill(0));
adj[0][1] = 1; adj[0][2] = 1; adj[1][3] = 1;
Layout.setRoot(new VerticalLayout([tree, log]));
tree.directed(true);
tree.set(adj);
Tracer.delay();
tree.visit(1, 0);
log.println('ok');
Tracer.delay();`

const result = await page.evaluate(async ({ wf, code }) => {
  const worker = new Worker(new URL('/assets/' + wf, location.href), { type: 'module' })
  return await new Promise((resolve) => {
    const t = setTimeout(() => resolve({ timeout: true }), 15000)
    worker.onmessage = (e) => {
      clearTimeout(t)
      worker.terminate()
      resolve(e.data)
    }
    worker.onerror = (e) => {
      clearTimeout(t)
      worker.terminate()
      resolve({ ok: false, error: e.message })
    }
    worker.postMessage({ code })
  })
}, { wf: workerFile, code })

console.log('TREE_JOB', JSON.stringify(result).slice(0, 400))
await browser.close()
if (!result?.ok) process.exit(1)

// C++ health with query
const { spawn } = await import('node:child_process')
const child = spawn(process.execPath, ['server-cpp/index.mjs'], {
  env: { ...process.env, WORKTABLE_CPP_PORT: '8792' },
  stdio: 'ignore',
})
await new Promise((r) => setTimeout(r, 800))
const h = await fetch('http://127.0.0.1:8792/health?compilerPath=C%3A%5Cnot%5Cexist%5Cg%2B%2B.exe&preferred=g%2B%2B')
const hj = await h.json()
console.log('HEALTH with bad path', JSON.stringify({ ok: hj.ok, compilers: hj.compilers, probed: hj.probed }))
child.kill()
