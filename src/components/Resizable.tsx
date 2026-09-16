import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export interface ResizeHandleProps {
  axis?: 'x' | 'y'
  onStart?: () => void
  onDrag: (delta: number) => void
  label?: string
  className?: string
}

/** Pointer split handle. onDrag gets cumulative px delta from drag start. */
export function ResizeHandle({
  axis = 'x',
  onStart,
  onDrag,
  label = '调整大小',
  className = '',
}: ResizeHandleProps) {
  const dragging = useRef(false)
  const origin = useRef(0)

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragging.current = true
    origin.current = axis === 'x' ? e.clientX : e.clientY
    onStart?.()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const now = axis === 'x' ? e.clientX : e.clientY
    onDrag(now - origin.current)
  }

  const end = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      tabIndex={0}
      className={`resize-handle resize-handle--${axis} ${className}`.trim()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          onStart?.()
          onDrag(-16)
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault()
          onStart?.()
          onDrag(16)
        }
      }}
    />
  )
}

export function usePersistedWidth(key: string, fallback: number) {
  const [width, setWidth] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      const n = raw ? Number(raw) : NaN
      return Number.isFinite(n) && n > 0 ? n : fallback
    } catch {
      return fallback
    }
  })

  const set = useCallback(
    (v: number) => {
      setWidth(v)
      try {
        localStorage.setItem(key, String(Math.round(v)))
      } catch {
        /* ignore */
      }
    },
    [key],
  )

  return [width, set] as const
}

export interface ThreePaneLayoutProps {
  left: ReactNode
  center: ReactNode
  right: ReactNode
  leftKey: string
  rightKey: string
  leftMin?: number
  leftMax?: number
  rightMin?: number
  rightMax?: number
  leftDefault?: number
  rightDefault?: number
}

/** Horizontal 3-pane layout with two draggable separators (widths persist). */
export function ThreePaneLayout({
  left,
  center,
  right,
  leftKey,
  rightKey,
  leftMin = 200,
  leftMax = 480,
  rightMin = 260,
  rightMax = 640,
  leftDefault = 260,
  rightDefault = 360,
}: ThreePaneLayoutProps) {
  const [leftW, setLeftW] = usePersistedWidth(leftKey, leftDefault)
  const [rightW, setRightW] = usePersistedWidth(rightKey, rightDefault)
  const leftStart = useRef(leftW)
  const rightStart = useRef(rightW)

  const startLeft = useCallback(() => {
    leftStart.current = leftW
  }, [leftW])

  const startRight = useCallback(() => {
    rightStart.current = rightW
  }, [rightW])

  const onLeftDrag = useCallback(
    (delta: number) => {
      setLeftW(clamp(leftStart.current + delta, leftMin, leftMax))
    },
    [leftMax, leftMin, setLeftW],
  )

  const onRightDrag = useCallback(
    (delta: number) => {
      // dragging handle to the right shrinks the right pane
      setRightW(clamp(rightStart.current - delta, rightMin, rightMax))
    },
    [rightMax, rightMin, setRightW],
  )

  return (
    <div
      className="three-pane"
      style={
        {
          '--pane-left': `${leftW}px`,
          '--pane-right': `${rightW}px`,
        } as CSSProperties
      }
    >
      <div className="three-pane__left">{left}</div>
      <ResizeHandle label="调整步骤列表宽度" onStart={startLeft} onDrag={onLeftDrag} />
      <div className="three-pane__center">{center}</div>
      <ResizeHandle label="调整 Diff 宽度" onStart={startRight} onDrag={onRightDrag} />
      <div className="three-pane__right">{right}</div>
    </div>
  )
}
