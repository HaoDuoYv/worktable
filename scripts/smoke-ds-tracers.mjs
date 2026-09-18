import { chromium } from 'playwright'
import { readdirSync } from 'node:fs'

const workerFile = readdirSync('dist/assets').find((f) => f.startsWith('worker-'))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })

const samples = {
  circular: `const { CircularQueueTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const q=new CircularQueueTracer('cq'); const log=new LogTracer('log');
Layout.setRoot(new VerticalLayout([q,log])); q.init(4); Tracer.delay();
q.enqueue(1); q.enqueue(2); Tracer.delay(); q.dequeue(); Tracer.delay();`,
  deque: `const { DequeTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const d=new DequeTracer('dq'); const log=new LogTracer('log');
Layout.setRoot(new VerticalLayout([d,log])); d.set([]); Tracer.delay();
d.pushBack(2); d.pushFront(1); Tracer.delay(); d.popFront(); Tracer.delay();`,
  rb: `const { RedBlackTreeTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const t=new RedBlackTreeTracer('rb'); const log=new LogTracer('log');
Layout.setRoot(new VerticalLayout([t,log]));
t.set([{id:0,parent:-1,color:'black',label:'8'},{id:1,parent:0,color:'red',label:'4'}]);
Tracer.delay(); t.setColor(1,'black'); t.visit(1); Tracer.delay();`,
  bplus: `const { BPlusTreeTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const b=new BPlusTreeTracer('bp'); const log=new LogTracer('log');
Layout.setRoot(new VerticalLayout([b,log]));
b.set([{id:0,parent:-1,label:'10|20'},{id:1,parent:0,label:'3'},{id:2,parent:0,label:'30'}]);
Tracer.delay(); b.visit(0); Tracer.delay();`,
  static: `const { StaticLinkedListTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const s=new StaticLinkedListTracer('sl'); const log=new LogTracer('log');
Layout.setRoot(new VerticalLayout([s,log])); s.init(4); Tracer.delay();
s.setData(1,'A'); s.setNext(1,-1); Tracer.delay();`,
}

let failed = 0
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
  console.log(name, result.ok ? 'OK' : 'FAIL', result.error || methods.slice(0, 120))
  if (!result.ok) failed++
}
await browser.close()
process.exit(failed ? 1 : 0)
