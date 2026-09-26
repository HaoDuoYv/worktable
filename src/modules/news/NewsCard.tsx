import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNewsState, subscribeNews, ensureNews } from './newsService'
import { CATEGORY_META, type NewsCategory } from './types'

/** 首页概览的「今日新闻」卡片 */
export function NewsCard() {
  const [state, setState] = useState(getNewsState())

  useEffect(() => subscribeNews(() => setState(getNewsState())), [])
  useEffect(() => {
    void ensureNews()
  }, [])

  const { digest, loading } = state

  return (
    <section className="news-card panel" aria-label="今日新闻">
      <header className="news-card__head">
        <div>
          <h2 className="news-card__title">今日新闻</h2>
          <span className="news-card__date">{state.date}</span>
        </div>
        <Link to="/news" className="link-arrow">
          查看全部
          <span className="link-arrow__icon" aria-hidden="true">
            →
          </span>
        </Link>
      </header>

      {loading || digest?.status === 'generating' ? (
        <p className="news-card__status">正在生成今日新闻…</p>
      ) : digest?.status === 'error' ? (
        <p className="news-card__status is-error">{digest.error ?? '生成失败'}</p>
      ) : (
        <div className="news-card__cols">
          {(['ai', 'hot'] as NewsCategory[]).map((cat) => (
            <div className="news-card__col" key={cat}>
              <span className="news-card__col-title">{CATEGORY_META[cat].label}</span>
              <ul className="news-card__list">
                {(digest?.items ?? [])
                  .filter((it) => it.category === cat)
                  .slice(0, 3)
                  .map((it) => (
                    <li key={it.id}>
                      <a
                        href={it.url ?? undefined}
                        target={it.url ? '_blank' : undefined}
                        rel={it.url ? 'noopener noreferrer' : undefined}
                        className="news-card__item"
                      >
                        {it.title}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
