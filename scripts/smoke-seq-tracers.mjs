import { chromium } from 'playwright'
import { readdirSync } from 'node:fs'

const workerFile = readdirSync('dist/assets').find((f) => f.startsWith('worker-'))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })

const samples = {
  stack: `const { StackTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const s = new StackTracer('栈');
const log = new LogTracer('日志');
Layout.setRoot(new VerticalLayout([s, log]));
s.set([]);
Tracer.delay();
s.push(1); s.push(2); Tracer.delay();
s.pop(); Tracer.delay();`,
  queue: `const { QueueTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const q = new QueueTracer('队列');
const log = new LogTracer('日志');
Layout.setRoot(new VerticalLayout([q, log]));
q.set([]);
Tracer.delay();
q.enqueue(9); q.enqueue(8); Tracer.delay();
q.dequeue(); Tracer.delay();`,
  list: `const { LinkedListTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const l = new LinkedListTracer('链表');
const log = new LogTracer('日志');
Layout.setRoot(new VerticalLayout([l, log]));
l.set([]);
Tracer.delay();
l.push(2); l.unshift(1); Tracer.delay();
l.select(0); Tracer.delay();`,
}

for (const [name, code] of Object.entries(samples)) {
  const result = await page.evaluate(async ({ wf, code }) => {
    const worker = new Worker(new URL('/assets/' + wf, location.href), { type: 'module' })
    return await new Promise((resolve) => {
      const t = setTimeout(() => resolve({ ok: false, error: 'timeout' }), 12000)
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
  const methods = (result.commands || []).map((c) => c.method).join(',')
  console.log(name, result.ok ? 'OK' : 'FAIL', result.error || methods)
  if (!result.ok) process.exitCode = 1
}
await browser.close()
