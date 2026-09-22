/// <reference lib="webworker" />

// Official library phones home unless this flag is set (see AV server worker.js)
const g = globalThis as unknown as { process?: { env: Record<string, string> } }
g.process = { env: { ...(g.process?.env ?? {}), ALGORITHM_VISUALIZER: '1' } }

type AvCommand = { key: string | null; method: string; args: unknown[] }
type RunPayload = { code: string }

self.onmessage = async (event: MessageEvent<RunPayload>) => {
  try {
    const ns = (await import('algorithm-visualizer')) as Record<string, unknown> & {
      default?: Record<string, unknown>
    }
    // 必须整包使用同一套 API（default 或 named 二选一），否则 Commander 记录会分裂
    const api = ns.default && typeof ns.default.Array1DTracer === 'function' ? ns.default : ns
    const AlgorithmVisualizer: Record<string, unknown> = { ...api }
    if (typeof AlgorithmVisualizer.TreeTracer !== 'function') {
      const GraphTracer = AlgorithmVisualizer.GraphTracer as new (title?: string) => object
      class TreeTracer extends GraphTracer {}
      Object.defineProperty(TreeTracer, 'name', { value: 'TreeTracer' })
      AlgorithmVisualizer.TreeTracer = TreeTracer
    }
    const Array1DTracer = AlgorithmVisualizer.Array1DTracer as new (title?: string) => object
    const seqOps = {
      push(v: unknown) {
        ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('push', [v])
        return this
      },
      pop() {
        ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('pop', [])
        return this
      },
      enqueue(v: unknown) {
        ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('enqueue', [v])
        return this
      },
      dequeue() {
        ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('dequeue', [])
        return this
      },
      unshift(v: unknown) {
        ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('unshift', [v])
        return this
      },
      shift() {
        ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('shift', [])
        return this
      },
      pushFront(v: unknown) {
        ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('pushFront', [v])
        return this
      },
      popFront() {
        ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('popFront', [])
        return this
      },
      pushBack(v: unknown) {
        ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('pushBack', [v])
        return this
      },
      popBack() {
        ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('popBack', [])
        return this
      },
    }
    const seqNames = [
      'StackTracer',
      'QueueTracer',
      'LinkedListTracer',
      'CircularQueueTracer',
      'DequeTracer',
    ] as const
    for (const name of seqNames) {
      if (typeof AlgorithmVisualizer[name] === 'function') continue
      const extra =
        name === 'CircularQueueTracer'
          ? {
              init(n: number) {
                ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('init', [n])
                return this
              },
            }
          : {}
      const Base = class extends Array1DTracer {
        constructor(title?: string) {
          super(title)
          Object.assign(this, seqOps, extra)
        }
      }
      Object.defineProperty(Base, 'name', { value: name })
      AlgorithmVisualizer[name] = Base
    }
    if (typeof AlgorithmVisualizer.StaticLinkedListTracer !== 'function') {
      const StaticLinkedListTracer = class extends Array1DTracer {
        init(n: number) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('init', [n])
          return this
        }
        setData(i: number, v: unknown) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('setData', [i, v])
          return this
        }
        setNext(i: number, v: unknown) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('setNext', [i, v])
          return this
        }
        set(data: unknown[], next: unknown[]) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('set', [data, next])
          return this
        }
      }
      Object.defineProperty(StaticLinkedListTracer, 'name', { value: 'StaticLinkedListTracer' })
      AlgorithmVisualizer.StaticLinkedListTracer = StaticLinkedListTracer
    }
    if (typeof AlgorithmVisualizer.RedBlackTreeTracer !== 'function') {
      const GraphTracer = AlgorithmVisualizer.GraphTracer as new (title?: string) => object
      class RedBlackTreeTracer extends GraphTracer {
        setColor(id: number, color: string) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('setColor', [id, color])
          return this
        }
        setLabel(id: number, text: unknown) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('setLabel', [id, text])
          return this
        }
        setPointer(id: number, field: string, child: number | null) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('setPointer', [id, field, child])
          return this
        }
        rotateLeft(x: number) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('rotateLeft', [x])
          return this
        }
        rotateRight(x: number) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('rotateRight', [x])
          return this
        }
        set(items: unknown[]) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('set', [items])
          return this
        }
      }
      Object.defineProperty(RedBlackTreeTracer, 'name', { value: 'RedBlackTreeTracer' })
      AlgorithmVisualizer.RedBlackTreeTracer = RedBlackTreeTracer
    }
    if (typeof AlgorithmVisualizer.BPlusTreeTracer !== 'function') {
      const GraphTracer = AlgorithmVisualizer.GraphTracer as new (title?: string) => object
      class BPlusTreeTracer extends GraphTracer {
        setLabel(id: number, text: unknown) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('setLabel', [id, text])
          return this
        }
        split(oldId: number, newId: number, promote: unknown, leftLabel?: unknown, rightLabel?: unknown) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('split', [
            oldId,
            newId,
            promote,
            leftLabel,
            rightLabel,
          ])
          return this
        }
        set(items: unknown[]) {
          ;(this as unknown as { command: (m: string, a: unknown[]) => void }).command('set', [items])
          return this
        }
      }
      Object.defineProperty(BPlusTreeTracer, 'name', { value: 'BPlusTreeTracer' })
      AlgorithmVisualizer.BPlusTreeTracer = BPlusTreeTracer
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
    const list = commands ?? []
    if (list.length === 0) {
      throw new Error(
        '未记录到可视化命令 keys=' +
          Object.keys(AlgorithmVisualizer).slice(0, 24).join(',') +
          ' hasCtor=' +
          typeof AlgorithmVisualizer.Array1DTracer,
      )
    }
    self.postMessage({ ok: true, commands: list })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    self.postMessage({ ok: false, error: message })
  }
}
