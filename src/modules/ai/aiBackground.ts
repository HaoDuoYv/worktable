import type { Algorithm } from '@/modules/algorithms/types'
import { saveAlgorithm } from '@/core/storage/indexedDb'
import { chatComplete, loadAiSettings, buildAlgoSystemPrompt } from './aiClient'
import { extractCodeBlock, validateVizCode, formatValidateError } from '@/modules/algorithms/vizValidate'
import { startAiJob, hasRunningVizJob } from './aiJobs'

/**
 * Convert source → viz code in a background job (survives navigation).
 * Writes to IndexedDB only after validation passes.
 */
export function startVizConvertJob(opts: {
  algorithm: Algorithm
  sourceCode: string
  onApplied?: (algorithm: Algorithm) => void
  onSettled?: () => void
}): string | null {
  const { algorithm, sourceCode, onApplied, onSettled } = opts
  const langName = algorithm.language

  // 全局互斥：已有可视化任务则拒绝，避免切页后重复执行
  if (hasRunningVizJob()) return null

  return startAiJob({
    kind: 'viz',
    title: algorithm.title,
    run: async ({ update }) => {
      try {
        if (!sourceCode.trim()) throw new Error('源码为空')
        const sys = buildAlgoSystemPrompt()
        const langHint =
          langName === 'javascript'
            ? '必须使用 require("algorithm-visualizer")。按算法选用 Array1DTracer/GraphTracer/ChartTracer 等 + LogTracer，Tracer.delay(源码行号)，Layout.setRoot。只输出一个 ```javascript 代码块，不要解释。'
            : langName === 'python'
              ? '直接使用注入的 Tracer API，不要 import algorithm_visualizer。Tracer.delay(源码行号)。只输出一个 ```python 代码块。'
              : '使用 #include "av.h" 与 av:: 命名空间，Layout::setRoot、Tracer::delay(源码行号)。只输出一个 ```cpp 代码块。'

        let viz = ''
        let lastErr = ''
        const maxAttempts = 3
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          update(attempt === 1 ? '请求模型生成…' : `修复重试 ${attempt - 1}/${maxAttempts - 1}…`)
          const user =
            attempt === 1
              ? [
                  '用户源码如下，请转换为带 visualization tracers 的可执行完整代码。',
                  `语言：${langName}`,
                  langHint,
                  '【重要】delay 参数 = 源码 0-based 行号。',
                  '【源码】',
                  langName === 'python' ? '```python' : langName === 'cpp' ? '```cpp' : '```javascript',
                  sourceCode,
                  '```',
                ].join('\n')
              : [
                  '上一版可视化代码未通过校验/试跑，请按内嵌规范全文修复，只输出一个代码块。',
                  `语言：${langName}`,
                  langHint,
                  `【失败原因】${lastErr}`,
                  '【上一版代码】',
                  '```',
                  viz,
                  '```',
                  '【源码】',
                  sourceCode,
                  '```',
                ].join('\n')

          const reply = await chatComplete(loadAiSettings(), [
            { role: 'system', content: sys },
            { role: 'user', content: user },
          ])
          const code = extractCodeBlock(reply, langName)
          if (!code) {
            lastErr = 'AI 未返回可用代码块'
            continue
          }
          viz = code

          update(`静态校验（${attempt}/${maxAttempts}）…`)
          const report = validateVizCode(viz, langName)
          if (!report.ok) {
            lastErr = formatValidateError(report)
            continue
          }

          if (langName === 'javascript' || langName === 'python' || langName === 'cpp') {
            update(`试跑验证（${attempt}/${maxAttempts}）…`)
            let run: { ok: true; commands: unknown[] } | { ok: false; error: string }
            if (langName === 'javascript') {
              const { runJsAlgorithm } = await import('@/core/runners/js')
              run = await runJsAlgorithm(viz)
            } else if (langName === 'python') {
              const { runPythonAlgorithm } = await import('@/core/runners/python')
              run = await runPythonAlgorithm(viz)
            } else {
              const { detectCppServer, runCppAlgorithm } = await import('@/core/runners/cpp')
              const health = await detectCppServer()
              if (!health.ok) {
                update('C++ 服务不可用，跳过试跑（仅静态校验）')
                run = { ok: true, commands: [{}] }
              } else {
                run = await runCppAlgorithm(viz)
              }
            }
            if (!run.ok) {
              lastErr = `试跑失败：${run.error}`
              continue
            }
            if (!run.commands.length) {
              lastErr = '试跑未产生可视化命令（检查 Tracer/Layout/delay）'
              continue
            }
          }

          update('写入本地…')
          const now = Date.now()
          const next: Algorithm = {
            ...algorithm,
            sourceCode,
            vizCode: viz,
            editorMode: 'viz',
            files: [
              {
                name:
                  algorithm.files[0]?.name ??
                  `main.${langName === 'python' ? 'py' : langName === 'cpp' ? 'cpp' : 'js'}`,
                content: viz,
              },
            ],
            updatedAt: now,
          }
          await saveAlgorithm(next)
          onApplied?.(next)
          return attempt === 1 ? '已通过校验与试跑' : `修复后通过（第 ${attempt} 次）`
        }
        throw new Error(lastErr || '生成失败')
      } finally {
        onSettled?.()
      }
    },
  })
}

/** Append assistant reply to a chat session in the background. */
export function startChatJob(opts: {
  sessionTitle: string
  sessionId: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  onSettled?: () => void
}) {
  return startAiJob({
    kind: 'chat',
    title: opts.sessionTitle,
    run: async ({ update }) => {
      update('生成回复…')
      try {
        const reply = await chatComplete(loadAiSettings(), opts.messages)
        const { loadChatSessions, upsertChatSession } = await import('./aiClient')
        const latest = loadChatSessions().find((s) => s.id === opts.sessionId)
        if (!latest) return '会话已关闭'
        upsertChatSession({
          ...latest,
          messages: [
            ...latest.messages,
            { role: 'assistant', content: reply, createdAt: Date.now() },
          ],
          updatedAt: Date.now(),
        })
        return '回复已写入会话'
      } finally {
        opts.onSettled?.()
      }
    },
  })
}
