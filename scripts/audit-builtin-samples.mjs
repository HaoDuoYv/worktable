import { readFileSync } from 'node:fs'
const s = readFileSync('src/modules/algorithms/builtin.ts', 'utf8')
const parts = s.split(/id: '/).slice(1)
for (const part of parts) {
  const id = part.slice(0, part.indexOf("'"))
  const m = part.match(/code: `([\s\S]*?)`,\n/)
  if (!m) {
    console.log(id, 'NO CODE')
    continue
  }
  const code = m[1]
  const lines = code.split('\n')
  const delays = []
  lines.forEach((l, i) => {
    if (/delay\s*\(/.test(l)) delays.push({ line: i, text: l.trim().slice(0, 50) })
  })
  console.log('\n===', id, '===')
  console.log('setRoot', /Layout\.setRoot|Layout::setRoot/.test(code), 'require', /require\(/.test(code))
  for (const d of delays) {
    const explicit = /delay\s*\(\s*\d+/.test(d.text)
    console.log(`  L${d.line}${explicit ? ' EXPLICIT' : ' empty'}  ${d.text}`)
  }
}
