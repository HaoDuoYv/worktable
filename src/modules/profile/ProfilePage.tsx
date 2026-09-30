import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/AuthContext'
import { Icon, type IconName } from '@/components/Icon'
import { Switch } from '@/components/Switch'
import { getThemePrefs, setGlassEnabled, subscribeThemePrefs } from '@/core/theme/themePrefs'

function ProfileRow({
  to,
  icon,
  title,
  desc,
}: {
  to: string
  icon: IconName
  title: string
  desc: string
}) {
  return (
    <Link to={to} className="profile-row">
      <span className="profile-row__icon">
        <Icon name={icon} size={20} />
      </span>
      <span className="profile-row__text">
        <span className="profile-row__title">{title}</span>
        <span className="profile-row__desc">{desc}</span>
      </span>
      <Icon name="chevron-down" size={16} className="profile-row__chevron" />
    </Link>
  )
}

export function ProfilePage() {
  const { user, isGuest, logout } = useAuth()
  const [glass, setGlass] = useState(() => getThemePrefs().glass)

  useEffect(() => subscribeThemePrefs(() => setGlass(getThemePrefs().glass)), [])

  const name = user?.displayName || user?.email || '游客'
  const initial = name.replace(/^@/, '').charAt(0).toUpperCase()

  return (
    <div className="page profile-page">
      <section className="panel profile-card">
        <div className="profile-card__avatar" aria-hidden="true">
          {initial}
        </div>
        <div className="profile-card__meta">
          <h2 className="profile-card__name">{name}</h2>
          <p className="profile-card__sub">
            {isGuest ? '未登录 · 数据仅保存在本机' : user?.email}
          </p>
        </div>
        <div className="profile-card__actions">
          {isGuest ? (
            <Link to="/login" className="btn btn--primary btn--sm">
              登录 / 注册
            </Link>
          ) : (
            <button className="btn btn--ghost btn--sm" onClick={() => void logout()}>
              退出登录
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title">外观</h2>
        <Switch checked={glass} onChange={setGlassEnabled} label="玻璃液态" />
        <ProfileRow
          to="/settings"
          icon="settings"
          title="更多外观与偏好"
          desc="主题色预设、自定义主题、界面密度、天气"
        />
      </section>

      <section className="panel">
        <h2 className="panel__title">数据与账号</h2>
        <ProfileRow to="/settings" icon="code" title="AI 接口与编译环境" desc="模型接入、C++ 编译器配置" />
        <ProfileRow to="/settings" icon="save" title="数据管理" desc="教程 / 算法进度与缓存" />
        <ProfileRow to="/news" icon="news" title="新闻数据源" desc="查看抓取源可用状态" />
      </section>

      <p className="profile-version">Worktable v0.3.0 · 本地优先个人工作台</p>
    </div>
  )
}
