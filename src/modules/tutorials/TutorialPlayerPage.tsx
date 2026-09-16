import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Disclosure } from '@/components/Disclosure'
import { Stepper } from '@/components/Stepper'
import { EmptyState } from '@/components/Page'
import { ThreePaneLayout } from '@/components/Resizable'
import { InlineAiPanel } from '@/modules/ai/InlineAiPanel'
import {
  buildTutorialSystemPrompt,
  formatTutorialContext,
} from '@/modules/ai/aiClient'
import type { DiffLine, Tutorial } from '@/modules/tutorials/types'
import { noteId } from '@/modules/tutorials/types'
import {
  getNote,
  getTutorial,
  saveNote,
  saveTutorial,
  updateTutorialProgress,
} from '@/core/storage/indexedDb'

function diffClass(t: DiffLine['t']): string {
  if (t === 'a') return 'diff-line--add'
  if (t === 'r') return 'diff-line--del'
  return ''
}

function diffPrefix(t: DiffLine['t']): string {
  if (t === 'a') return '+'
  if (t === 'r') return '-'
  return ' '
}

export function TutorialPlayerPage() {
  const { id } = useParams<{ id: string }>()
  const [aiOpen, setAiOpen] = useState(false)
  const [tutorial, setTutorial] = useState<Tutorial | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [viewingFile, setViewingFile] = useState<string | null>(null)
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [noteSavedAt, setNoteSavedAt] = useState<number | null>(null)
  const noteTimer = useRef<number | null>(null)

  // load tutorial
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        let t = await getTutorial(id)
        if (!t && id === 'uring-redis') {
          const res = await fetch('/tutorials/uring-redis.json')
          if (res.ok) {
            t = (await res.json()) as Tutorial
            t = {
              ...t,
              updatedAt: Date.now(),
              progress: t.progress ?? { lastStep: 0, completedSteps: [] },
            }
            await saveTutorial(t)
          }
        }
        if (!t) throw new Error('未找到该教程')
        if (cancelled) return
        setTutorial(t)
        setStepIndex(Math.min(t.progress?.lastStep ?? 0, t.steps.length - 1))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  // load note when step changes
  useEffect(() => {
    let cancelled = false
    async function loadNote() {
      if (!id) return
      const n = await getNote(noteId(id, stepIndex))
      if (cancelled) return
      setNote(n?.content ?? '')
      setNoteSavedAt(n?.updatedAt ?? null)
    }
    void loadNote()
    return () => {
      cancelled = true
    }
  }, [id, stepIndex])

  // persist progress
  useEffect(() => {
    if (!id || !tutorial) return
    void updateTutorialProgress(id, stepIndex)
  }, [id, tutorial, stepIndex])

  const step = tutorial?.steps[stepIndex]

  const allFiles = useMemo(() => {
    if (!tutorial) return {} as Record<string, string>
    const files: Record<string, string> = {}
    for (let i = 0; i <= stepIndex; i++) {
      Object.assign(files, tutorial.steps[i].files)
    }
    return files
  }, [tutorial, stepIndex])

  const allFilenames = useMemo(() => Object.keys(allFiles), [allFiles])

  const onNoteChange = useCallback(
    (value: string) => {
      setNote(value)
      if (noteTimer.current) window.clearTimeout(noteTimer.current)
      noteTimer.current = window.setTimeout(() => {
        void saveNote({
          id: noteId(id!, stepIndex),
          tutorialId: id!,
          stepIndex,
          content: value,
          updatedAt: Date.now(),
        }).then(() => setNoteSavedAt(Date.now()))
      }, 500)
    },
    [id, stepIndex],
  )

  useEffect(() => {
    return () => {
      if (noteTimer.current) window.clearTimeout(noteTimer.current)
    }
  }, [])

  const goTo = (index: number) => {
    if (!tutorial) return
    if (index < 0 || index >= tutorial.steps.length) return
    setStepIndex(index)
    setViewingFile(null)
  }

  if (loading) {
    return (
      <div className="page">
        <div className="panel">
          <p className="panel__text">正在加载教程…</p>
        </div>
      </div>
    )
  }

  if (error || !tutorial || !step) {
    return (
      <div className="page">
        <EmptyState
          title="无法打开教程"
          text={error ?? '教程不存在'}
          actions={
            <Link to="/tutorials">
              <Button variant="primary">返回教程库</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const fileLines = viewingFile ? (allFiles[viewingFile] ?? '').split('\n') : []

  return (
    <div className="tutorial-player">
      <ThreePaneLayout
        leftKey="worktable.tutorial.leftW"
        rightKey="worktable.tutorial.rightW"
        leftDefault={260}
        rightDefault={360}
        leftMin={200}
        leftMax={480}
        rightMin={260}
        rightMax={640}
        left={
          <aside className="tutorial-player__sidebar">
            <div className="tutorial-player__sidebar-head">
              <Link to="/tutorials" className="tutorial-player__back">
                ← 教程库
              </Link>
              <h2 className="tutorial-player__title">{tutorial.title}</h2>
            </div>
            <ol className="tutorial-player__steps">
              {tutorial.steps.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className={`step-item${i === stepIndex ? ' is-current' : ''}${
                      i < stepIndex ? ' is-done' : ''
                    }`}
                    onClick={() => goTo(i)}
                  >
                    <span className="step-item__n">{String(i + 1).padStart(2, '0')}</span>
                    <span className="step-item__t">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        }
        center={
          <section className="tutorial-player__content">
            <div className="tutorial-player__content-inner">
              <div className="file-bar">
                <span className="file-bar__label">修改的文件</span>
                {step.changed.length === 0 ? (
                  <span className="file-tag muted">无变化</span>
                ) : (
                  step.changed.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className="file-tag"
                      onClick={() => {
                        setViewingFile(f)
                        setSelectedDiffFile(f)
                      }}
                    >
                      {f}
                    </button>
                  ))
                )}
                <Button
                  size="sm"
                  variant="primary"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => setAiOpen(true)}
                >
                  问 AI
                </Button>
              </div>

              {viewingFile ? (
                <div className="file-view">
                  <div className="file-view__head">
                    <span>文件 · {viewingFile}</span>
                    <Button size="sm" variant="ghost" onClick={() => setViewingFile(null)}>
                      关闭
                    </Button>
                  </div>
                  <pre className="file-view__code">
                    {fileLines.map((line, i) => (
                      <div key={i} className="file-view__line">
                        <span className="file-view__ln">{i + 1}</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </pre>
                </div>
              ) : (
                <article
                  className="tutorial-html"
                  // Content is authored in the bundled tutorial JSON (trusted import source).
                  dangerouslySetInnerHTML={{ __html: step.message }}
                />
              )}

              <div className="notes-block">
                <Disclosure label="本步备注" defaultOpen={Boolean(note)}>
                  <textarea
                    className="notes-input"
                    value={note}
                    rows={5}
                    placeholder="记下关键点、疑问或和 AI 讨论的线索…"
                    onChange={(e) => onNoteChange(e.target.value)}
                  />
                  <div className="notes-meta">
                    {noteSavedAt
                      ? `已保存 ${new Date(noteSavedAt).toLocaleTimeString()}`
                      : '输入后自动保存到本地'}
                  </div>
                </Disclosure>
              </div>
            </div>
          </section>
        }
        right={
          <aside className="tutorial-player__diff">
            <div className="diff-head">Diff · 步骤 {stepIndex + 1}</div>
            <div className="diff-body">
              {Object.keys(step.diffs).length === 0 ? (
                <p className="diff-empty">本步无 Diff</p>
              ) : (
                Object.entries(step.diffs).map(([fname, lines]) => (
                  <details
                    key={fname}
                    className={`diff-file${selectedDiffFile === fname ? ' is-focus' : ''}`}
                    open
                  >
                    <summary>{fname}</summary>
                    <div className="diff-lines">
                      {lines.map((line, i) => (
                        <div key={i} className={`diff-line ${diffClass(line.t)}`}>
                          <span className="diff-line__ln">{i + 1}</span>
                          <span className="diff-line__c">
                            {diffPrefix(line.t)}
                            {line.c}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))
              )}

              <details className="diff-file">
                <summary>全部文件（{allFilenames.length}）</summary>
                <ul className="all-files">
                  {allFilenames.map((f) => (
                    <li key={f}>
                      <button type="button" onClick={() => setViewingFile(f)}>
                        {f}
                        {step.changed.includes(f) ? ' ·已修改' : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </aside>
        }
      />

      <footer className="tutorial-player__footer">
        <Stepper
          total={tutorial.steps.length}
          current={stepIndex}
          onChange={goTo}
          label="教程步骤"
        />
      </footer>

      <InlineAiPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title={`${tutorial.title} · 步骤 ${stepIndex + 1}`}
        systemPrompt={[
          buildTutorialSystemPrompt(),
          formatTutorialContext({
            tutorialTitle: tutorial.title,
            stepTitle: step.title,
            stepMessage: step.message,
            note,
            changed: step.changed,
          }),
        ].join('\n\n')}
      />
    </div>
  )
}
