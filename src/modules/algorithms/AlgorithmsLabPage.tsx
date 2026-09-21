import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChipRow, type ChipOption } from '@/components/Chip'
import { CodeEditor } from '@/components/CodeEditor'
import { PlayerBar, type Speed } from '@/components/PlayerBar'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Icon } from '@/components/Icon'
import { SelectMenu } from '@/components/SelectMenu'
import { Disclosure } from '@/components/Disclosure'
import { Switch } from '@/components/Switch'
import { ResizeHandle, usePersistedWidth } from '@/components/Resizable'
import { AvEngine } from '@/core/av/engine'
import { TracerPanel, VariableInspector } from '@/core/av/renderers'
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
import { startVizConvertJob } from '@/modules/ai/aiBackground'
import {
  buildAlgoSystemPrompt,
  formatAlgorithmContext,
  isAiConfigured,
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

/* —— Dockable panel system (布局重构) —— */

type LayoutPreset = 'default' | 'focus' | 'code' | 'custom'

const LAYOUT_ITEMS = [
  { value: 'default' as const, label: '默认布局', icon: 'overview' as const, hint: '算法库 + 可视化 + 代码' },
  { value: 'focus' as const, label: '专注可视化', icon: 'eye' as const, hint: '两侧折叠为图标栏' },
  { value: 'code' as const, label: '双列代码', icon: 'code' as const, hint: '收起算法库，加宽代码' },
  { value: 'custom' as const, label: '自定义', icon: 'settings' as const, hint: '当前为手动调整' },
]

const LIB_MIN = 200
const LIB_MAX = 480
const CODE_MIN = 300
const CODE_MAX = 720

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/** Persisted boolean flag in localStorage. */
function usePersistedFlag(key: string, fallback: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : raw === '1'
    } catch {
      return fallback
    }
  })
  const set = useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        localStorage.setItem(key, next ? '1' : '0')
      } catch {
        /* ignore */
      }
    },
    [key],
  )
  return [value, set] as const
}

/** Six-dot drag grip shown on every panel chrome (visual affordance for panel dragging). */
function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="2.5" r="1.3" />
      <circle cx="7.5" cy="2.5" r="1.3" />
      <circle cx="2.5" cy="7" r="1.3" />
      <circle cx="7.5" cy="7" r="1.3" />
      <circle cx="2.5" cy="11.5" r="1.3" />
      <circle cx="7.5" cy="11.5" r="1.3" />
    </svg>
  )
}

/** Unified panel title bar: drag grip + title + optional subtitle + right actions + collapse. */
function PanelChrome({
  title,
  subtitle,
  right,
  onCollapse,
  collapseLabel,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  onCollapse?: () => void
  collapseLabel?: string
}) {
  return (
    <div className="panel-chrome">
      <span className="panel-chrome__grip" aria-hidden="true" title="面板区域可拖拽调整">
        <GripIcon />
      </span>
      <span className="panel-chrome__title">{title}</span>
      {subtitle ? <span className="panel-chrome__sub">{subtitle}</span> : null}
      <span className="panel-chrome__spacer" />
      {right}
      {onCollapse ? (
        <IconButton label={collapseLabel ?? '折叠面板'} onClick={onCollapse}>
          <Icon name="chevron-down" size={16} className="panel-chrome__fold-icon" />
        </IconButton>
      ) : null}
    </div>
  )
}

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
  const [mobileTab, setMobileTab] = useState<'library' | 'viz' | 'code'>('viz')

  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const [cursor, setCursor] = useState(0)
  const [activeLine, setActiveLine] = useState<number | null>(null)
  const [tracers, setTracers] = useState<ReturnType<AvEngine['getAll']>>([])

  /* —— Panel layout state (persisted) —— */
  const [libW, setLibW] = usePersistedWidth('algolab.lib.w', 260)
  const [codeW, setCodeW] = usePersistedWidth('algolab.code.w', 420)
  const [libCollapsed, setLibCollapsed] = usePersistedFlag('algolab.lib.collapsed', false)
  const [codeCollapsed, setCodeCollapsed] = usePersistedFlag('algolab.code.collapsed', false)
  const [preset, setPreset] = useState<LayoutPreset>('default')
  const [logTab, setLogTab] = useState<'log' | 'stats'>('log')
  const [autoScroll, setAutoScroll] = usePersistedFlag('algolab.log.autoscroll', true)
  const libStart = useRef(libW)
  const codeStart = useRef(codeW)
  const logBodyRef = useRef<HTMLDivElement | null>(null)

  const engineRef = useRef(new AvEngine())
  const timerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const total = engineRef.current.getChunkCount()

  const selected = useMemo(
    () => items.find((a) => a.id === selectedId) ?? null,
    [items, selectedId],
  )

  /* —— Derived view state for the panel layout —— */
  const langLabel =
    (selected?.language ?? lang) === 'python'
      ? 'Python'
      : (selected?.language ?? lang) === 'cpp'
        ? 'C++'
        : 'JavaScript'

  /** Log tracers render in the dedicated log section; everything else stays on the canvas. */
  const vizTracers = useMemo(() => tracers.filter((t) => t.kind !== 'LogTracer'), [tracers])
  const logTracers = useMemo(() => tracers.filter((t) => t.kind === 'LogTracer'), [tracers])
  const logLineCount = useMemo(
    () =>
      logTracers.reduce((n, t) => n + (t.log ? t.log.split('\n').filter(Boolean).length : 0), 0),
    [logTracers],
  )

  const markCustom = useCallback(() => setPreset('custom'), [])

  const applyPreset = useCallback(
    (p: LayoutPreset) => {
      if (p === 'custom') return
      if (p === 'default') {
        setLibCollapsed(false)
        setCodeCollapsed(false)
        setLibW(260)
        setCodeW(420)
      } else if (p === 'focus') {
        setLibCollapsed(true)
        setCodeCollapsed(true)
      } else if (p === 'code') {
        setLibCollapsed(true)
        setCodeCollapsed(false)
        setCodeW(560)
      }
      setPreset(p)
    },
    [setCodeCollapsed, setCodeW, setLibCollapsed, setLibW],
  )

  // Auto-scroll the log section to the latest line while replaying
  useEffect(() => {
    if (!autoScroll || logTab !== 'log') return
    const el = logBodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [tracers, autoScroll, logTab])

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

  /** Convert source to visualization code in a background job (survives navigation). */
  const silentVisualize = useCallback(() => {
    if (!selected) return
    if (!isAiConfigured()) {
      setError('请先在设置中配置 AI 接口地址与密钥。')
      return
    }
    const src = editorMode === 'source' ? code : (selected.sourceCode ?? code)
    if (!src.trim()) {
      setError('源码为空')
      return
    }
    setError(null)
    setConverting(true)
    const algoId = selected.id
    startVizConvertJob({
      algorithm: selected,
      sourceCode: src,
      onApplied: (next) => {
        void listAlgorithms().then((all) => setItems(all))
        if (selectedId !== algoId) return
        setEditorMode('viz')
        setCode(next.vizCode ?? '')
        setDirty(false)
        showToast('已生成可视化代码并通过校验')
        setConverting(false)
      },
    })
    // Job dock shows progress; local chip only flashes briefly
    window.setTimeout(() => setConverting(false), 600)
  }, [code, editorMode, selected, selectedId, showToast])


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
        setError('可视化代码为空。可先编辑源码，再使用「生成可视化代码」。')
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
    <div className={`algo-lab${aiOpen ? ' has-inline-ai' : ''}`} data-mobile-tab={mobileTab}>
      <nav className="algo-lab__seg" aria-label="面板切换">
        {(
          [
            ['viz', '可视化'],
            ['code', '代码'],
            ['library', '算法库'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`algo-lab__seg-btn${mobileTab === key ? ' is-active' : ''}`}
            onClick={() => setMobileTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="algo-lab__workspace">
        {libCollapsed ? (
          <aside className="panel panel-rail panel-rail--lib" aria-label="算法库已折叠">
            <IconButton
              label="展开算法库"
              onClick={() => {
                setLibCollapsed(false)
                markCustom()
              }}
            >
              <Icon name="algorithms" size={18} />
            </IconButton>
            <IconButton
              label="新建算法"
              onClick={() => {
                setLibCollapsed(false)
                markCustom()
                void handleNew()
              }}
            >
              <Icon name="save-copy" size={18} />
            </IconButton>
          </aside>
        ) : (
          <aside
            className="panel algo-lab__nav"
            style={{ '--lib-w': `${libW}px` } as CSSProperties}
          >
            <PanelChrome
              title="算法库"
              subtitle={`${visible.length} 项`}
              onCollapse={() => {
                setLibCollapsed(true)
                markCustom()
              }}
              collapseLabel="折叠算法库"
            />
            <div className="algo-lab__nav-head">
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
                <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>
                  {visible.length} 项
                </span>
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
            <div className="algo-lab__nav-foot">数据保存在本机，可导出备份</div>
          </aside>
        )}

        <ResizeHandle
          label="调整算法库面板宽度"
          className="algo-lab__split"
          onStart={() => {
            libStart.current = libW
          }}
          onDrag={(delta) => {
            if (libCollapsed) return
            setLibW(clamp(libStart.current + delta, LIB_MIN, LIB_MAX))
            markCustom()
          }}
        />

      <section className="panel algo-lab__viz">
        <PanelChrome
          title="可视化"
          subtitle={selected ? `${selected.title} · ${langLabel}` : '选择或新建算法'}
          right={
            <>
              {total > 0 && (
                <span className="viz-step-badge">
                  <span className="viz-step-badge__dot" aria-hidden="true" />
                  {Math.min(cursor, total)} / {total}
                </span>
              )}
              {activeLine != null && <span className="viz-step-line">行 {activeLine}</span>}
              <SelectMenu
                ariaLabel="布局预设"
                items={LAYOUT_ITEMS}
                value={preset}
                onChange={(p) => applyPreset(p)}
              />
              <IconButton label="重置布局" onClick={() => applyPreset('default')}>
                <Icon name="settings" size={16} />
              </IconButton>
            </>
          }
        />

        {selected?.description ? (
          <p className="algo-lab__viz-desc">{selected.description}</p>
        ) : null}

        <div className="viz-vars">
          <div className="viz-vars__head">
            <span className="viz-vars__label">关键变量标志</span>
            <span className="viz-legend" aria-hidden="true">
              <span className="viz-legend__item">
                <i className="viz-legend__dot viz-legend__dot--compare" />
                比较 / 选中
              </span>
              <span className="viz-legend__item">
                <i className="viz-legend__dot viz-legend__dot--swap" />
                写入 / 交换
              </span>
            </span>
          </div>
          {tracers.length > 0 ? (
            <VariableInspector tracers={tracers} />
          ) : (
            <div className="viz-vars__empty">运行算法后，此处实时显示关键变量</div>
          )}
        </div>

        <div className="algo-lab__canvas">
          {tracers.length === 0 ? (
            <div className="viz-placeholder">
              <p>运行算法并逐步查看可视化过程。</p>
              <p className="viz-placeholder__hint">支持 Array1D / Array2D / Log / Graph</p>
            </div>
          ) : vizTracers.length === 0 ? (
            <div className="viz-placeholder">
              <p>本次运行仅包含日志输出，请查看下方日志区。</p>
            </div>
          ) : (
            <div className="viz-stack">
              {vizTracers.map((t) => (
                <TracerPanel key={t.key} state={t} />
              ))}
            </div>
          )}
        </div>

        <div className="viz-logsec">
          <div className="viz-logsec__bar">
            <div className="viz-logsec__tabs" role="tablist" aria-label="日志与统计">
              <button
                type="button"
                role="tab"
                aria-selected={logTab === 'log'}
                className={`viz-logsec__tab${logTab === 'log' ? ' is-active' : ''}`}
                onClick={() => setLogTab('log')}
              >
                日志
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={logTab === 'stats'}
                className={`viz-logsec__tab${logTab === 'stats' ? ' is-active' : ''}`}
                onClick={() => setLogTab('stats')}
              >
                统计
              </button>
            </div>
            <Switch checked={autoScroll} onChange={setAutoScroll} label="自动滚动" />
          </div>
          {logTab === 'log' ? (
            <div className="viz-logsec__body" ref={logBodyRef}>
              {logTracers.length === 0 ? (
                <div className="viz-logsec__empty">
                  暂无日志 — 在代码中使用 LogTracer.println() 输出
                </div>
              ) : (
                logTracers.map((t) => <TracerPanel key={t.key} state={t} />)
              )}
            </div>
          ) : (
            <div className="viz-logsec__body viz-logsec__stats">
              <div className="viz-stat">
                <span className="viz-stat__label">播放进度</span>
                <span className="viz-stat__value">
                  {Math.min(cursor, total)} / {total} 步
                </span>
              </div>
              <div className="viz-stat">
                <span className="viz-stat__label">Tracer 面板</span>
                <span className="viz-stat__value">{tracers.length}</span>
              </div>
              <div className="viz-stat">
                <span className="viz-stat__label">日志行数</span>
                <span className="viz-stat__value">{logLineCount}</span>
              </div>
              <div className="viz-stat">
                <span className="viz-stat__label">播放速度</span>
                <span className="viz-stat__value">{speed}×</span>
              </div>
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

      <ResizeHandle
        label="调整代码面板宽度"
        className="algo-lab__split"
        onStart={() => {
          codeStart.current = codeW
        }}
        onDrag={(delta) => {
          if (codeCollapsed) return
          setCodeW(clamp(codeStart.current - delta, CODE_MIN, CODE_MAX))
          markCustom()
        }}
      />

      {codeCollapsed ? (
        <aside className="panel panel-rail panel-rail--code" aria-label="代码面板已折叠">
          <IconButton
            label="展开代码面板"
            onClick={() => {
              setCodeCollapsed(false)
              markCustom()
            }}
          >
            <Icon name="code" size={18} />
          </IconButton>
        </aside>
      ) : (
        <section
          className="panel algo-lab__editor"
          style={{ '--code-w': `${codeW}px` } as CSSProperties}
        >
          <PanelChrome
            title="代码"
            subtitle={selected?.files[0]?.name ?? ''}
            onCollapse={() => {
              setCodeCollapsed(true)
              markCustom()
            }}
            collapseLabel="折叠代码面板"
          />
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
              <span className="algo-lab__hint">{dirty ? '未保存' : '已保存'}</span>
              <SelectMenu
                ariaLabel="编辑器模式"
                items={[
                  { value: 'source' as const, label: '源码', icon: 'code', hint: '业务逻辑' },
                  { value: 'viz' as const, label: '可视化代码', icon: 'eye', hint: '运行时执行' },
                ]}
                value={editorMode}
                onChange={(m) => void switchEditorMode(m)}
              />
              <IconButton
                label="保存"
                disabled={!selected || !dirty}
                onClick={() => void handleSave()}
              >
                <Icon name="save" size={18} />
              </IconButton>
              <IconButton label="另存为副本" disabled={!selected} onClick={() => void handleSaveAs()}>
                <Icon name="save-copy" size={18} />
              </IconButton>
              <IconButton
                label={selected?.favorite ? '取消收藏' : '收藏'}
                disabled={!selected}
                aria-pressed={Boolean(selected?.favorite)}
                onClick={() => void handleToggleFavorite()}
              >
                <Icon name={selected?.favorite ? 'star-filled' : 'star'} size={18} />
              </IconButton>
              <IconButton
                label="AI 问答"
                disabled={!selected}
                onClick={() => {
                  if (!selected) return
                  setAiAutoAsk(
                    `请解释算法「${selected.title}」的思路、时间/空间复杂度，并指出可改进点。`,
                  )
                  setAiOpen(true)
                }}
              >
                <Icon name="message" size={18} />
              </IconButton>
              <IconButton
                label="生成可视化代码"
                busy={converting}
                disabled={!selected || converting}
                onClick={() => void silentVisualize()}
              >
                <Icon name="wand" size={18} />
              </IconButton>
            </div>
          </div>
          <div className="algo-lab__mode-bar">
            <span className="algo-lab__hint">
              {playing || cursor > 0
                ? selected?.sourceCode && selected.sourceCode !== (selected.vizCode ?? '')
                  ? '回放中：编辑器显示源码，高亮行来自 delay(源码行号)'
                  : editorMode === 'source'
                    ? '编辑源码；运行时执行已保存的可视化代码'
                    : '可视化代码将直接用于运行'
                : editorMode === 'source'
                  ? '编辑源码；运行时执行已保存的可视化代码'
                  : '可视化代码将直接用于运行'}
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
              value={(() => {
                const src = selected?.sourceCode
                const viz = selected?.vizCode
                const inPlayback = playing || cursor > 0
                if (inPlayback && src && src.trim() && src !== viz) return src
                return code
              })()}
              onChange={(v) => {
                if (playing) return
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
          <div className="panel-foot">
            <span>回放时自动高亮当前执行行 · 空格播放/暂停 · ←/→ 步进 · R 运行</span>
            <span className="panel-foot__lang">{langLabel}</span>
          </div>
        </section>
      )}
      </div>

      <footer className="algo-lab__statusbar">
        <span className="algo-lab__status-side">
          <i
            className={`algo-lab__status-dot${error ? ' is-error' : building ? ' is-busy' : ''}`}
            aria-hidden="true"
          />
          {error ? '运行出错' : building ? '构建中…' : '就绪'} · {langLabel} · tracers{' '}
          {tracers.length > 0 ? '已连接' : '待运行'}
        </span>
        <span className="algo-lab__status-side">
          步 {Math.min(cursor, total)}/{total}
          {activeLine != null ? ` · 行 ${activeLine}` : ''} · UTF-8
        </span>
      </footer>

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
