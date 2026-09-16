/**
 * Convert uredis-tutorial steps.ts into public/tutorials/uring-redis.json
 * Usage: node scripts/import-uredis.mjs
 */
import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const SRC = 'E:/study/claude/redis教程/uredis-tutorial/src/data/steps.ts'
const OUT_DIR = path.resolve('public/tutorials')
const OUT = path.join(OUT_DIR, 'uring-redis.json')

const tmp = path.join(tmpdir(), `uredis-steps-${Date.now()}.mjs`)

await build({
  entryPoints: [SRC],
  outfile: tmp,
  bundle: false,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  // steps.ts only has `import type` — strip via loader
  loader: { '.ts': 'ts' },
  logLevel: 'silent',
})

const mod = await import(pathToFileURL(tmp).href)
const steps = mod.default
if (!Array.isArray(steps) || steps.length === 0) {
  throw new Error('steps export is empty')
}

const tutorial = {
  id: 'uring-redis',
  title: '从零实现 Redis（uRedis）',
  description: '20 步从 TCP 端口绑定到可用的 Redis 克隆，含 RESP、数据结构与命令处理。',
  author: 'uRedis Tutorial',
  tags: ['redis', 'network', 'python', 'resp'],
  source: 'E:/study/claude/redis教程/uredis-tutorial',
  stepCount: steps.length,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  steps,
}

await mkdir(OUT_DIR, { recursive: true })
await writeFile(OUT, JSON.stringify(tutorial), 'utf8')
console.log(`OK ${OUT} steps=${steps.length}`)
console.log('first title:', steps[0]?.title)
console.log('last title:', steps[steps.length - 1]?.title)
