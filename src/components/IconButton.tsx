import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  children: ReactNode
}

export function IconButton({
  label,
  active = false,
  className = '',
  children,
  ...rest
}: IconButtonProps) {
  const classes = ['icon-btn', active ? 'icon-btn--active' : '', className].filter(Boolean).join(' ')
  return (
    <button type="button" className={classes} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}
