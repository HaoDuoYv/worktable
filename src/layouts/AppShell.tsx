import { NavLink, Outlet, useMatches, Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/modules/auth/AuthContext'

const NAV_ITEMS: {
  to: string
  label: string
  end?: boolean
  icon: ReactNode
}[] = [
  {
    to: '/',
    label: '概览',
    end: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" opacity="0.5" />
      </svg>
    ),
  },
  {
    to: '/tutorials',
    label: '教程',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" stroke="currentColor" strokeWidth="1.7" opacity="0.55" />
      </svg>
    ),
  },
  {
    to: '/algorithms',
    label: '算法',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="14" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" />
        <rect x="10" y="9" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.7" />
        <rect x="17" y="4" width="4" height="17" rx="1" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    to: '/ai',
    label: 'AI',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3l1.8 4.8L19 9.6l-5.2 1.8L12 16.2l-1.8-4.8L5 9.6l5.2-1.8L12 3Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: '设置',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
]

function useRouteChrome(): { title: string; flush: boolean } {
  const matches = useMatches()
  const last = matches[matches.length - 1]
  const handle = last?.handle as { title?: string; flush?: boolean } | undefined
  return {
    title: handle?.title ?? 'Worktable',
    flush: Boolean(handle?.flush),
  }
}

export function AppShell({ children }: { children?: ReactNode }) {
  const { title, flush } = useRouteChrome()
  const { user, isGuest, logout } = useAuth()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主内容
      </a>
      <nav className="app-shell__nav" aria-label="主导航">
        <div className="app-shell__brand">
          <span className="app-shell__brand-mark" aria-hidden="true">
            WT
          </span>
          <span className="app-shell__brand-text">Worktable</span>
        </div>
        <div className="app-shell__nav-label">工作区</div>
        <ul className="app-shell__nav-list">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `app-shell__nav-link${isActive ? ' is-active' : ''}`
                }
              >
                <span className="app-shell__nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="app-shell__nav-footer">
          <span className="app-shell__status-dot" aria-hidden="true" />
          v0.3 · 本地优先
        </div>
      </nav>

      <header className="app-shell__header">
        <h1 className="app-shell__header-title">{title}</h1>
        <div className="app-shell__header-actions">
          {isGuest ? (
            <Link to="/login" className="app-shell__login-link">
              登录
            </Link>
          ) : (
            <button
              type="button"
              className="app-shell__login-link"
              title={user?.email}
              onClick={() => void logout()}
            >
              {user?.displayName || user?.email}
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main id="main-content" className={`app-shell__main${flush ? ' is-flush' : ''}`}>
        {children ?? <Outlet />}
      </main>
    </div>
  )
}
