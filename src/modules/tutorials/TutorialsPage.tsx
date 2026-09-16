import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, EmptyState, PageHeader } from '@/components/Page'
import type { Tutorial, TutorialMeta } from '@/modules/tutorials/types'
import { listTutorials, saveTutorial } from '@/core/storage/indexedDb'

function toMeta(t: Tutorial): TutorialMeta {
  const { steps: _steps, ...meta } = t
  return meta
}

async function ensureBuiltinTutorial(): Promise<Tutorial | null> {
  const existing = await listTutorials()
  if (existing.some((t) => t.id === 'uring-redis')) return null

  const res = await fetch('/tutorials/uring-redis.json')
  if (!res.ok) throw new Error(`加载预置教程失败：HTTP ${res.status}`)
  const tutorial = (await res.json()) as Tutorial
  const now = Date.now()
  const seeded: Tutorial = {
    ...tutorial,
    createdAt: tutorial.createdAt || now,
    updatedAt: now,
    progress: { lastStep: 0, completedSteps: [] },
  }
  await saveTutorial(seeded)
  return seeded
}

export function TutorialsPage() {
  const [items, setItems] = useState<TutorialMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await ensureBuiltinTutorial()
      const all = await listTutorials()
      setItems(all.map(toMeta))
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载教程失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="page">
      <PageHeader
        title="教程"
        desc="分步阅读、代码 Diff、章节备注。已自动载入 uRedis 预置教程。"
        actions={
          <Button variant="ghost" onClick={() => void refresh()}>
            刷新
          </Button>
        }
      />

      {error ? (
        <EmptyState
          title="教程加载失败"
          text={error}
          actions={
            <Button variant="primary" onClick={() => void refresh()}>
              重试
            </Button>
          }
        />
      ) : loading ? (
        <div className="panel">
          <p className="panel__text">正在加载教程…</p>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="还没有教程"
          text="预置教程未能写入本地库。可检查 /tutorials/uring-redis.json 后刷新。"
          actions={
            <Button variant="primary" onClick={() => void refresh()}>
              重试导入
            </Button>
          }
        />
      ) : (
        <div className="card-grid">
          {items.map((t) => {
            const last = t.progress?.lastStep ?? 0
            const pct = t.stepCount > 0 ? Math.round(((last + 1) / t.stepCount) * 100) : 0
            return (
              <article key={t.id} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h2 className="panel__title" style={{ marginBottom: 0 }}>
                  {t.title}
                </h2>
                <p className="panel__text">{t.description}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {t.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        border: '1px solid var(--line)',
                        borderRadius: 999,
                        padding: '2px 8px',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="panel__text">
                  共 {t.stepCount} 步 · 上次进度 {last + 1}/{t.stepCount}（{pct}%）
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <Button variant="primary" onClick={() => navigate(`/tutorials/${t.id}`)}>
                    继续学习
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <p style={{ marginTop: 24, color: 'var(--text-muted)', fontSize: 13 }}>
        导入自定义 JSON 将在后续版本开放。也可先阅读{' '}
        <Link to={`/tutorials/uring-redis`}>uRedis</Link>。
      </p>
    </div>
  )
}
