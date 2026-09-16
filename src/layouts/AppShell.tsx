import { NavLink, Outlet, useMatches, Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/modules/auth/AuthContext'
import { Icon, WorktableMark, type IconName } from '@/components/Icon'
import { IconButton } from '@/components/IconButton'

const NAV_ITEMS: {
  to: string
  label: string
  end?: boolean
  icon: IconName
}[] = [
  { to: '/', label: '概览', end: true, icon: 'overview' },
  { to: '/tutorials', label: '教程', icon: 'tutorials' },
  { to: '/algorithms', label: '算法', icon: 'algorithms' },
  { to: '/ai', label: 'AI', icon: 'ai' },
  { to: '/settings', label: '设置', icon: 'settings' },
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
            <WorktableMark size={30} />
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
                <span className="app-shell__nav-icon">
                  <Icon name={item.icon} size={20} />
                </span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="app-shell__nav-footer">
          <span className="app-shell__status-dot" aria-hidden="true" />
          版本 0.3.0
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
            <div className="app-shell__account">
              <Link
                to="/settings"
                className="app-shell__login-link"
                title={user?.email ? `账号：${user.email}` : '账号设置'}
              >
                {user?.displayName || user?.email}
              </Link>
              <IconButton label="退出登录" onClick={() => void logout()}>
                <Icon name="logout" size={16} />
              </IconButton>
            </div>
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
