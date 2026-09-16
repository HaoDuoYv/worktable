import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { writeFileSync, unlinkSync } from 'node:fs'

const outfile = path.join(tmpdir(), `vizval-${Date.now()}.mjs`)

await build({
  entryPoints: ['src/modules/algorithms/vizValidate.ts'],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  logLevel: 'silent',
})

const { validateVizCode } = await import(pathToFileURL(outfile).href)

const jsGood = `
const { Array1DTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer')
const a = new Array1DTracer('A')
const l = new LogTracer('L')
Layout.setRoot(new VerticalLayout([a, l]))
a.set([1,2])
Tracer.delay()
`

const cases = [
  ['js good', validateVizCode(jsGood, 'javascript').ok === true],
  ['js no delay', validateVizCode(jsGood.replace('Tracer.delay()', ''), 'javascript').ok === false],
  [
    'js no root',
    validateVizCode(jsGood.replace(/Layout\.setRoot.*\n/, ''), 'javascript').ok === false,
  ],
  [
    'js bad require',
    validateVizCode(
      jsGood.replace("require('algorithm-visualizer')", "require('fs')"),
      'javascript',
    ).ok === false,
  ],
  [
    'py good',
    validateVizCode(
      `array1d = Array1DTracer("A")
Layout.set_root(array1d)
Tracer.delay()
`,
      'python',
    ).ok === true,
  ],
  [
    'py import av',
    validateVizCode(
      `import algorithm_visualizer
array1d = Array1DTracer("A")
Layout.set_root(array1d)
Tracer.delay()
`,
      'python',
    ).ok === false,
  ],
  [
    'py import os',
    validateVizCode(
      `import os
array1d = Array1DTracer("A")
Layout.set_root(array1d)
Tracer.delay()
`,
      'python',
    ).ok === false,
  ],
  [
    'cpp good',
    validateVizCode(
      `#include "av.h"
using namespace av;
int main() {
  Array1DTracer a("A");
  Layout.setRoot(a);
  Tracer::delay(1);
  return 0;
}
`,
      'cpp',
    ).ok === true,
  ],
  [
    'cpp no include',
    validateVizCode(
      `using namespace av;
int main() {
  Array1DTracer a("A");
  Layout.setRoot(a);
  Tracer::delay(1);
  return 0;
}
`,
      'cpp',
    ).ok === false,
  ],
  ['empty', validateVizCode('', 'javascript').ok === false],
]

let failed = 0
for (const [name, pass] of cases) {
  if (pass) console.log('OK', name)
  else {
    console.error('FAIL', name)
    failed++
  }
}

try {
  unlinkSync(outfile)
} catch {
  /* ignore */
}

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nall viz validate tests passed')
