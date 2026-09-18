import type { AlgoLanguage } from './types'

/** 规范：docs/VIS_SPEC.md §7 */

export type VizCheckLevel = 'reject' | 'warn'

export interface VizCheck {
  id: string
  ok: boolean
  level: VizCheckLevel
  message: string
}

export interface VizValidateResult {
  ok: boolean
  checks: VizCheck[]
  errors: string[]
  warnings: string[]
}

const TRACER_NAMES =
  'Array1DTracer|Array2DTracer|LogTracer|GraphTracer|TreeTracer|StackTracer|QueueTracer|LinkedListTracer|CircularQueueTracer|DequeTracer|RedBlackTreeTracer|BPlusTreeTracer|StaticLinkedListTracer|ChartTracer|ScatterTracer'

const TRACER_JS_RE = new RegExp(`\\bnew\\s+(${TRACER_NAMES})\\s*\\(`)

const TRACER_PY_RE = new RegExp(
  `\\b(${TRACER_NAMES})\\s*\\(`,
)

const TRACER_CPP_RE = new RegExp(
  `\\b(${TRACER_NAMES})\\s+\\w+\\s*\\(`,
)

const DELAY_JS_PY_RE = /\bTracer\s*\.\s*delay\s*\(/
const DELAY_CPP_RE = /\bTracer\s*::\s*delay\s*\(/

const SET_ROOT_RE =
  /\b(?:Layout\s*(?:\.|::)\s*set_?[Rr]oot|setRoot)\s*\(/
const SET_ROOT_CPP_BAD_RE = /\bLayout\s*\.\s*setRoot\s*\(/

const JS_REQUIRE_AV_RE = /require\s*\(\s*['"]algorithm-visualizer['"]\s*\)/
const JS_REQUIRE_ANY_G = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g

const PY_IMPORT_G = /^\s*import\s+([A-Za-z_][\w.]*)/gm
const PY_FROM_IMPORT_G = /^\s*from\s+([A-Za-z_][\w.]*)\s+import/gm

const DANGEROUS_PY = new Set([
  'os',
  'sys',
  'subprocess',
  'socket',
  'shutil',
  'pathlib',
  'ctypes',
  'multiprocessing',
  'threading',
  'webbrowser',
  'requests',
  'urllib',
  'urllib3',
  'http',
  'ftplib',
  'telnetlib',
  'smtplib',
  'pickle',
  'marshal',
  'importlib',
  'builtins',
  'pty',
  'fcntl',
  'resource',
])

function check(
  id: string,
  ok: boolean,
  message: string,
  level: VizCheckLevel = 'reject',
): VizCheck {
  return { id, ok, level: ok ? 'reject' : level, message: ok ? '' : message }
}

function stripJsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/.*$/gm, '$1')
}

function stripPyComments(src: string): string {
  return src.replace(/#.*$/gm, ' ')
}

function stripCppComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')
}

/**
 * Static validation — docs/VIS_SPEC.md §7
 * Caller MUST NOT overwrite vizCode when ok=false.
 */
export function validateVizCode(
  code: string,
  language: AlgoLanguage,
): VizValidateResult {
  const checks: VizCheck[] = []
  const raw = code ?? ''
  const trimmed = raw.trim()

  checks.push(check('non-empty', trimmed.length > 0, '代码为空（non-empty）'))

  const body =
    language === 'python'
      ? stripPyComments(raw)
      : language === 'cpp'
        ? stripCppComments(raw)
        : stripJsComments(raw)

  checks.push(
    check('no-empty-code', body.trim().length > 0, '仅注释/空白（no-empty-code）'),
  )

  if (language === 'javascript') {
    checks.push(
      check(
        'has-tracer-ctor',
        TRACER_JS_RE.test(body),
        '缺少 Tracer 构造（has-tracer-ctor）',
      ),
    )
    checks.push(
      check(
        'js-require-av',
        JS_REQUIRE_AV_RE.test(body),
        "缺少 require('algorithm-visualizer')（js-require-av）",
      ),
    )

    JS_REQUIRE_ANY_G.lastIndex = 0
    let m: RegExpExecArray | null
    const badRequires: string[] = []
    while ((m = JS_REQUIRE_ANY_G.exec(body))) {
      if (m[1] !== 'algorithm-visualizer') badRequires.push(m[1])
    }
    checks.push(
      check(
        'js-forbid-require',
        badRequires.length === 0,
        badRequires.length
          ? `禁止 require(${badRequires.map((b) => `'${b}'`).join(', ')})（js-forbid-require）`
          : '',
      ),
    )

    let parseOk = true
    let parseMsg = ''
    try {
      // compile only
      // eslint-disable-next-line no-new-func
      new Function(body)
    } catch (e) {
      parseOk = false
      parseMsg = e instanceof Error ? e.message : 'JS 语法错误'
    }
    checks.push(check('js-syntax', parseOk, parseMsg || 'JS 无法编译（js-syntax）'))

    if (/^\s*import\s+/m.test(body)) {
      checks.push(
        check(
          'no-esm-import',
          false,
          '检测到 ESM import；Worker 仅支持 require（no-esm-import）',
        ),
      )
    } else {
      checks.push(check('no-esm-import', true, ''))
    }
  } else if (language === 'python') {
    checks.push(
      check(
        'has-tracer-ctor',
        TRACER_PY_RE.test(body),
        '缺少 Tracer 构造（has-tracer-ctor）',
      ),
    )
    checks.push(
      check(
        'py-no-av-import',
        !/^\s*(import\s+algorithm_visualizer|from\s+algorithm_visualizer\b)/m.test(body),
        '禁止 import algorithm_visualizer（py-no-av-import）',
      ),
    )

    const importRoots = new Set<string>()
    PY_IMPORT_G.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = PY_IMPORT_G.exec(body))) {
      importRoots.add(m[1].split('.')[0])
    }
    PY_FROM_IMPORT_G.lastIndex = 0
    while ((m = PY_FROM_IMPORT_G.exec(body))) {
      importRoots.add(m[1].split('.')[0])
    }
    const dangerous = [...importRoots].filter((n) => DANGEROUS_PY.has(n))
    checks.push(
      check(
        'py-forbid-import',
        dangerous.length === 0,
        dangerous.length ? `禁止 import ${dangerous.join(', ')}（py-forbid-import）` : '',
      ),
    )
    const unknown = [...importRoots].filter(
      (n) => !DANGEROUS_PY.has(n) && n !== 'algorithm_visualizer',
    )
    if (unknown.length) {
      checks.push(
        check(
          'py-unknown-import',
          false,
          `注意：import ${unknown.join(', ')}（Pyodide 可能不存在）`,
          'warn',
        ),
      )
    }
  } else {
    // cpp
    checks.push(
      check('has-tracer-ctor', TRACER_CPP_RE.test(body), '缺少 Tracer 构造（has-tracer-ctor）'),
    )
    checks.push(
      check(
        'cpp-include-av',
        /#\s*include\s*[<"]av\.h[>"]/.test(body),
        '缺少 #include "av.h"（cpp-include-av）',
      ),
    )
    checks.push(
      check(
        'cpp-using-or-ns',
        /using\s+namespace\s+av\b/.test(body) || /\bav\s*::/.test(body),
        '需要 using namespace av 或 av::（cpp-using-or-ns）',
      ),
    )
    checks.push(
      check('cpp-delay', DELAY_CPP_RE.test(body), '缺少 Tracer::delay（cpp-delay）'),
    )
  }

  if (language !== 'cpp') {
    checks.push(
      check(
        'has-delay',
        DELAY_JS_PY_RE.test(body),
        '缺少 Tracer.delay()（has-delay）',
      ),
    )
  }

  checks.push(
    check('has-set-root', SET_ROOT_RE.test(body), '缺少 Layout.setRoot / set_root / Layout::setRoot（has-set-root）'),
  )
  if (language === 'cpp') {
    checks.push(
      check(
        'cpp-setroot-syntax',
        !SET_ROOT_CPP_BAD_RE.test(body) || /\bLayout\s*::\s*setRoot\s*\(/.test(body),
        'C++ 请使用 Layout::setRoot，不要写 Layout.setRoot（cpp-setroot-syntax）',
      ),
    )
  }

  const errors = checks.filter((c) => !c.ok && c.level === 'reject').map((c) => c.message)
  const warnings = checks.filter((c) => !c.ok && c.level === 'warn').map((c) => c.message)

  return { ok: errors.length === 0, checks, errors, warnings }
}

export function formatValidateError(result: VizValidateResult): string {
  if (result.ok) return ''
  return `校验未通过，已保留原可视化代码：\n${result.errors.map((e) => `· ${e}`).join('\n')}`
}

/** Extract first fenced code block; prefer language match. */
export function extractCodeBlock(text: string, langHint?: string): string | null {
  const re = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g
  const blocks: { lang: string; code: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    blocks.push({ lang: (m[1] || '').toLowerCase(), code: m[2].trim() })
  }
  if (blocks.length === 0) return null
  if (!langHint) return blocks[0].code

  const hint = langHint.toLowerCase()
  const aliases: Record<string, string[]> = {
    javascript: ['js', 'javascript', 'node'],
    python: ['py', 'python'],
    cpp: ['cpp', 'c++', 'cxx'],
  }
  const keys = aliases[hint] ?? [hint]
  const hit = blocks.find((b) => keys.some((k) => b.lang.includes(k) || k.includes(b.lang)))
  return (hit ?? blocks[0]).code
}
