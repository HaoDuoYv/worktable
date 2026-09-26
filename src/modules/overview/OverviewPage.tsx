import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAlgorithms, listTutorials } from '@/core/storage/indexedDb'
import type { Tutorial } from '@/modules/tutorials/types'
import type { Algorithm } from '@/modules/algorithms/types'
import { isAiConfigured } from '@/modules/ai/aiClient'
import { getNewsState, subscribeNews, ensureNews } from '@/modules/news/newsService'
import {
  ensureWeather,
  getWeatherState,
  subscribeWeather,
  type WeatherNow,
} from '@/modules/weather/weatherService'
import { Button } from '@/components/Page'

/* —— 问候 —— */

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

/* —— 真实数据 —— */

function useWorkbenchData() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([])
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([])
  const [aiReady, setAiReady] = useState(false)

  useEffect(() => {
    let alive = true
    void Promise.all([listTutorials(), listAlgorithms()])
      .then(([ts, as]) => {
        if (!alive) return
        setTutorials(ts)
        setAlgorithms(as)
      })
      .catch(() => undefined)
    setAiReady(isAiConfigured())
    return () => {
      alive = false
    }
  }, [])

  return { tutorials, algorithms, aiReady }
}

/* —— 天气图标 —— */

function WeatherGlyph({ icon, size = 20 }: { icon: WeatherNow['icon']; size?: number }) {
  const stroke = 'currentColor'
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true as const,
  }
  switch (icon) {
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4.5" fill={stroke} />
          <path
            d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'cloud':
      return (
        <svg {...common}>
          <path
            d="M7 18a4.5 4.5 0 1 1 .9-8.9A5.5 5.5 0 0 1 18.5 11 3.5 3.5 0 0 1 17.5 18H7Z"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'fog':
      return (
        <svg {...common}>
          <path
            d="M4 10h16M6 14h12M4 18h16"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'rain':
      return (
        <svg {...common}>
          <path
            d="M7 14a4.5 4.5 0 1 1 .9-8.9A5.5 5.5 0 0 1 18.5 7 3.5 3.5 0 0 1 17.5 14H7Z"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M8 17l-1 3M13 17l-1 3M18 17l-1 3" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'snow':
      return (
        <svg {...common}>
          <path
            d="M12 3v18M5 6.5l14 11M19 6.5l-14 11"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'thunder':
      return (
        <svg {...common}>
          <path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
  }
}

/* —— 天气卡 —— */

function fmtWeatherTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function WeatherCard() {
  const [state, setState] = useState(getWeatherState())
  useEffect(() => subscribeWeather(() => setState(getWeatherState())), [])
  useEffect(() => {
    void ensureWeather().catch(() => undefined)
  }, [])

  const w = state.data

  return (
    <section className="panel ov-card" aria-label="当日天气">
      <header className="ov-card__head">
        <h2 className="ov-card__title">当日天气</h2>
        {w ? <span className="ov-chip">{w.city}</span> : null}
      </header>
      {state.status === 'loading' || state.status === 'idle' ? (
        <p className="ov-muted">获取天气中…</p>
      ) : state.status === 'error' || !w ? (
        <p className="ov-muted">
          天气获取失败{state.error ? `：${state.error}` : ''}。可在设置中调整城市。
        </p>
      ) : (
        <>
          <div className="ov-weather__main">
            <span className="ov-weather__icon">
              <WeatherGlyph icon={w.icon} size={44} />
            </span>
            <div>
              <div className="ov-weather__temp">{w.tempC}°C</div>
              <div className="ov-muted">
                {w.text} · 体感 {w.feelsLikeC}°C · 更新于 {fmtWeatherTime(w.updatedAt)}
              </div>
            </div>
          </div>
          <div className="ov-weather__meta">
            <div className="ov-weather__cell">
              <span className="ov-weather__k">湿度</span>
              <span className="ov-weather__v">{w.humidity}%</span>
            </div>
            <div className="ov-weather__cell">
              <span className="ov-weather__k">风</span>
              <span className="ov-weather__v">{w.windText}</span>
            </div>
            <div className="ov-weather__cell">
              <span className="ov-weather__k">空气质量</span>
              <span className="ov-weather__v is-signal">
                {w.aqiText ? `${w.aqiText}${w.aqi != null ? ` · AQI ${w.aqi}` : ''}` : '—'}
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

/* —— 今日头条卡 —— */

function ToutiaoCard() {
  const [state, setState] = useState(getNewsState())
  useEffect(() => subscribeNews(() => setState(getNewsState())), [])

  const items = (state.digest?.items ?? []).filter((it) => it.category === 'toutiao').slice(0, 5)

  return (
    <section className="panel ov-card" aria-label="今日头条">
      <header className="ov-card__head">
        <h2 className="ov-card__title">
          <span className="ov-flame" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2c1 4-3 5.5-3 9a5 5 0 0 0 10 0c0-2-1-3.5-2-4.5.2 2-1 3-2 3 .5-2.5-1-6-3-7.5Z"
                fill="currentColor"
              />
            </svg>
          </span>
          今日头条
        </h2>
        <Link to="/news" className="ov-link">
          查看全部
        </Link>
      </header>
      {items.length === 0 ? (
        <p className="ov-muted">热榜尚未生成，打开新闻页可手动刷新。</p>
      ) : (
        <ol className="ov-hotlist">
          {items.map((it, idx) => (
            <li key={it.id} className="ov-hotlist__row">
              <span className={`ov-hotlist__rank${idx < 3 ? ' is-top' : ''}`}>{idx + 1}</span>
              <a
                className="ov-hotlist__title"
                href={it.url ?? undefined}
                target={it.url ? '_blank' : undefined}
                rel={it.url ? 'noopener noreferrer' : undefined}
                onClick={(e) => {
                  if (!it.url) e.preventDefault()
                }}
              >
                {it.title}
              </a>
              {it.heat ? <span className="ov-hotlist__heat">{it.heat}</span> : null}
            </li>
          ))}
        </ol>
      )}
      <p className="ov-footnote">数据来源：今日头条热榜 · 每 30 分钟更新</p>
    </section>
  )
}

/* —— AI 新闻速览卡 —— */

function AiNewsCard() {
  const [state, setState] = useState(getNewsState())
  useEffect(() => subscribeNews(() => setState(getNewsState())), [])

  const items = (state.digest?.items ?? []).filter((it) => it.category === 'ai').slice(0, 3)

  return (
    <section className="panel ov-card" aria-label="AI 新闻速览">
      <header className="ov-card__head">
        <h2 className="ov-card__title">AI 新闻速览</h2>
        <Link to="/news" className="ov-link">
          查看全部
        </Link>
      </header>
      {items.length === 0 ? (
        <p className="ov-muted">
          {state.loading || state.digest?.status === 'generating'
            ? '正在生成今日新闻…'
            : '今日新闻尚未生成。'}
        </p>
      ) : (
        <ul className="ov-digest">
          {items.map((it) => (
            <li key={it.id} className="ov-digest__row">
              <span className="ov-digest__dot" aria-hidden="true" />
              <a
                className="ov-digest__title"
                href={it.url ?? undefined}
                target={it.url ? '_blank' : undefined}
                rel={it.url ? 'noopener noreferrer' : undefined}
                onClick={(e) => {
                  if (!it.url) e.preventDefault()
                }}
              >
                {it.title}
              </a>
              <span className="ov-digest__src">{it.source}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* —— 主页面 —— */

const LANG_LABEL: Record<string, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  cpp: 'C++',
}

export function OverviewPage() {
  const { greeting, dateText } = useGreeting()
  const { tutorials, algorithms, aiReady } = useWorkbenchData()

  useEffect(() => {
    void ensureNews()
  }, [])

  /* 教程进度：所有教程完成步骤占比 */
  const tutorialProgress = useMemo(() => {
    let done = 0
    let total = 0
    for (const t of tutorials) {
      total += t.steps?.length ?? 0
      done += t.progress?.completedSteps?.length ?? 0
    }
    if (total === 0) return undefined
    return Math.round((done / total) * 100)
  }, [tutorials])

  /* 继续学习：最近更新且有进度的教程 */
  const activeTutorial = useMemo(
    () =>
      tutorials.find((t) => (t.progress?.lastStep ?? 0) > 0) ??
      tutorials[0],
    [tutorials],
  )

  const recentAlgorithms = algorithms.slice(0, 3)

  return (
    <div className="page overview-page">
      <header className="ov-head">
        <div className="ov-head__text">
          <span className="ov-head__eyebrow">{dateText || '个人工作台'}</span>
          <h1 className="ov-head__title">{greeting}，欢迎回到 Worktable</h1>
        </div>
        <div className="ov-head__actions">
          <Link to="/tutorials">
            <Button variant="primary">开始学教程</Button>
          </Link>
          <Link to="/settings">
            <Button variant="ghost">配置环境</Button>
          </Link>
        </div>
      </header>

      <section className="stat-row" aria-label="工作台状态">
        <div className="stat-tile">
          <div className="stat-tile__body">
            <span className="stat-tile__label">教程进度</span>
            <span className="stat-tile__value">
              {tutorialProgress != null ? `${tutorialProgress}%` : '—'}
            </span>
          </div>
          {tutorialProgress != null ? (
            <div className="stat-tile__bar" aria-hidden="true">
              <div className="stat-tile__bar-fill" style={{ width: `${tutorialProgress}%` }} />
            </div>
          ) : null}
        </div>
        <div className="stat-tile">
          <div className="stat-tile__body">
            <span className="stat-tile__label">算法实验</span>
            <span className="stat-tile__value">{algorithms.length} 个</span>
          </div>
          <span className="stat-tile__sub">本地算法库</span>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__body">
            <span className="stat-tile__label">AI 助手</span>
            <span className={`stat-tile__value ${aiReady ? 'is-signal' : 'is-warn'}`}>
              {aiReady ? '就绪' : '未配置'}
            </span>
          </div>
          <span className="stat-tile__sub">{aiReady ? '接口已配置' : '去设置里填写密钥'}</span>
        </div>
        <WeatherTile />
      </section>

      <div className="ov-grid">
        <div className="ov-col">
          <section className="panel ov-card" aria-label="继续学习">
            <header className="ov-card__head">
              <h2 className="ov-card__title">继续学习</h2>
              {activeTutorial ? (
                <Link to={`/tutorials/${activeTutorial.id}`}>
                  <Button variant="primary">继续学习</Button>
                </Link>
              ) : null}
            </header>
            {activeTutorial ? (
              <>
                <div className="ov-learn__row">
                  <span className="ov-learn__icon" aria-hidden="true">
                    <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
                      <rect width="32" height="32" rx="8" fill="var(--panel-2)" />
                      <path
                        d="M16 9.5c-1.7-1.3-4.2-1.3-6.5 0v11c2.3-1.3 4.8-1.3 6.5 0 1.7-1.3 4.2-1.3 6.5 0v-11c-2.3-1.3-4.8-1.3-6.5 0Z"
                        stroke="var(--signal)"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div className="ov-learn__info">
                    <span className="ov-learn__name">{activeTutorial.title}</span>
                    <span className="ov-muted">
                      第 {(activeTutorial.progress?.lastStep ?? 0) + 1} /{' '}
                      {activeTutorial.steps?.length ?? 0} 步
                      {activeTutorial.steps?.[activeTutorial.progress?.lastStep ?? 0]?.title
                        ? ` · 学到「${activeTutorial.steps[activeTutorial.progress?.lastStep ?? 0].title}」`
                        : ''}
                    </span>
                  </div>
                </div>
                <div className="ov-progress" aria-hidden="true">
                  <div
                    className="ov-progress__fill"
                    style={{
                      width: `${
                        activeTutorial.steps?.length
                          ? Math.round(
                              ((activeTutorial.progress?.completedSteps?.length ?? 0) /
                                activeTutorial.steps.length) *
                                100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="ov-muted">
                还没有教程。去<Link to="/tutorials">教程库</Link>导入或选择预置教程开始学习。
              </p>
            )}
          </section>

          <section className="panel ov-card" aria-label="最近算法">
            <header className="ov-card__head">
              <h2 className="ov-card__title">最近算法</h2>
              <Link to="/algorithms" className="ov-link">
                查看全部
              </Link>
            </header>
            {recentAlgorithms.length === 0 ? (
              <p className="ov-muted">
                还没有算法。去<Link to="/algorithms">算法实验室</Link>新建一个并运行可视化。
              </p>
            ) : (
              <ul className="ov-alist">
                {recentAlgorithms.map((a) => (
                  <li key={a.id}>
                    <Link to="/algorithms" className="ov-alist__row">
                      <span className="ov-alist__name">{a.title}</span>
                      <span className="ov-alist__meta">
                        <span className={`ov-lang ov-lang--${a.language}`}>
                          {LANG_LABEL[a.language] ?? a.language}
                        </span>
                        <span className="ov-muted">
                          {new Date(a.updatedAt).toLocaleDateString('zh-CN')} 更新
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <AiNewsCard />
        </div>

        <div className="ov-rail">
          <WeatherCard />
          <ToutiaoCard />
        </div>
      </div>
    </div>
  )
}

/* 统计条里的天气块（迷你版） */
function WeatherTile() {
  const [state, setState] = useState(getWeatherState())
  useEffect(() => subscribeWeather(() => setState(getWeatherState())), [])
  useEffect(() => {
    void ensureWeather().catch(() => undefined)
  }, [])

  const w = state.data
  return (
    <div className="stat-tile">
      <div className="stat-tile__body">
        <span className="stat-tile__label">
          今日天气
          {w ? (
            <span className="stat-tile__icon">
              <WeatherGlyph icon={w.icon} size={16} />
            </span>
          ) : null}
        </span>
        <span className="stat-tile__value">
          {state.status === 'loading' ? '…' : w ? `${w.tempC}°C` : '—'}
        </span>
      </div>
      <span className="stat-tile__sub">
        {w ? `${w.city} · ${w.text}${w.aqiText ? ` · ${w.aqiText}` : ''}` : '获取中'}
      </span>
    </div>
  )
}
