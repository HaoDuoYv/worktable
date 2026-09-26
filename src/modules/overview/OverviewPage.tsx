import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Page'
import { NewsCard } from '@/modules/news/NewsCard'

function useGreeting() {
  const [greeting, setGreeting] = useState('你好')
  const [dateText, setDateText] = useState('')

  useEffect(() => {
    const now = new Date()
    const h = now.getHours()
    setGreeting(h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好')
    setDateText(
      now.toLocaleDateString('zh-CN', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    )
  }, [])

  return { greeting, dateText }
}

function ArrowLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="link-arrow">
      {children}
      <span className="link-arrow__icon" aria-hidden="true">
        →
      </span>
    </Link>
  )
}

export function OverviewPage() {
  const { greeting, dateText } = useGreeting()

  return (
    <div className="page overview-page">
      <section className="hero" aria-label="欢迎">
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__inner">
          <div className="hero__content">
            <span className="hero__eyebrow">{dateText || '个人工作台'}</span>
            <h1 className="hero__title">
              {greeting}，欢迎回到 Worktable
            </h1>
            <p className="hero__desc">
              学一步、跑一步、问一句。把这里变成你专属的学习与创作空间。
            </p>
          </div>
          <div className="hero__actions">
            <Link to="/tutorials">
              <Button variant="primary">开始学教程</Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost">配置环境</Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="overview-page__body">
        <section className="stat-row" aria-label="工作台状态">
          <div className="stat-tile">
            <div className="stat-tile__body">
              <span className="stat-tile__label">教程进度</span>
              <span className="stat-tile__value">0%</span>
            </div>
          </div>
          <div className="stat-tile stat-tile--signal">
            <div className="stat-tile__body">
              <span className="stat-tile__label">算法实验</span>
              <span className="stat-tile__value">0</span>
            </div>
          </div>
          <div className="stat-tile stat-tile--warn">
            <div className="stat-tile__body">
              <span className="stat-tile__label">AI 助手</span>
              <span className="stat-tile__value">就绪</span>
            </div>
          </div>
        </section>

        <NewsCard />

        <div className="card-grid" style={{ marginBottom: 20 }}>
          <section className="panel">
            <h2 className="panel__title">继续学习</h2>
            <p className="panel__text">导入或选择预置教程后可继续上次进度。</p>
            <p style={{ marginTop: 14 }}>
              <ArrowLink to="/tutorials">前往教程</ArrowLink>
            </p>
          </section>
          <section className="panel">
            <h2 className="panel__title">最近算法</h2>
            <p className="panel__text">新建算法后可运行并可视化。</p>
            <p style={{ marginTop: 14 }}>
              <ArrowLink to="/algorithms">前往算法</ArrowLink>
            </p>
          </section>
          <section className="panel">
            <h2 className="panel__title">AI 助手</h2>
            <p className="panel__text">在设置中配置接口后可用于解答与代码生成。</p>
            <p style={{ marginTop: 14 }}>
              <ArrowLink to="/ai">打开 AI</ArrowLink>
            </p>
          </section>
        </div>

        <section className="quick-start">
          <h2 className="quick-start__title">工作台已就绪</h2>
          <p className="quick-start__text">
            M1 骨架：外壳、路由、设计令牌与基础组件。下一步接入教程模块与算法可视化。
          </p>
          <div className="quick-start__actions">
            <Link to="/tutorials">
              <Button variant="primary">去学教程</Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost">打开设置</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
