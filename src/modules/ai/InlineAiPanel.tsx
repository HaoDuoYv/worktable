import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Link } from 'react-router-dom'
import {
  chatComplete,
  isAiConfigured,
  loadAiSettings,
  type ChatMessage,
} from './aiClient'

export interface InlineAiPanelProps {
  title: string
  systemPrompt: string
  autoAsk?: string
  open: boolean
  onClose: () => void
}

const POS_KEY = 'worktable.ai.float.pos'

function loadPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { x: number; y: number }
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) return p
    }
  } catch {
    /* ignore */
  }
  return { x: -1, y: -1 } // -1 = auto
}

function savePos(x: number, y: number) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify({ x, y }))
  } catch {
    /* ignore */
  }
}

/**
 * 可拖动 AI 悬浮小窗 — 不遮挡主界面大半区域。
 */
export function InlineAiPanel({
  title,
  systemPrompt,
  autoAsk,
  open,
  onClose,
}: InlineAiPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [pos, setPos] = useState(() => loadPos())
  const listRef = useRef<HTMLDivElement | null>(null)
  const autoAsked = useRef(false)
  const dragging = useRef(false)
  const dragOrigin = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const winRef = useRef<HTMLDivElement | null>(null)
  const configured = isAiConfigured()

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages.length, busy, open, minimized])

  useEffect(() => {
    if (!open) {
      autoAsked.current = false
      setError(null)
    }
  }, [open])

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return
      if (!isAiConfigured()) {
        setError('请先在设置中配置 AI 接口地址与密钥。')
        return
      }
      const userMsg: ChatMessage = {
        role: 'user',
        content: text.trim(),
        createdAt: Date.now(),
      }
      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
      setBusy(true)
      setError(null)
      try {
        const reply = await chatComplete(loadAiSettings(), [
          { role: 'system', content: systemPrompt },
          ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
        ])
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: reply, createdAt: Date.now() },
        ])
      } catch (e) {
        setError(e instanceof Error ? e.message : '请求失败')
      } finally {
        setBusy(false)
      }
    },
    [busy, messages, systemPrompt],
  )

  useEffect(() => {
    if (!open || !autoAsk || autoAsked.current) return
    autoAsked.current = true
    void send(autoAsk)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoAsk])

  const onDragStart = (e: React.PointerEvent) => {
    const el = winRef.current
    if (!el || minimized) return
    // only drag from header, not buttons
    if ((e.target as HTMLElement).closest('button, a, textarea')) return
    dragging.current = true
    const rect = el.getBoundingClientRect()
    dragOrigin.current = {
      x: e.clientX,
      y: e.clientY,
      px: rect.left,
      py: rect.top,
    }
    e.preventDefault()

    const move = (ev: PointerEvent) => {
      if (!dragging.current) return
      const dx = ev.clientX - dragOrigin.current.x
      const dy = ev.clientY - dragOrigin.current.y
      const nx = Math.max(0, Math.min(window.innerWidth - 64, dragOrigin.current.px + dx))
      const ny = Math.max(0, Math.min(window.innerHeight - 48, dragOrigin.current.py + dy))
      setPos({ x: nx, y: ny })
    }
    const up = () => {
      dragging.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setPos((p) => {
        savePos(p.x, p.y)
        return p
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  if (!open) return null

  // default: bottom-right, not covering center
  const style: React.CSSProperties =
    pos.x >= 0 && pos.y >= 0
      ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
      : { right: 20, bottom: 20, left: 'auto', top: 'auto' }

  return (
    <div
      ref={winRef}
      className={`ai-float${minimized ? ' is-min' : ''}`}
      style={style}
      role="dialog"
      aria-label={`${title} AI 问答`}
    >
      <header className="ai-float__head" onPointerDown={onDragStart}>
        <span className="ai-float__grip" aria-hidden="true">
          ⋮⋮
        </span>
        <div className="ai-float__titles">
          <strong className="ai-float__title">{title}</strong>
          <span className="ai-float__sub">可拖动 · 已注入上下文</span>
        </div>
        <div className="ai-float__actions">
          <button
            type="button"
            className="ai-float__icon-btn"
            aria-label={minimized ? '展开' : '最小化'}
            title={minimized ? '展开' : '最小化'}
            onClick={() => setMinimized((m) => !m)}
          >
            {minimized ? '▢' : '—'}
          </button>
          {!configured ? (
            <Link to="/settings" className="ai-float__link">
              配置
            </Link>
          ) : null}
          <button
            type="button"
            className="ai-float__icon-btn"
            aria-label="关闭"
            title="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </header>

      {!minimized ? (
        <>
          <div className="ai-float__messages" ref={listRef}>
            {messages.length === 0 && !busy ? (
              <p className="ai-float__empty">
                {configured ? '提问时将附带当前页面上下文。' : '尚未配置 AI，请在设置中填写接口信息。'}
              </p>
            ) : null}
            {messages.map((m, i) => (
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
          <div className="ai-float__composer">
            <textarea
              rows={2}
              value={input}
              placeholder="输入问题… Enter 发送"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
            />
            <Button
              variant="primary"
              size="sm"
              busy={busy}
              disabled={!input.trim()}
              onClick={() => void send(input)}
            >
              发送
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}

export { extractCodeBlock } from '@/modules/algorithms/vizValidate'
