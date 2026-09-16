import type { ReactNode } from 'react'

export interface ChipOption<T extends string = string> {
  value: T
  label: string
  disabled?: boolean
  title?: string
}

interface ChipRowProps<T extends string> {
  options: ChipOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  className?: string
  renderExtra?: ReactNode
}

/**
 * Expanding Tag Selection — advanced-interaction-design §10
 * Selected chip scales up; neighbors reflow via flex gap + transform.
 */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = '选项',
  className = '',
  renderExtra,
}: ChipRowProps<T>) {
  return (
    <div className={`chip-row ${className}`.trim()} role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`chip${selected ? ' chip--selected' : ''}`}
            disabled={opt.disabled}
            title={opt.title}
            onClick={() => {
              if (!opt.disabled) onChange(opt.value)
            }}
          >
            {opt.label}
          </button>
        )
      })}
      {renderExtra}
    </div>
  )
}
