import { useEffect, useId, useRef, useState } from 'react'
import { Icon, type IconName } from '@/components/Icon'

export type SelectMenuItem<T extends string> = {
  value: T
  label: string
  icon?: IconName
  hint?: string
}

export type SelectMenuProps<T extends string> = {
  items: SelectMenuItem<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  disabled?: boolean
  /** Optional icon on the trigger when the item has none. */
  triggerIcon?: IconName
  className?: string
}

/**
 * Compact select menu — trigger shows current label + chevron;
 * open list marks the active row with a check (VS Code-style).
 */
export function SelectMenu<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  triggerIcon,
  className = '',
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()
  const current = items.find((i) => i.value === value) ?? items[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`select-menu${className ? ` ${className}` : ''}`} ref={rootRef}>
      <button
        type="button"
        className="select-menu__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {current?.icon || triggerIcon ? (
          <Icon name={(current?.icon ?? triggerIcon) as IconName} size={16} />
        ) : null}
        <span className="select-menu__label">{current?.label}</span>
        <Icon name="chevron-down" size={14} className="select-menu__chevron" />
      </button>
      {open ? (
        <ul className="select-menu__list" id={listId} role="listbox" aria-label={ariaLabel}>
          {items.map((item) => {
            const selected = item.value === value
            return (
              <li key={item.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`select-menu__item${selected ? ' is-selected' : ''}`}
                  onClick={() => {
                    onChange(item.value)
                    setOpen(false)
                  }}
                >
                  {item.icon ? <Icon name={item.icon} size={16} /> : <span className="select-menu__item-spacer" />}
                  <span className="select-menu__item-text">
                    <span>{item.label}</span>
                    {item.hint ? <span className="select-menu__item-hint">{item.hint}</span> : null}
                  </span>
                  {selected ? <Icon name="check" size={16} className="select-menu__check" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
