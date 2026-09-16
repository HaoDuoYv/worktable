import type { ReactNode } from 'react'
import { Button } from './Button'

interface EmptyStateProps {
  title: string
  text: string
  actions?: ReactNode
}

export function EmptyState({ title, text, actions }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__text">{text}</p>
      {actions ? <div className="empty-state__actions">{actions}</div> : null}
    </div>
  )
}

export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string
  desc?: string
  actions?: ReactNode
}) {
  return (
    <header style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
        }}
      >
        <div>
          <h1 className="page__title">{title}</h1>
          {desc ? <p className="page__desc">{desc}</p> : null}
        </div>
        {actions ? <div style={{ display: 'flex', gap: 8 }}>{actions}</div> : null}
      </div>
    </header>
  )
}

export { Button }
