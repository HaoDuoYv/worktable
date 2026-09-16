import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'

const SPEED_STEPS = [0.25, 0.5, 1, 2, 4] as const
export type Speed = (typeof SPEED_STEPS)[number]

export interface PlayerBarProps {
  playing: boolean
  cursor: number
  total: number
  speed: Speed
  building?: boolean
  disabled?: boolean
  onPlayToggle: () => void
  onStep: (delta: number) => void
  onSeek: (cursor: number) => void
  onSpeedChange: (speed: Speed) => void
  onRun: () => void
}

/** Velocity-Based Slider Snap — DESIGN.md §7.4.1 D */
function snapSpeed(velocity: number, index: number): number {
  const boost = velocity > 1.2 ? 1 : velocity < -1.2 ? -1 : 0
  return Math.max(0, Math.min(SPEED_STEPS.length - 1, index + boost))
}

export function PlayerBar({
  playing,
  cursor,
  total,
  speed,
  building = false,
  disabled = false,
  onPlayToggle,
  onStep,
  onSeek,
  onSpeedChange,
  onRun,
}: PlayerBarProps) {
  const [speedIndex, setSpeedIndex] = useState(() => SPEED_STEPS.indexOf(speed))
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)
  const lastX = useRef(0)
  const lastT = useRef(0)
  const velocity = useRef(0)

  const commitSpeed = useCallback(
    (index: number) => {
      const next = SPEED_STEPS[index]
      setSpeedIndex(index)
      onSpeedChange(next)
    },
    [onSpeedChange],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = true
    lastX.current = e.clientX
    lastT.current = performance.now()
    velocity.current = 0
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const now = performance.now()
    const dt = Math.max(now - lastT.current, 1)
    velocity.current = (e.clientX - lastX.current) / dt
    lastX.current = e.clientX
    lastT.current = now
  }

  const onPointerUp = () => {
    if (!dragging.current) return
    dragging.current = false
    const next = snapSpeed(velocity.current, speedIndex)
    commitSpeed(next)
  }

  const pct = total > 0 ? (cursor / total) * 100 : 0

  return (
    <div className={`player-bar${disabled ? ' is-disabled' : ''}`}>
      <Button variant="primary" size="sm" busy={building} onClick={onRun} disabled={disabled}>
        运行
      </Button>

      <div className="player-bar__transport">
        <IconButton label="上一步" disabled={disabled || cursor <= 0} onClick={() => onStep(-1)}>
          ⏮
        </IconButton>
        <IconButton
          label={playing ? '暂停' : '播放'}
          disabled={disabled || total === 0}
          onClick={onPlayToggle}
          active={playing}
        >
          {playing ? '⏸' : '▶'}
        </IconButton>
        <IconButton
          label="下一步"
          disabled={disabled || cursor >= total}
          onClick={() => onStep(1)}
        >
          ⏭
        </IconButton>
      </div>

      <div className="player-bar__timeline">
        <div
          ref={trackRef}
          className="player-bar__track"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={cursor}
          aria-label="播放进度"
          onClick={(e) => {
            if (disabled || total === 0) return
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = (e.clientX - rect.left) / rect.width
            onSeek(Math.round(ratio * total))
          }}
        >
          <div className="player-bar__fill" style={{ width: `${pct}%` }} />
          <div className="player-bar__thumb" style={{ left: `${pct}%` }} />
        </div>
        <span className="player-bar__count">
          {Math.min(cursor, total)} / {total}
        </span>
      </div>

      <div
        className="player-bar__speed"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="拖动或点击切换速度"
      >
        <span className="player-bar__speed-label">速度</span>
        <div className="player-bar__speed-track">
          {SPEED_STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              className={`speed-tick${i <= speedIndex ? ' is-on' : ''}`}
              onClick={() => commitSpeed(i)}
              aria-label={`${s}x`}
            />
          ))}
          <div
            className="player-bar__speed-thumb"
            style={{ left: `${(speedIndex / (SPEED_STEPS.length - 1)) * 100}%` }}
          />
        </div>
        <span className="player-bar__speed-value">{SPEED_STEPS[speedIndex]}×</span>
      </div>
    </div>
  )
}

export { SPEED_STEPS }
