import { useCallback, useRef, useState } from 'react'
import { Button } from './Button'

export interface StepperProps {
  total: number
  /** 0-based current index */
  current: number
  onChange: (index: number) => void
  label?: string
  prevLabel?: string
  nextLabel?: string
  renderMeta?: (current: number, total: number) => string
}

/**
 * Spring Stepper Progress — advanced-interaction-design §6
 * Segment overshoots then settles; state never lags the real step.
 */
export function Stepper({
  total,
  current,
  onChange,
  label = '步骤进度',
  prevLabel = '上一步',
  nextLabel = '下一步',
  renderMeta = (c, t) => `步骤 ${c + 1} / ${t}`,
}: StepperProps) {
  const [bumpKey, setBumpKey] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const animTimer = useRef<number | null>(null)

  const go = useCallback(
    (index: number) => {
      if (index < 0 || index >= total || index === current) return
      setDir(index > current ? 1 : -1)
      onChange(index)
      setBumpKey((k) => k + 1)
      if (animTimer.current) window.clearTimeout(animTimer.current)
      animTimer.current = window.setTimeout(() => setBumpKey(0), 360)
    },
    [current, onChange, total],
  )

  return (
    <div className="stepper">
      <div className="stepper__track" role="tablist" aria-label={label}>
        {Array.from({ length: total }, (_, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo'
          const isBump = i === current && bumpKey > 0
          return (
            <button
              key={`${i}-${bumpKey > 0 && i === current ? bumpKey : 's'}`}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`第 ${i + 1} 步`}
              className={[
                'stepper__seg',
                state === 'done' ? 'stepper__seg--done' : '',
                state === 'current' ? 'stepper__seg--current' : '',
                isBump ? 'is-bumping' : '',
                isBump ? (dir > 0 ? 'bump-next' : 'bump-prev') : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => go(i)}
            />
          )
        })}
      </div>
      <div className="stepper__meta">
        <span>{renderMeta(current, total)}</span>
        <div className="stepper__controls">
          <Button variant="ghost" size="sm" disabled={current <= 0} onClick={() => go(current - 1)}>
            {prevLabel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={current >= total - 1}
            onClick={() => go(current + 1)}
          >
            {nextLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
