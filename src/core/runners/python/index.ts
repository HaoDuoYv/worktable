import type { AvCommand } from '@/core/av/types'
// Vite raw import of the Python tracer package
import avPySource from './algorithm_visualizer.py?raw'

export type PythonRunResult =
  | { ok: true; commands: AvCommand[] }
  | { ok: false; error: string }

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>
  setStdout?: (opts: { batched: (s: string) => void }) => void
  setStderr?: (opts: { batched: (s: string) => void }) => void
}

let pyodidePromise: Promise<PyodideInterface> | null = null
const PYODIDE_VERSION = '0.26.4'
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

async function loadPyodideOnce(): Promise<PyodideInterface> {
  if (pyodidePromise) return pyodidePromise

  pyodidePromise = (async () => {
    const g = globalThis as unknown as {
      loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInterface>
    }

    if (!g.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `${PYODIDE_BASE}pyodide.js`
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Pyodide 脚本加载失败，请检查网络'))
        document.head.appendChild(script)
      })
    }

    if (!g.loadPyodide) {
      throw new Error('Pyodide 未就绪')
    }

    return g.loadPyodide({ indexURL: PYODIDE_BASE })
  })().catch((e) => {
    pyodidePromise = null
    throw e
  })

  return pyodidePromise
}

/** Run user Python code with instrumented delay line numbers; return AV commands. */
export async function runPythonAlgorithm(code: string): Promise<PythonRunResult> {
  try {
    const pyodide = await loadPyodideOnce()

    const stdout: string[] = []
    const stderr: string[] = []
    pyodide.setStdout?.({ batched: (s) => stdout.push(s) })
    pyodide.setStderr?.({ batched: (s) => stderr.push(s) })

    // Install pure-python tracer module
    await pyodide.runPythonAsync(avPySource)

    // Instrument Tracer.delay() with 0-based line numbers like the JS worker
    const instrumented = code
      .split('\n')
      .map((line, i) =>
        line
          .replace(/Tracer\.delay\s*\(\s*\)/g, `Tracer.delay(${i})`)
          .replace(/(\w+)\.delay\s*\(\s*\)/g, `$1.delay(${i})`),
      )
      .join('\n')

    // Names already defined by avPySource in the main module namespace
    const runner = `
init()
_user_ns = {
    'Tracer': Tracer,
    'LogTracer': LogTracer,
    'Array1DTracer': Array1DTracer,
    'Array2DTracer': Array2DTracer,
    'GraphTracer': GraphTracer,
    'VerticalLayout': VerticalLayout,
    'HorizontalLayout': HorizontalLayout,
    'Layout': Layout,
    'visualize': visualize,
    'init': init,
}
exec(${JSON.stringify(instrumented)}, _user_ns)
visualize()
`

    const json = (await pyodide.runPythonAsync(runner)) as string
    let commands: AvCommand[] = []
    try {
      commands = JSON.parse(String(json)) as AvCommand[]
    } catch {
      // if visualize() wasn't last expression
      commands = []
    }

    if (!Array.isArray(commands)) commands = []

    // If user never called anything, still report stderr
    if (commands.length === 0 && stderr.length) {
      return { ok: false, error: stderr.join('\n') || 'Python 运行失败' }
    }

    return { ok: true, commands }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  }
}

export function preloadPyodide(): Promise<void> {
  return loadPyodideOnce().then(() => undefined)
}
