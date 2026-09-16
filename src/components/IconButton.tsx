import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  busy?: boolean
  children: ReactNode
}

export function IconButton({
  label,
  active = false,
  busy = false,
  className = '',
  children,
  disabled,
  ...rest
}: IconButtonProps) {
  const classes = [
    'icon-btn',
    active ? 'icon-btn--active' : '',
    busy ? 'btn--busy' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      title={label}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {children}
    </button>
  )
}
