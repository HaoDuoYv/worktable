import type { Algorithm } from '@/modules/algorithms/types'
import { saveAlgorithm } from '@/core/storage/indexedDb'
import { chatComplete, loadAiSettings, buildAlgoSystemPrompt } from './aiClient'
import { extractCodeBlock, validateVizCode, formatValidateError } from '@/modules/algorithms/vizValidate'
import { startAiJob } from './aiJobs'

/**
 * Convert source → viz code in a background job (survives navigation).
 * Writes to IndexedDB only after validation passes.
 */
export function startVizConvertJob(opts: {
  algorithm: Algorithm
  sourceCode: string
  onApplied?: (algorithm: Algorithm) => void
}) {
  const { algorithm, sourceCode, onApplied } = opts
  const langName = algorithm.language

  return startAiJob({
    kind: 'viz',
    title: algorithm.title,
    run: async ({ update }) => {
      update('请求模型…')
      if (!sourceCode.trim()) throw new Error('源码为空')

      const prompt = [
        buildAlgoSystemPrompt(),
        '',
        '用户源码如下，请转换为带 visualization tracers 的可执行完整代码。',
        `语言：${langName}`,
        langName === 'javascript'
          ? '必须使用 require("algorithm-visualizer")，Array1DTracer/LogTracer，Tracer.delay()，Layout.setRoot。只输出一个 ```javascript 代码块，不要解释。'
          : langName === 'python'
            ? '直接使用注入的 Array1DTracer/LogTracer/Tracer/Layout，不要 import algorithm_visualizer。只输出一个 ```python 代码块。'
            : '使用 #include "av.h" 与 av:: 命名空间。只输出一个 ```cpp 代码块。',
        '',
        '【源码】',
        langName === 'python' ? '```python' : langName === 'cpp' ? '```cpp' : '```javascript',
        sourceCode,
        '```',
      ].join('\n')

      const reply = await chatComplete(loadAiSettings(), [
        { role: 'system', content: buildAlgoSystemPrompt() },
        { role: 'user', content: prompt },
      ])

      update('校验代码…')
      const viz = extractCodeBlock(reply, langName)
      if (!viz) throw new Error('AI 未返回可用代码块，已保留原可视化代码')

      const report = validateVizCode(viz, langName)
      if (!report.ok) throw new Error(formatValidateError(report))

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

      const warn =
        report.warnings.length > 0 ? `警告：${report.warnings.join('；')}` : '已通过校验'
      return warn
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
