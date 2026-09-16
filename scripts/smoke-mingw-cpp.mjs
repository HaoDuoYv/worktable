import { startCppServer } from '../server-cpp/index.mjs'

const compilerPath = 'C:\\MinGW\\bin\\g++.exe'
const h = await startCppServer({ port: 8794, host: '127.0.0.1' })

const health = await fetch(
  'http://127.0.0.1:8794/health?compilerPath=' + encodeURIComponent(compilerPath),
)
console.log('health', JSON.stringify(await health.json(), null, 2))

const code = [
  '#include "av.h"',
  'int main() {',
  '  av::LogTracer log("log");',
  '  log.println("hello");',
  '  av::Array1DTracer arr("arr");',
  '  arr.set(std::vector<int>{3, 1, 2});',
  '  av::Tracer::delay();',
  '  arr.select(0);',
  '  av::Tracer::delay();',
  '  return 0;',
  '}',
].join('\n')

const run = await fetch('http://127.0.0.1:8794/run/cpp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, compilerPath, timeoutMs: 25000 }),
})
const data = await run.json()
console.log('run ok=', data.ok)
if (!data.ok) {
  console.log('error:', data.error)
} else {
  console.log('commands:', (data.commands || []).length)
  console.log((data.commands || []).map((c) => c.method).join(', '))
}
await h.close()
process.exit(data.ok ? 0 : 1)
