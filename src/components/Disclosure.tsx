import { useId, useState, type ReactNode } from 'react'

interface DisclosureProps {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  label: string
  children: ReactNode
  className?: string
}

/** Animated Text Disclosure — DESIGN.md §7.4.1 B */
export function Disclosure({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  label,
  children,
  className = '',
}: DisclosureProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = controlledOpen ?? internalOpen
  const contentId = useId()

  const toggle = () => {
    const next = !open
    if (controlledOpen === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <div className={`disclosure${open ? ' is-open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="disclosure__trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggle}
      >
        <span className="disclosure__chevron" aria-hidden="true">
          ▼
        </span>
        <span className="disclosure__label">{label}</span>
      </button>
      <div className="disclosure__body" id={contentId} role="region">
        <div className="disclosure__body-inner">
          <div className="disclosure__content">{children}</div>
        </div>
      </div>
    </div>
  )
}
