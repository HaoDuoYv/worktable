import type { AvCommand } from '@/core/av/types'

export type JsRunResult =
  | { ok: true; commands: AvCommand[] }
  | { ok: false; error: string }

export function runJsAlgorithm(code: string, timeoutMs = 8000): Promise<JsRunResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
      name: 'av-js-runner',
    })

    const timer = window.setTimeout(() => {
      worker.terminate()
      resolve({ ok: false, error: `运行超时（${timeoutMs}ms），可能存在死循环` })
    }, timeoutMs)

    worker.onmessage = (event: MessageEvent) => {
      window.clearTimeout(timer)
      worker.terminate()
      const data = event.data as
        | { ok: true; commands: AvCommand[] }
        | { ok: false; error: string; stack?: string }
      if (data.ok) {
        resolve({ ok: true, commands: data.commands })
      } else {
        resolve({ ok: false, error: data.error })
      }
    }

    worker.onerror = (event) => {
      window.clearTimeout(timer)
      worker.terminate()
      resolve({ ok: false, error: event.message || 'Worker 运行失败' })
    }

    worker.postMessage({ code })
  })
}
