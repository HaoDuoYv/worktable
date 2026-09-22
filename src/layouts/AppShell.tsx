import { NavLink, Outlet, useMatches, Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/modules/auth/AuthContext'
import { Icon, WorktableMark, type IconName } from '@/components/Icon'
import { IconButton } from '@/components/IconButton'
import { AiJobDock } from '@/modules/ai/AiJobDock'

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
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem('worktable.nav.collapsed') === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('worktable.nav.collapsed', navCollapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [navCollapsed])

  return (
    <div className={`app-shell${navCollapsed ? ' is-nav-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">
        跳到主内容
      </a>
      <nav className="app-shell__nav" aria-label="主导航">
        <div className="app-shell__brand">
          <span className="app-shell__brand-mark" aria-hidden="true">
            <WorktableMark size={30} />
          </span>
          {!navCollapsed ? <span className="app-shell__brand-text">Worktable</span> : null}
          <IconButton
            label={navCollapsed ? '展开侧栏' : '收起侧栏'}
            title={navCollapsed ? '展开侧栏' : '收起侧栏'}
            className="app-shell__nav-toggle"
            onClick={() => setNavCollapsed((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              {navCollapsed ? (
                <path d="M15 5v14" stroke="currentColor" strokeWidth="1.5" />
              ) : (
                <>
                  <path d="M9 5v14" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M13 10l2.5 2L13 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </>
              )}
            </svg>
          </IconButton>
        </div>
        {!navCollapsed ? <div className="app-shell__nav-label">工作区</div> : null}
        <ul className="app-shell__nav-list">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                title={item.label}
                className={({ isActive }) =>
                  `app-shell__nav-link${isActive ? ' is-active' : ''}`
                }
              >
                <span className="app-shell__nav-icon">
                  <Icon name={item.icon} size={20} />
                </span>
                {!navCollapsed ? item.label : null}
              </NavLink>
            </li>
          ))}
        </ul>
        {!navCollapsed ? (
          <div className="app-shell__nav-footer">
            <span className="app-shell__status-dot" aria-hidden="true" />
            版本 0.3.0
          </div>
        ) : null}
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
      <AiJobDock />
    </div>
  )
}
