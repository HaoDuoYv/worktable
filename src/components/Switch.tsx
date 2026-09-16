import { useCallback, useRef } from 'react'

export interface SwitchOption {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  hint?: string
}

interface SettingsSwitchGroupProps {
  title?: string
  options: SwitchOption[]
  onChange: (id: string, checked: boolean) => void
}

/**
 * Ripple Feedback for Related Switches — advanced-interaction-design §7
 * Source switch updates real state; neighbors only receive visual ripple.
 */
export function SettingsSwitchGroup({ title, options, onChange }: SettingsSwitchGroupProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)

  const rippleNeighbors = useCallback((fromIndex: number) => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const switches = [...root.querySelectorAll<HTMLElement>('.switch')]
    switches.forEach((el, i) => {
      if (i === fromIndex) return
      const dist = Math.abs(i - fromIndex)
      el.classList.remove('is-ripple')
      void el.offsetWidth
      window.setTimeout(() => {
        el.classList.add('is-ripple')
        window.setTimeout(() => el.classList.remove('is-ripple'), 450)
      }, dist * 50)
    })
  }, [])

  return (
    <div ref={rootRef} className="switch-group">
      {title ? <div className="switch-group__title">{title}</div> : null}
      {options.map((opt, i) => (
        <div key={opt.id} className="switch-row">
          <button
            type="button"
            role="switch"
            aria-checked={opt.checked}
            aria-label={opt.label}
            disabled={opt.disabled}
            className={`switch${opt.checked ? ' is-on' : ''}${opt.disabled ? ' is-disabled' : ''}`}
            onClick={() => {
              if (opt.disabled) return
              onChange(opt.id, !opt.checked)
              rippleNeighbors(i)
            }}
          >
            <span className="switch__track" aria-hidden="true">
              <span className="switch__thumb" />
            </span>
          </button>
          <div className="switch-row__text">
            <span className="switch-row__label">{opt.label}</span>
            {opt.hint ? <span className="switch-row__hint">{opt.hint}</span> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Simple standalone switch for single toggles. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`switch${checked ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
      <span className="switch__label">{label}</span>
    </button>
  )
}
