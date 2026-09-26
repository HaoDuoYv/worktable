import { useEffect, useMemo, useState } from 'react'
import { getNewsState, subscribeNews, ensureNews, refreshNews } from './newsService'
import { NEWS_SOURCES } from './sources'
import { CATEGORY_META, type NewsCategory, type NewsDigest } from './types'

function fmtTime(ts?: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ digest, loading }: { digest?: NewsDigest; loading: boolean }) {
  if (loading || digest?.status === 'generating') {
    return <span className="news-status is-busy">生成中…</span>
  }
  if (digest?.status === 'error') {
    return <span className="news-status is-error">生成失败</span>
  }
  if (digest?.status === 'done') {
    if (digest.partial) return <span className="news-status is-warn">部分源不可用</span>
    return <span className="news-status is-done">已更新 {fmtTime(digest.generatedAt)}</span>
  }
  return <span className="news-status">未生成</span>
}

const TABS: NewsCategory[] = ['ai', 'hot', 'toutiao']

/** 右栏：数据源状态 + 今日概览 */
function NewsRail({ digest }: { digest?: NewsDigest }) {
  const failed = new Set(digest?.failedSources ?? [])
  const withSummary = (digest?.items ?? []).filter((it) => it.summary).length

  return (
    <aside className="news-rail">
      <section className="panel news-rail__card">
        <h2 className="panel__title">数据源状态</h2>
        <ul className="news-rail__sources">
          {NEWS_SOURCES.map((s) => {
            const bad = digest != null && failed.has(s.name)
            return (
              <li key={s.id} className="news-rail__source">
                <span className="news-rail__source-name">{s.name}</span>
                <span className={`news-rail__source-status ${bad ? 'is-warn' : 'is-ok'}`}>
                  {digest == null ? '待生成' : bad ? '不可用 · 已跳过' : '正常'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="panel news-rail__card">
        <h2 className="panel__title">今日概览</h2>
        <ul className="news-rail__stats">
          <li className="news-rail__stat">
            <span className="news-rail__stat-k">今日抓取</span>
            <span className="news-rail__stat-v">{digest?.items.length ?? 0} 条</span>
          </li>
          <li className="news-rail__stat">
            <span className="news-rail__stat-k">AI 摘要</span>
            <span className="news-rail__stat-v">
              {withSummary > 0 ? `已生成 ${withSummary} 条` : '未生成'}
            </span>
          </li>
          <li className="news-rail__stat">
            <span className="news-rail__stat-k">本地缓存</span>
            <span className="news-rail__stat-v">保留 7 天</span>
          </li>
        </ul>
      </section>
    </aside>
  )
}

export function NewsPage() {
  const [state, setState] = useState(getNewsState())
  const [tab, setTab] = useState<NewsCategory>('ai')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => subscribeNews(() => setState(getNewsState())), [])
  useEffect(() => {
    void ensureNews()
  }, [])

  const { digest, loading } = state

  const counts = useMemo(() => {
    const map = { ai: 0, hot: 0, toutiao: 0 } as Record<NewsCategory, number>
    for (const it of digest?.items ?? []) map[it.category] += 1
    return map
  }, [digest])

  const items = useMemo(
    () => (digest?.items ?? []).filter((it) => it.category === tab),
    [digest, tab],
  )

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    void refreshNews().finally(() => setRefreshing(false))
  }

  const generating = loading || digest?.status === 'generating'

  return (
    <div className="page news-page">
      <header className="news-page__head">
        <div>
          <h1 className="page__title">每日新闻</h1>
          <p className="news-page__date">
            {state.date} · <StatusBadge digest={digest} loading={loading} />
          </p>
        </div>
        <button className="btn btn--ghost" onClick={onRefresh} disabled={generating || refreshing}>
          {generating || refreshing ? '生成中…' : '刷新'}
        </button>
      </header>

      {digest?.status === 'error' ? (
        <div className="empty-state">
          <h2 className="empty-state__title">暂时没有新闻</h2>
          <p className="empty-state__text">{digest.error}</p>
          <div className="empty-state__actions">
            <button className="btn btn--primary" onClick={onRefresh}>
              重试
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="chip-row news-tabs" role="tablist" aria-label="新闻分类">
            {TABS.map((cat) => (
              <button
                key={cat}
                role="tab"
                aria-selected={tab === cat}
                className={`chip${tab === cat ? ' chip--selected' : ''}`}
                onClick={() => setTab(cat)}
              >
                {CATEGORY_META[cat].label} · {counts[cat]} 条
              </button>
            ))}
          </div>

          <div className="news-page__body">
            <div className="news-page__main">
              {generating ? (
                <div className="news-skeleton" aria-label="生成中">
                  {[0, 1, 2, 3].map((i) => (
                    <div className="news-skeleton__row" key={i} />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="empty-state">
                  <h2 className="empty-state__title">暂无内容</h2>
                  <p className="empty-state__text">该分类没有抓到可用新闻。</p>
                </div>
              ) : (
                <ul className="news-list">
                  {items.map((it, idx) => {
                    const open = expanded.has(it.id)
                    return (
                      <li className="news-item" key={it.id}>
                        <div className="news-item__row">
                          {tab === 'toutiao' ? (
                            <span
                              className={`news-item__rank${idx < 3 ? ' is-top' : ''}`}
                              aria-hidden="true"
                            >
                              {idx + 1}
                            </span>
                          ) : null}
                          <div className="news-item__body">
                            <a
                              className="news-item__title"
                              href={it.url ?? undefined}
                              target={it.url ? '_blank' : undefined}
                              rel={it.url ? 'noopener noreferrer' : undefined}
                              onClick={(e) => {
                                if (!it.url) e.preventDefault()
                              }}
                            >
                              {it.title}
                            </a>
                            {open && it.summary ? (
                              <p className="news-item__summary">{it.summary}</p>
                            ) : null}
                            <span className="news-item__source">{it.source}</span>
                          </div>
                          <div className="news-item__aside">
                            {it.heat ? <span className="news-item__heat">{it.heat}</span> : null}
                            {it.summary ? (
                              <button
                                className="news-item__toggle"
                                onClick={() => toggle(it.id)}
                                aria-expanded={open}
                                aria-label={open ? '收起摘要' : '展开摘要'}
                              >
                                <span
                                  className={`news-item__chevron${open ? ' is-open' : ''}`}
                                  aria-hidden="true"
                                >
                                  ▾
                                </span>
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <NewsRail digest={digest} />
          </div>

          {digest?.partial && digest.failedSources?.length ? (
            <p className="news-page__hint">
              以下源本次不可用：{digest.failedSources.join('、')}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
