import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChipRow, type ChipOption } from '@/components/Chip'
import { CodeEditor } from '@/components/CodeEditor'
import { PlayerBar, type Speed } from '@/components/PlayerBar'
import { Button } from '@/components/Button'
import { Disclosure } from '@/components/Disclosure'
import { AvEngine } from '@/core/av/engine'
import { TracerPanel } from '@/core/av/renderers'
import type { AvCommand } from '@/core/av/types'
import { runJsAlgorithm } from '@/core/runners/js'
import { runPythonAlgorithm } from '@/core/runners/python'
import { detectCppServer, runCppAlgorithm, isElectronRuntime } from '@/core/runners/cpp'
import type { AlgoLanguage, Algorithm } from './types'
import { createAlgorithmId, primaryCode, sourceCodeOf } from './types'
import { seedBuiltinAlgorithms } from './seed'
import { makeCppBubbleSort, makePythonBubbleSort } from './samples'
import {
  deleteAlgorithm,
  listAlgorithms,
  saveAlgorithm,
  bulkPutAlgorithms,
} from '@/core/storage/indexedDb'
import { InlineAiPanel } from '@/modules/ai/InlineAiPanel'
import { extractCodeBlock, validateVizCode, formatValidateError } from './vizValidate'
import {
  buildAlgoSystemPrompt,
  chatComplete,
  formatAlgorithmContext,
  isAiConfigured,
  loadAiSettings,
} from '@/modules/ai/aiClient'

type FilterMode = 'all' | 'favorite' | 'mine'

const LANG_OPTIONS: ChipOption<AlgoLanguage>[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
]

const FILTER_OPTIONS: ChipOption<FilterMode>[] = [
  { value: 'all', label: '全部' },
  { value: 'favorite', label: '收藏' },
  { value: 'mine', label: '我的' },
]

const BASE_INTERVAL = 450

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function AlgorithmsLabPage() {
  const [lang, setLang] = useState<AlgoLanguage>('javascript')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [category, setCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Algorithm[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [exitingId, setExitingId] = useState<string | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set())
  const [editorMode, setEditorMode] = useState<'source' | 'viz'>('viz')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiAutoAsk, setAiAutoAsk] = useState<string | undefined>(undefined)
  const [converting, setConverting] = useState(false)

  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const [cursor, setCursor] = useState(0)
  const [activeLine, setActiveLine] = useState<number | null>(null)
  const [tracers, setTracers] = useState<ReturnType<AvEngine['getAll']>>([])

  const engineRef = useRef(new AvEngine())
  const timerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const total = engineRef.current.getChunkCount()

  const selected = useMemo(
    () => items.find((a) => a.id === selectedId) ?? null,
    [items, selectedId],
  )

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }, [])

  const stopPlay = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setPlaying(false)
  }, [])

  const applyCursor = useCallback((next: number) => {
    const engine = engineRef.current
    engine.replayTo(next)
    setCursor(engine.getCursor())
    const line = engine.getCurrentLine()
    setActiveLine(line === undefined ? null : line + 1)
    setTracers(engine.getAll())
  }, [])

  const refresh = useCallback(async () => {
    const all = await seedBuiltinAlgorithms()
    // seed multi-lang samples once
    if (!all.some((a) => a.language === 'python')) {
      await saveAlgorithm(makePythonBubbleSort())
    }
    if (!all.some((a) => a.language === 'cpp' && a.id === 'cpp-bubble-sort')) {
      await saveAlgorithm(makeCppBubbleSort())
    }
    const next = await listAlgorithms()
    setItems(next)
    setSelectedId((prev) => {
      if (prev && next.some((a) => a.id === prev)) return prev
      return next.find((a) => a.language === lang)?.id ?? next[0]?.id ?? null
    })
  }, [lang])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // When language chip changes, prefer an algorithm in that language
  useEffect(() => {
    const inLang = items.filter((a) => a.language === lang)
    if (inLang.length === 0) return
    if (selected && selected.language === lang) return
    setSelectedId(inLang[0].id)
  }, [lang, items, selected])

  // load editor when selection changes
  useEffect(() => {
    if (!selected) {
      setCode('')
      setTitle('')
      setDesc('')
      return
    }
    stopPlay()
    const mode = selected.editorMode ?? 'viz'
    setEditorMode(mode)
    setCode(mode === 'source' ? sourceCodeOf(selected) : primaryCode(selected))
    setTitle(selected.title)
    setDesc(selected.description ?? '')
    setDirty(false)
    setError(null)
    engineRef.current.setCommands([])
    setCursor(0)
    setActiveLine(null)
    setTracers([])
  }, [selected, stopPlay])

  const switchEditorMode = useCallback(
    (mode: 'source' | 'viz') => {
      if (!selected) {
        setEditorMode(mode)
        return
      }
      // persist current buffer into the active side before switching
      const patch: Partial<Algorithm> = { editorMode: mode }
      if (editorMode === 'source') patch.sourceCode = code
      else patch.vizCode = code
      void saveAlgorithm({ ...selected, ...patch, updatedAt: Date.now() }).then(async () => {
        const all = await listAlgorithms()
        setItems(all)
        const fresh = all.find((a) => a.id === selected.id)
        setEditorMode(mode)
        setCode(mode === 'source' ? sourceCodeOf(fresh ?? selected) : primaryCode(fresh ?? selected))
        setDirty(false)
      })
    },
    [code, editorMode, selected],
  )

  /** 静默：把源码转成可视化代码，不展示中间对话 */
  const silentVisualize = useCallback(async () => {
    if (!selected) return
    if (!isAiConfigured()) {
      setError('先在设置里填写 API 地址与密钥，再使用 AI 可视化。')
      return
    }
    const src =
      editorMode === 'source' ? code : (selected.sourceCode ?? code)
    if (!src.trim()) {
      setError('源码为空')
      return
    }
    setConverting(true)
    setError(null)
    try {
      const langName = selected.language
      const prompt = [
        buildAlgoSystemPrompt(),
        '',
        `用户源码如下，请转换为带 visualization tracers 的可执行完整代码。`,
        `语言：${langName}`,
        langName === 'javascript'
          ? '必须使用 require("algorithm-visualizer")，Array1DTracer/LogTracer，Tracer.delay()，Layout.setRoot。只输出一个 ```javascript 代码块，不要解释。'
          : langName === 'python'
            ? '直接使用注入的 Array1DTracer/LogTracer/Tracer/Layout，不要 import algorithm_visualizer。只输出一个 ```python 代码块。'
            : '使用 #include "av.h" 与 av:: 命名空间。只输出一个 ```cpp 代码块。',
        '',
        '【源码】',
        langName === 'python' ? '```python' : langName === 'cpp' ? '```cpp' : '```javascript',
        src,
        '```',
      ].join('\n')

      const reply = await chatComplete(loadAiSettings(), [
        { role: 'system', content: buildAlgoSystemPrompt() },
        { role: 'user', content: prompt },
      ])
      const viz = extractCodeBlock(reply, langName)
      if (!viz) {
        // 失败不覆盖
        setError('AI 未返回可用代码块，已保留原可视化代码。')
        return
      }

      // 静态校验 — docs/VIS_SPEC.md §7；失败不写入 vizCode
      const report = validateVizCode(viz, langName)
      if (!report.ok) {
        setError(formatValidateError(report))
        return
      }

      const now = Date.now()
      const next: Algorithm = {
        ...selected,
        sourceCode: src,
        vizCode: viz,
        editorMode: 'viz',
        files: [
          {
            name:
              selected.files[0]?.name ??
              `main.${langName === 'python' ? 'py' : langName === 'cpp' ? 'cpp' : 'js'}`,
            content: viz,
          },
        ],
        updatedAt: now,
      }
      await saveAlgorithm(next)
      const all = await listAlgorithms()
      setItems(all)
      setEditorMode('viz')
      setCode(viz)
      setDirty(false)
      const warn =
        report.warnings.length > 0 ? `（警告：${report.warnings.join('；')}）` : ''
      showToast(`已生成可视化代码并通过校验${warn}`)
    } catch (e) {
      setError(
        `AI 转换失败，已保留原可视化代码。\n${e instanceof Error ? e.message : String(e)}`,
      )
    } finally {
      setConverting(false)
    }
  }, [code, editorMode, selected, showToast])


  const categories = useMemo(() => {
    const set = new Set(items.map((a) => a.category))
    return ['all', ...[...set].sort()]
  }, [items])

  const visible = useMemo(() => {
    return items.filter((a) => {
      if (a.language !== lang) return false
      if (filter === 'favorite' && !a.favorite) return false
      if (filter === 'mine' && a.source !== 'user') return false
      if (category !== 'all' && a.category !== category) return false
      if (query.trim()) {
        const q = query.trim().toLowerCase()
        const hay = `${a.title} ${a.description ?? ''} ${a.tags.join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, lang, filter, category, query])

  const persistSelected = useCallback(
    async (patch: Partial<Algorithm>) => {
      if (!selected) return
      const next: Algorithm = {
        ...selected,
        ...patch,
        updatedAt: Date.now(),
      }
      await saveAlgorithm(next)
      setItems(await listAlgorithms())
      return next
    },
    [selected],
  )

  const handleSave = useCallback(async () => {
    if (!selected) return
    const patch: Partial<Algorithm> = {
      title: title.trim() || selected.title,
      description: desc.trim(),
      editorMode,
    }
    if (editorMode === 'source') {
      patch.sourceCode = code
      patch.vizCode = selected.vizCode ?? selected.files[0]?.content
    } else {
      patch.vizCode = code
      patch.sourceCode = selected.sourceCode
      patch.files = [
        {
          name: selected.files[0]?.name ?? `${selected.id}.js`,
          content: code,
        },
      ]
    }
    await persistSelected(patch)
    setDirty(false)
    showToast('已保存')
  }, [code, desc, editorMode, persistSelected, selected, showToast, title])

  const handleNew = useCallback(async () => {
    const now = Date.now()
    const language = lang
    const skeleton =
      language === 'python'
        ? `# Worktable 注入 tracers：Array1DTracer, LogTracer, Tracer, Layout, VerticalLayout\n\narray1d = Array1DTracer("数组")\nlog = LogTracer("日志")\n\n\ndef main():\n    Layout.setRoot(VerticalLayout([array1d, log]))\n    array1d.set([3, 1, 4, 1, 5])\n    Tracer.delay()\n    log.println("开始")\n    Tracer.delay()\n\n\nmain()\n`
        : language === 'cpp'
          ? `#include "av.h"\n#include <vector>\nusing namespace av;\n\nint main() {\n  Array1DTracer array1d("数组");\n  LogTracer log("日志");\n  std::vector<int> A = {3, 1, 4};\n  VerticalLayout layout({&array1d, &log});\n  Layout.setRoot(layout);\n  array1d.set(A);\n  Tracer::delay(11);\n  log.println("开始");\n  Tracer::delay(13);\n  return 0;\n}\n`
          : `const { Array1DTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');\n\nconst array1dTracer = new Array1DTracer('数组');\nconst logTracer = new LogTracer('日志');\n\n(function main() {\n  Layout.setRoot(new VerticalLayout([array1dTracer, logTracer]));\n  array1dTracer.set([3, 1, 4, 1, 5]);\n  Tracer.delay();\n  logTracer.println('开始');\n  Tracer.delay();\n})();\n`
    const ext = language === 'python' ? 'py' : language === 'cpp' ? 'cpp' : 'js'
    const algo: Algorithm = {
      id: createAlgorithmId(),
      title: '未命名算法',
      description: '',
      language,
      category: '其他',
      tags: [],
      favorite: false,
      createdAt: now,
      updatedAt: now,
      source: 'user',
      files: [{ name: `main.${ext}`, content: skeleton }],
      sourceCode: skeleton,
      vizCode: skeleton,
      editorMode: 'source',
    }
    await saveAlgorithm(algo)
    const all = await listAlgorithms()
    setItems(all)
    setSelectedId(algo.id)
    showToast('已新建算法')
  }, [lang, showToast])

  const handleSaveAs = useCallback(async () => {
    if (!selected) return
    const now = Date.now()
    const copy: Algorithm = {
      ...selected,
      id: createAlgorithmId(),
      title: `${selected.title} 副本`,
      favorite: false,
      source: 'user',
      createdAt: now,
      updatedAt: now,
      files: [{ name: selected.files[0]?.name ?? 'main.js', content: code }],
    }
    await saveAlgorithm(copy)
    setItems(await listAlgorithms())
    setSelectedId(copy.id)
    showToast('已另存为我的算法')
  }, [code, selected, showToast])

  const handleToggleFavorite = useCallback(async () => {
    if (!selected) return
    await persistSelected({ favorite: !selected.favorite })
    showToast(selected.favorite ? '已取消收藏' : '已收藏')
  }, [persistSelected, selected, showToast])

  const handleDelete = useCallback(
    async (id: string) => {
      setPendingDeleteId(null)
      // Curved Card Deletion — animate then remove (§8)
      setExitingId(id)
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      await new Promise((r) => window.setTimeout(r, reduce ? 0 : 280))
      await deleteAlgorithm(id)
      setExitingId(null)
      const all = await listAlgorithms()
      setItems(all)
      if (selectedId === id) setSelectedId(all[0]?.id ?? null)
      showToast('已删除')
    },
    [selectedId, showToast],
  )

  const handleBulkDelete = useCallback(async () => {
    const ids = [...bulkIds]
    if (ids.length === 0) return
    // staggered visual exit then remove
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    for (let i = 0; i < ids.length; i++) {
      setExitingId(ids[i])
      if (!reduce) await new Promise((r) => window.setTimeout(r, 50))
    }
    if (!reduce) await new Promise((r) => window.setTimeout(r, 280))
    for (const id of ids) await deleteAlgorithm(id)
    setExitingId(null)
    setBulkIds(new Set())
    setBulkMode(false)
    const all = await listAlgorithms()
    setItems(all)
    if (selectedId && ids.includes(selectedId)) setSelectedId(all[0]?.id ?? null)
    showToast(`已删除 ${ids.length} 个算法`)
  }, [bulkIds, selectedId, showToast])

  const toggleBulk = useCallback((id: string) => {
    setBulkIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllVisible = useCallback(() => {
    setBulkIds(new Set(visible.map((a) => a.id)))
  }, [visible])


  const handleExport = useCallback(async () => {
    const all = await listAlgorithms()
    downloadJson(`worktable-algorithms-${Date.now()}.json`, {
      type: 'worktable-algorithms',
      version: 1,
      exportedAt: Date.now(),
      algorithms: all,
    })
    showToast('已导出 JSON')
  }, [showToast])

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const data = JSON.parse(text) as { algorithms?: Algorithm[] } | Algorithm[]
        const list = Array.isArray(data) ? data : (data.algorithms ?? [])
        const valid = list.filter((a) => a && typeof a.id === 'string' && Array.isArray(a.files))
        if (valid.length === 0) {
          showToast('文件中没有可用算法')
          return
        }
        await bulkPutAlgorithms(
          valid.map((a) => ({
            ...a,
            updatedAt: Date.now(),
          })),
        )
        await refresh()
        showToast(`已导入 ${valid.length} 个算法`)
      } catch {
        showToast('导入失败：不是有效 JSON')
      }
    },
    [refresh, showToast],
  )

  const run = useCallback(async () => {
    stopPlay()
    setError(null)
    setBuilding(true)
    try {
      const language = selected?.language ?? lang
      // 始终执行「可视化代码」；若正在编辑源码则用已保存的 vizCode
      const runCode =
        editorMode === 'viz' ? code : (selected?.vizCode ?? '')

      if (!runCode.trim()) {
        setError('可视化代码为空。可先编辑源码，再点「AI 可视化」生成。')
        return
      }

      let result: Awaited<ReturnType<typeof runJsAlgorithm>>

      if (language === 'python') {
        result = await runPythonAlgorithm(runCode)
      } else if (language === 'cpp') {
        const health = await detectCppServer()
        if (!health.ok) {
          setError(
            health.detail ||
              (isElectronRuntime()
                ? '无法连接内置 C++ 服务。请重启应用，或在「设置 → C++ 运行」检查服务地址。'
                : '无法连接 C++ 服务。请在项目根目录运行：node server-cpp/index.mjs，或在「设置 → C++ 运行」配置。'),
          )
          return
        }
        result = await runCppAlgorithm(runCode)
      } else {
        result = await runJsAlgorithm(runCode)
      }

      if (!result.ok) {
        setError(result.error)
        engineRef.current.setCommands([])
        setCursor(0)
        setTracers([])
        setActiveLine(null)
        return
      }
      const commands = result.commands as AvCommand[]
      engineRef.current.setCommands(commands)
      applyCursor(0)
      if (selected) {
        void saveAlgorithm({ ...selected, lastRunAt: Date.now() })
      }
      if (engineRef.current.getChunkCount() > 0) setPlaying(true)
    } finally {
      setBuilding(false)
    }
  }, [applyCursor, code, editorMode, lang, selected, stopPlay])

  useEffect(() => {
    if (!playing) return
    const engine = engineRef.current
    const totalChunks = engine.getChunkCount()
    if (cursor >= totalChunks) {
      setPlaying(false)
      return
    }
    const delay = BASE_INTERVAL / speed
    timerRef.current = window.setTimeout(() => {
      applyCursor(cursor + 1)
    }, delay)
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [playing, cursor, speed, applyCursor])

  useEffect(() => () => stopPlay(), [stopPlay])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, .cm-editor')) return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        stopPlay()
        applyCursor(engineRef.current.getCursor() + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        stopPlay()
        applyCursor(engineRef.current.getCursor() - 1)
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        void run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applyCursor, run, stopPlay])

  return (
    <div className={`algo-lab${aiOpen ? ' has-inline-ai' : ''}`}>
      <aside className="algo-lab__nav">
        <div className="algo-lab__nav-head">
          <div className="algo-lab__nav-title">算法库</div>
          <ChipRow ariaLabel="语言" options={LANG_OPTIONS} value={lang} onChange={setLang} />
          <ChipRow ariaLabel="筛选" options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
          <input
            className="algo-search"
            placeholder="搜索标题、标签…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="algo-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="分类"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? '全部分类' : c}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button size="sm" variant="primary" onClick={() => void handleNew()}>
              新建
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void handleExport()}>
              导出
            </Button>
            <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>
              导入
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleImportFile(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>
        <div className="bulk-bar">
          <Button
            size="sm"
            variant={bulkMode ? 'primary' : 'ghost'}
            onClick={() => {
              setBulkMode((m) => !m)
              setBulkIds(new Set())
            }}
          >
            {bulkMode ? '退出多选' : '多选'}
          </Button>
          {bulkMode ? (
            <>
              <Button size="sm" variant="ghost" onClick={selectAllVisible}>
                全选
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={bulkIds.size === 0}
                onClick={() => void handleBulkDelete()}
              >
                删除所选（{bulkIds.size}）
              </Button>
            </>
          ) : (
            <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>{visible.length} 项</span>
          )}
        </div>
        <ul className="algo-lab__list">
          {visible.map((a, idx) => (
            <li
              key={a.id}
              className={[
                pendingDeleteId === a.id ? 'is-pending-delete' : '',
                exitingId === a.id ? 'is-exiting' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div
                className={`algo-item${a.id === selectedId ? ' is-active' : ''}${
                  exitingId === a.id ? ' is-exiting' : ''
                }`}
                style={bulkMode ? { animationDelay: `${idx * 12}ms` } : undefined}
              >
                <span className="trash-zone" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                {bulkMode ? (
                  <button
                    type="button"
                    className="algo-item__main"
                    onClick={() => toggleBulk(a.id)}
                    aria-label={`选择 ${a.title}`}
                  >
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={`bulk-check${bulkIds.has(a.id) ? ' is-checked' : ''}`}>
                        {bulkIds.has(a.id) ? '✓' : ''}
                      </span>
                      <span className="algo-item__title">{a.title}</span>
                    </span>
                    <span className="algo-item__meta">
                      {a.category} · {a.tags.slice(0, 2).join(' / ') || '无标签'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="algo-item__main"
                    onClick={() => setSelectedId(a.id)}
                  >
                    <span className="algo-item__title">
                      {a.favorite ? '★ ' : ''}
                      {a.title}
                    </span>
                    <span className="algo-item__meta">
                      {a.category} · {a.tags.slice(0, 2).join(' / ') || '无标签'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className="algo-item__del"
                  title="删除"
                  aria-label={`删除 ${a.title}`}
                  onClick={() => setPendingDeleteId(a.id)}
                >
                  ×
                </button>
              </div>
              {pendingDeleteId === a.id ? (
                <div className="algo-item__confirm">
                  <span>确认删除？</span>
                  <Button size="sm" variant="danger" onClick={() => void handleDelete(a.id)}>
                    删除
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPendingDeleteId(null)}>
                    取消
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
          {visible.length === 0 ? (
            <li className="algo-empty">没有匹配的算法</li>
          ) : null}
        </ul>
        <div className="algo-lab__nav-foot">本地 IndexedDB · 可导出备份</div>
      </aside>

      <section className="algo-lab__viz">
        <div className="algo-lab__viz-head">
          <div>
            <h2 className="algo-lab__viz-title">可视化</h2>
            <p className="algo-lab__viz-desc">{selected?.description ?? '选择或新建算法'}</p>
          </div>
        </div>
        <div className="algo-lab__canvas">
          {tracers.length === 0 ? (
            <div className="viz-placeholder">
              <p>点击「运行」执行算法，逐步回放可视化。</p>
              <p className="viz-placeholder__hint">支持 Array1D / Array2D / Log / Graph</p>
            </div>
          ) : (
            <div className="viz-stack">
              {tracers.map((t) => (
                <TracerPanel key={t.key} state={t} />
              ))}
            </div>
          )}
        </div>
        <PlayerBar
          playing={playing}
          cursor={cursor}
          total={total}
          speed={speed}
          building={building}
          onRun={() => void run()}
          onPlayToggle={() => setPlaying((p) => !p)}
          onStep={(d) => {
            stopPlay()
            applyCursor(engineRef.current.getCursor() + d)
          }}
          onSeek={(c) => {
            stopPlay()
            applyCursor(c)
          }}
          onSpeedChange={setSpeed}
        />
      </section>

      <section className="algo-lab__editor">
        <div className="algo-lab__editor-head">
          <input
            className="algo-title-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setDirty(true)
            }}
            placeholder="算法标题"
            disabled={!selected}
          />
          <div className="algo-lab__editor-actions">
            <span className="algo-lab__hint">{dirty ? '未保存' : '已同步'}</span>
            <ChipRow
              ariaLabel="编辑器模式"
              options={[
                { value: 'source' as const, label: '源码' },
                { value: 'viz' as const, label: '可视化代码' },
              ]}
              value={editorMode}
              onChange={(m) => void switchEditorMode(m)}
            />
            <Button
              size="sm"
              variant="primary"
              disabled={!selected || !dirty}
              onClick={() => void handleSave()}
            >
              保存
            </Button>
            <Button size="sm" variant="ghost" disabled={!selected} onClick={() => void handleSaveAs()}>
              另存为
            </Button>
            <Button size="sm" variant="ghost" disabled={!selected} onClick={() => void handleToggleFavorite()}>
              {selected?.favorite ? '取消收藏' : '收藏'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!selected}
              title="在本页打开 AI 问答"
              onClick={() => {
                if (!selected) return
                setAiAutoAsk(
                  `请解释算法「${selected.title}」的思路、时间/空间复杂度，并指出可改进点。`,
                )
                setAiOpen(true)
              }}
            >
              问 AI
            </Button>
            <Button
              size="sm"
              variant="ghost"
              busy={converting}
              disabled={!selected || converting}
              title="静默把源码转成可视化代码（不跳转）"
              onClick={() => void silentVisualize()}
            >
              AI 可视化
            </Button>
          </div>
        </div>
        <div className="algo-lab__mode-bar">
          <span className="algo-lab__hint">
            {editorMode === 'source'
              ? '编辑业务源码；「运行」始终执行可视化代码'
              : '当前为可视化代码，可直接运行'}
          </span>
        </div>
        <div style={{ padding: '0 12px 8px' }}>
          <Disclosure label="元信息" defaultOpen={false}>
            <label className="algo-field">
              <span>描述</span>
              <input
                value={desc}
                onChange={(e) => {
                  setDesc(e.target.value)
                  setDirty(true)
                }}
                disabled={!selected}
              />
            </label>
            <label className="algo-field">
              <span>分类</span>
              <input
                value={selected?.category ?? ''}
                onChange={(e) => {
                  void persistSelected({ category: e.target.value || '其他' })
                }}
                disabled={!selected || selected.source === 'builtin'}
                title={selected?.source === 'builtin' ? '内置算法请先「另存为」再改分类' : undefined}
              />
            </label>
            <label className="algo-field">
              <span>标签（逗号分隔）</span>
              <input
                value={(selected?.tags ?? []).join(', ')}
                onChange={(e) => {
                  const tags = e.target.value
                    .split(/[,，]/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                  void persistSelected({ tags })
                }}
                disabled={!selected || selected.source === 'builtin'}
              />
            </label>
          </Disclosure>
        </div>
        <div className="algo-lab__editor-body">
          <CodeEditor
            value={code}
            onChange={(v) => {
              setCode(v)
              setDirty(true)
            }}
            activeLine={activeLine}
            language={selected?.language ?? lang}
          />
        </div>
        {error ? (
          <div className="algo-lab__error" role="alert">
            {error}
          </div>
        ) : null}
      </section>

      {toast ? (
        <div className="algo-toast" role="status">
          {toast}
        </div>
      ) : null}

      <InlineAiPanel
        open={aiOpen}
        onClose={() => {
          setAiOpen(false)
          setAiAutoAsk(undefined)
        }}
        title={selected ? `算法 · ${selected.title}` : '算法 AI'}
        systemPrompt={[
          buildAlgoSystemPrompt(),
          selected
            ? formatAlgorithmContext({
                title: selected.title,
                description: selected.description,
                language: selected.language,
                category: selected.category,
                code: editorMode === 'source' ? code : (selected.vizCode ?? code),
              })
            : '',
        ]
          .filter(Boolean)
          .join('\n\n')}
        autoAsk={aiAutoAsk}
      />
    </div>
  )
}
