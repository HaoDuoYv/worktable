import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/Page'
import {
  buildAlgoSystemPrompt,
  buildTutorialSystemPrompt,
  chatComplete,
  createChatId,
  deleteChatSession,
  formatAlgorithmContext,
  formatTutorialContext,
  isAiConfigured,
  loadAiSettings,
  loadChatSessions,
  upsertChatSession,
  type ChatMessage,
  type ChatSession,
} from './aiClient'
import { getAlgorithm, getNote, getTutorial, saveTutorial } from '@/core/storage/indexedDb'
import { noteId } from '@/modules/tutorials/types'
import { primaryCode } from '@/modules/algorithms/types'
import { seedBuiltinAlgorithms } from '@/modules/algorithms/seed'

function newSession(context?: ChatSession['context'], title = '新对话'): ChatSession {
  const now = Date.now()
  return {
    id: createChatId(),
    title,
    createdAt: now,
    updatedAt: now,
    context,
    messages: [],
  }
}

export function AiPage() {
  const [params] = useSearchParams()
  const configured = useMemo(() => isAiConfigured(), [])
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadChatSessions())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [injectPreview, setInjectPreview] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  )

  // deep-link: /ai?tutorial=id&step=n  or  /ai?algorithm=id&action=visualize
  useEffect(() => {
    const tutorialId = params.get('tutorial')
    const stepRaw = params.get('step')
    const algorithmId = params.get('algorithm')
    const action = params.get('action')

    let cancelled = false

    async function bootstrap() {
      if (tutorialId) {
        let t = await getTutorial(tutorialId)
        if (!t && tutorialId === 'uring-redis') {
          const res = await fetch('/tutorials/uring-redis.json')
          if (res.ok) {
            t = (await res.json()) as Awaited<ReturnType<typeof getTutorial>>
            if (t) {
              t = {
                ...t,
                updatedAt: Date.now(),
                progress: t.progress ?? { lastStep: 0, completedSteps: [] },
              }
              await saveTutorial(t)
            }
          }
        }
        if (!t || cancelled) return
        const stepIndex = Number(stepRaw ?? t.progress?.lastStep ?? 0)
        const step = t.steps[stepIndex]
        if (!step) return
        const note = await getNote(noteId(t.id, stepIndex))
        const ctx = formatTutorialContext({
          tutorialTitle: t.title,
          stepTitle: step.title,
          stepMessage: step.message,
          note: note?.content,
          changed: step.changed,
        })
        const session = newSession(
          { type: 'tutorial-step', tutorialId: t.id, stepIndex },
          `${t.title} · 步骤 ${stepIndex + 1}`,
        )
        session.messages = [
          {
            role: 'system',
            content: `${buildTutorialSystemPrompt()}\n\n${ctx}`,
            createdAt: Date.now(),
          },
        ]
        upsertChatSession(session)
        setSessions(loadChatSessions())
        setActiveId(session.id)
        setInjectPreview(ctx.slice(0, 280))
        return
      }

      if (algorithmId) {
        await seedBuiltinAlgorithms()
        const algo = await getAlgorithm(algorithmId)
        if (!algo || cancelled) return
        const code = primaryCode(algo)
        const ctx = formatAlgorithmContext({
          title: algo.title,
          description: algo.description,
          language: algo.language,
          category: algo.category,
          code,
        })
        const session = newSession(
          { type: 'algorithm', algorithmId: algo.id },
          `算法 · ${algo.title}`,
        )
        const userHint =
          action === 'visualize'
            ? '请把下面算法补全为带 algorithm-visualizer 可视化的完整 JavaScript，并用代码块输出。'
            : '请解释下面算法的思路、复杂度，并指出可改进点。'
        session.messages = [
          { role: 'system', content: buildAlgoSystemPrompt(), createdAt: Date.now() },
          { role: 'user', content: `${userHint}\n\n${ctx}`, createdAt: Date.now() },
        ]
        upsertChatSession(session)
        setSessions(loadChatSessions())
        setActiveId(session.id)
        setInjectPreview(ctx.slice(0, 280))
        // auto-send first user message
        if (!cancelled) {
          setInput('')
          void sendSession(session.id)
        }
      }
    }

    if (tutorialId || algorithmId) void bootstrap()
    else if (!activeId && sessions[0]) setActiveId(sessions[0].id)

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [active?.messages.length, busy])

  const persist = useCallback((session: ChatSession) => {
    upsertChatSession(session)
    setSessions(loadChatSessions())
  }, [])

  const sendSession = useCallback(
    async (sessionId: string, userText?: string) => {
      const settings = loadAiSettings()
      if (!isAiConfigured(settings)) {
        setError('请先在设置中配置 AI 接口地址与密钥。')
        return
      }
      const current = loadChatSessions().find((s) => s.id === sessionId)
      if (!current) return

      let messages = current.messages
      if (userText != null) {
        messages = [
          ...messages,
          { role: 'user', content: userText, createdAt: Date.now() },
        ]
        const next: ChatSession = {
          ...current,
          messages,
          updatedAt: Date.now(),
          title:
            current.messages.length <= 1
              ? userText.slice(0, 24) || current.title
              : current.title,
        }
        persist(next)
      }

      setBusy(true)
      setError(null)
      try {
        const reply = await chatComplete(
          settings,
          messages.map((m) => ({ role: m.role, content: m.content })),
        )
        const latest = loadChatSessions().find((s) => s.id === sessionId)
        if (!latest) return
        const assistant: ChatMessage = {
          role: 'assistant',
          content: reply,
          createdAt: Date.now(),
        }
        persist({
          ...latest,
          messages: [...latest.messages, assistant],
          updatedAt: Date.now(),
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : '请求失败')
      } finally {
        setBusy(false)
      }
    },
    [persist],
  )

  const onSend = useCallback(() => {
    const text = input.trim()
    if (!text || !active || busy) return
    setInput('')
    void sendSession(active.id, text)
  }, [active, busy, input, sendSession])

  const onCreate = useCallback(() => {
    const s = newSession()
    persist(s)
    setActiveId(s.id)
    setInjectPreview(null)
  }, [persist])

  if (!configured && !params.get('tutorial') && !params.get('algorithm')) {
    return (
      <div className="page">
        <EmptyState
          title="尚未配置 AI"
          text="请先在设置中配置 AI 接口地址与密钥。支持 DeepSeek、通义、Kimi、Ollama 等兼容端点。"
          actions={
            <Link to="/settings">
              <Button variant="primary">打开设置</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="ai-page">
      <aside className="ai-page__side">
        <div className="ai-page__side-head">
          <Button variant="primary" size="sm" onClick={onCreate}>
            新对话
          </Button>
        </div>
        <ul className="ai-page__sessions">
          {sessions.map((s) => (
            <li key={s.id}>
              <div className={`ai-session${s.id === activeId ? ' is-active' : ''}`}>
                <button type="button" className="ai-session__main" onClick={() => setActiveId(s.id)}>
                  <span className="ai-session__title">{s.title}</span>
                  <span className="ai-session__meta">
                    {s.context?.type === 'tutorial-step'
                      ? '教程'
                      : s.context?.type === 'algorithm'
                        ? '算法'
                        : '通用'}
                  </span>
                </button>
                <button
                  type="button"
                  className="algo-item__del"
                  aria-label="删除会话"
                  onClick={() => {
                    deleteChatSession(s.id)
                    const rest = loadChatSessions()
                    setSessions(rest)
                    if (activeId === s.id) setActiveId(rest[0]?.id ?? null)
                  }}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
          {sessions.length === 0 ? <li className="algo-empty">暂无会话</li> : null}
        </ul>
      </aside>

      <section className="ai-page__chat">
        {!active ? (
          <div className="page">
            <EmptyState
              title="开始提问"
              text="新建对话，或从教程步骤 / 算法编辑器跳入并带上上下文。"
              actions={<Button variant="primary" onClick={onCreate}>新对话</Button>}
            />
          </div>
        ) : (
          <>
            <header className="ai-page__chat-head">
              <div>
                <h2 className="ai-page__chat-title">{active.title}</h2>
                {injectPreview ? (
                  <p className="ai-page__inject">已注入上下文 · {injectPreview}…</p>
                ) : null}
              </div>
              {!isAiConfigured() ? (
                <Link to="/settings">
                  <Button size="sm" variant="ghost">
                    去配置
                  </Button>
                </Link>
              ) : null}
            </header>

            <div className="ai-page__messages" ref={listRef}>
              {active.messages
                .filter((m) => m.role !== 'system')
                .map((m, i) => (
                  <div key={i} className={`ai-bubble ai-bubble--${m.role}`}>
                    <div className="ai-bubble__role">{m.role === 'user' ? '我' : 'AI'}</div>
                    <div className="ai-bubble__content">{m.content}</div>
                  </div>
                ))}
              {busy ? (
                <div className="ai-bubble ai-bubble--assistant">
                  <div className="ai-bubble__role">AI</div>
                  <div className="ai-bubble__content">思考中…</div>
                </div>
              ) : null}
              {error ? (
                <div className="algo-lab__error" role="alert">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="ai-page__composer">
              <textarea
                value={input}
                rows={3}
                placeholder="输入问题…（Enter 发送，Shift+Enter 换行）"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    onSend()
                  }
                }}
              />
              <Button variant="primary" busy={busy} disabled={!input.trim()} onClick={onSend}>
                发送
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
