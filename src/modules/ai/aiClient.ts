export interface AiSettings {
  baseUrl: string
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  createdAt: number
}

export interface ChatContext {
  type: 'free' | 'tutorial-step' | 'algorithm'
  tutorialId?: string
  stepIndex?: number
  algorithmId?: string
}

export interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  context?: ChatContext
  messages: ChatMessage[]
}

const AI_KEY = 'worktable.ai'
const CHAT_KEY = 'worktable.chat.sessions'

export const DEFAULT_AI: AiSettings = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 2048,
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_KEY)
    if (!raw) return { ...DEFAULT_AI }
    return { ...DEFAULT_AI, ...(JSON.parse(raw) as Partial<AiSettings>) }
  } catch {
    return { ...DEFAULT_AI }
  }
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(AI_KEY, JSON.stringify(settings))
}

export function isAiConfigured(settings: AiSettings = loadAiSettings()): boolean {
  return Boolean(settings.baseUrl.trim() && settings.apiKey.trim() && settings.model.trim())
}

export function createChatId(): string {
  return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function loadChatSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as ChatSession[]
    return Array.isArray(list) ? list.sort((a, b) => b.updatedAt - a.updatedAt) : []
  } catch {
    return []
  }
}

export function saveChatSessions(sessions: ChatSession[]): void {
  localStorage.setItem(CHAT_KEY, JSON.stringify(sessions))
}

export function upsertChatSession(session: ChatSession): void {
  const all = loadChatSessions()
  const idx = all.findIndex((s) => s.id === session.id)
  if (idx >= 0) all[idx] = session
  else all.push(session)
  saveChatSessions(all.sort((a, b) => b.updatedAt - a.updatedAt))
}

export function deleteChatSession(id: string): void {
  saveChatSessions(loadChatSessions().filter((s) => s.id !== id))
}

/** Normalize baseUrl to chat/completions endpoint. */
export function chatCompletionsUrl(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, '')
  if (url.endsWith('/chat/completions')) return url
  if (!url.endsWith('/v1')) {
    // common: https://api.openai.com -> /v1/chat/completions
    if (/^https?:\/\/[^/]+$/.test(url)) url = `${url}/v1`
  }
  return `${url}/chat/completions`
}

export interface StreamCallbacks {
  onDelta?: (text: string) => void
  onDone?: (full: string) => void
  onError?: (message: string) => void
}

/**
 * Call OpenAI-compatible chat completions (non-stream first for simplicity).
 * Returns assistant text.
 */
export async function chatComplete(
  settings: AiSettings,
  messages: { role: ChatMessage['role']; content: string }[],
): Promise<string> {
  const url = chatCompletionsUrl(settings.baseUrl)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: settings.temperature ?? 0.7,
      max_tokens: settings.maxTokens ?? 2048,
      stream: false,
    }),
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const err = (await res.json()) as { error?: { message?: string } }
      if (err.error?.message) detail = err.error.message
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('AI 返回为空')
  return text
}

export async function testAiConnection(settings: AiSettings): Promise<string> {
  return chatComplete(settings, [
    { role: 'system', content: '你是 Worktable 的 AI 助手。' },
    { role: 'user', content: '请只回复：连接成功' },
  ])
}

export function buildTutorialSystemPrompt(): string {
  return [
    '你是个人学习工作台里的中文助教，帮助用户理解分步编程教程。',
    '回答要准确、简洁、可操作；必要时给出代码片段。',
    '若用户问当前步骤，优先基于提供的教程上下文回答，并指出对应文件或概念。',
  ].join('\n')
}

export function buildAlgoSystemPrompt(): string {
  return [
    '你是算法可视化助教。用户会给出算法代码（algorithm-visualizer tracers 协议）。',
    '必须严格遵循项目规范 docs/VIS_SPEC.md 与 docs/VIS_ANIMATION_SPEC.md：',
    '可用 Tracer：Array1DTracer, Array2DTracer, LogTracer, GraphTracer, TreeTracer, StackTracer, QueueTracer, LinkedListTracer, CircularQueueTracer, DequeTracer, RedBlackTreeTracer, BPlusTreeTracer, StaticLinkedListTracer, ChartTracer, ScatterTracer, MarkdownTracer。',
    '序列：Stack push/pop；Queue enqueue/dequeue；LinkedList push/unshift/pop/shift；CircularQueue init/enqueue/dequeue；Deque pushFront/popFront/pushBack/popBack。',
    '树：RedBlackTree set([{id,parent,left,right,color,label}])+setColor+rotateLeft/rotateRight；BPlusTree set+split/setLabel。',
    '静态链表：StaticLinkedList init/setData/setNext 或 set(data,next)。',
    '图（对齐官方 AV）：GraphTracer.set(邻接矩阵) 或 addNode/addEdge/removeNode/removeEdge/updateNode/updateEdge；directed(bool)、weighted(bool)；layoutCircle()/layoutTree(root?)/layoutRandom()；visit/leave/select/deselect；graph.log(logTracer) 可自动写访问日志。',
    '图表：ChartTracer.set(数值数组) 或 Array1D.set 后 array1d.chart(chartTracer) 同步柱状图；ScatterTracer.set([[x,y],…]) 散点。',
    '日志：LogTracer.print/println/printf（printf 支持 %s %d %f）；MarkdownTracer.set(markdown) 渲染说明文本。',
    '数值数组务必 set(纯数字) 以触发柱状图；比较用 select、写入用 patch，不要混用。',
    '可视化步骤对齐源码：Tracer.delay(N) 中的 N 必须是【源码 sourceCode】的 0-based 行号（不是可视化代码行号）。',
    '每个关键逻辑步骤后调用 delay(对应源码行号)，便于播放时高亮源码。',
    '日志变量观察：关键变量请用 LogTracer 打印为「标识符=值」（如 i=2、A[0]=5），供界面变量条解析。',
    '操作计数：在插入/删除/查找/比较/交换/遍历处 println 输出中文操作词，供统计窗口计数。',
    '- 至少创建 1 个 Tracer',
    '- 必须 Layout.setRoot（Python 可用 set_root；C++ 必须 Layout::setRoot，禁止 Layout.setRoot）',
    '- 必须至少 1 次 Tracer.delay()（C++ 为 Tracer::delay）',
    '- JS 必须 require("algorithm-visualizer")，禁止 ESM import',
    '- Python 禁止 import algorithm_visualizer（运行时已注入）',
    '- C++ 必须 #include "av.h" 与 using namespace av（或 av::）',
    '任务：解释算法、指出错误，或把普通代码补全为带可视化调用的完整单文件。',
    '若要求「只输出代码」，请用 ```javascript / ```python / ```cpp 包裹完整文件。',
  ].join('\n')
}

export function formatTutorialContext(opts: {
  tutorialTitle: string
  stepTitle: string
  stepMessage: string
  note?: string
  changed?: string[]
}): string {
  const msg = opts.stepMessage.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const excerpt = msg.length > 1800 ? `${msg.slice(0, 1800)}…` : msg
  return [
    `【教程】${opts.tutorialTitle}`,
    `【步骤】${opts.stepTitle}`,
    opts.changed?.length ? `【涉及文件】${opts.changed.join(', ')}` : '',
    `【讲解摘要】${excerpt}`,
    opts.note ? `【用户备注】${opts.note}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function formatAlgorithmContext(algo: {
  title: string
  description?: string
  language: string
  category: string
  code: string
}): string {
  return [
    `【算法】${algo.title}`,
    algo.description ? `【说明】${algo.description}` : '',
    `【语言】${algo.language} · 【分类】${algo.category}`,
    '【代码】',
    '```javascript',
    algo.code.slice(0, 8000),
    '```',
  ]
    .filter(Boolean)
    .join('\n')
}
