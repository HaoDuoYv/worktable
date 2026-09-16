import { Outlet, Link } from 'react-router-dom'
import { ThemeToggle } from '@/components/ThemeToggle'
import { WorktableMark } from '@/components/Icon'

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <a className="skip-link" href="#auth-main">
        跳到表单
      </a>

      <header className="auth-layout__header" aria-label="品牌">
        <Link to="/" className="auth-layout__brand">
          <span className="auth-layout__brand-mark" aria-hidden="true">
            <WorktableMark size={26} />
          </span>
          <span className="auth-layout__brand-text">Worktable</span>
        </Link>
        <ThemeToggle />
      </header>

      <main id="auth-main" className="auth-layout__main">
        <div className="auth-layout__card">
          <Outlet />
        </div>
      </main>

      <footer className="auth-layout__footer">数据默认保存在本机浏览器</footer>
    </div>
  )
}
