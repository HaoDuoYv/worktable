/// <reference lib="webworker" />

// Official library phones home unless this flag is set (see AV server worker.js)
const g = globalThis as unknown as { process?: { env: Record<string, string> } }
g.process = { env: { ...(g.process?.env ?? {}), ALGORITHM_VISUALIZER: '1' } }

type AvCommand = { key: string | null; method: string; args: unknown[] }
type RunPayload = { code: string }

self.onmessage = async (event: MessageEvent<RunPayload>) => {
  try {
    const imported = await import('algorithm-visualizer')
    // Official package has no TreeTracer — alias GraphTracer so constructor.name drives TreeTracer.
    const AlgorithmVisualizer: Record<string, unknown> = { ...(imported as object) }
    if (typeof AlgorithmVisualizer.TreeTracer !== 'function') {
      const GraphTracer = AlgorithmVisualizer.GraphTracer as new (
        title?: string,
      ) => object
      class TreeTracer extends GraphTracer {}
      Object.defineProperty(TreeTracer, 'name', { value: 'TreeTracer' })
      AlgorithmVisualizer.TreeTracer = TreeTracer
    }

    const raw = event.data.code
    // Instrument Tracer.delay() with 0-based line numbers (official worker behavior uses i, UI adds 1)
    const lines = raw.split('\n').map((line, i) =>
      line.replace(/(\.\s*delay\s*)\(\s*\)/g, `$1(${i})`),
    )
    const code = lines.join('\n')

    ;(AlgorithmVisualizer.Commander as unknown as { init: () => void }).init()

    const requireShim = (name: string) => {
      if (name === 'algorithm-visualizer') return AlgorithmVisualizer
      throw new Error(`仅支持 require('algorithm-visualizer')，收到：${name}`)
    }

    // eslint-disable-next-line no-new-func
    const fn = new Function('require', 'module', 'exports', `"use strict";\n${code}\n`)
    fn(requireShim, { exports: {} }, {})

    const commands = (AlgorithmVisualizer.Commander as unknown as { commands: AvCommand[] })
      .commands
    self.postMessage({ ok: true, commands: commands ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    self.postMessage({ ok: false, error: message })
  }
}
