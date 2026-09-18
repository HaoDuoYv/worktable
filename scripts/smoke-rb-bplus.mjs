import { chromium } from 'playwright'
import { readdirSync } from 'node:fs'

const workerFile = readdirSync('dist/assets').find((f) => f.startsWith('worker-'))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })

const code = [
  "const { RedBlackTreeTracer, BPlusTreeTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');",
  "const rb=new RedBlackTreeTracer('rb'); const bp=new BPlusTreeTracer('bp'); const log=new LogTracer('log');",
  'Layout.setRoot(new VerticalLayout([rb,bp,log]));',
  "rb.set([{id:0,parent:-1,left:1,right:null,color:'black',label:'10'},{id:1,parent:0,left:null,right:2,color:'red',label:'20'},{id:2,parent:1,left:null,right:null,color:'red',label:'30'}]);",
  'Tracer.delay(1); rb.rotateLeft(0); Tracer.delay(2);',
  "bp.set([{id:0,parent:-1,left:1,right:null,label:'5'},{id:1,parent:0,label:'1|3|5'}]);",
  "Tracer.delay(3); bp.split(1,2,3,'1','5'); Tracer.delay(4);",
].join('\n')

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

console.log(
  JSON.stringify({
    ok: result.ok,
    error: result.error,
    methods: (result.commands || []).map((c) => c.method).join(','),
  }),
)
await browser.close()
process.exit(result.ok ? 0 : 1)
