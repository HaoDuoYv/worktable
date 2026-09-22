import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CodeEditor } from '@/components/CodeEditor'
import { PlayerBar, type Speed } from '@/components/PlayerBar'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Icon } from '@/components/Icon'
import { SelectMenu } from '@/components/SelectMenu'
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
import { hasRunningVizJob, subscribeAiJobs } from '@/modules/ai/aiJobs'
import {
  buildAlgoSystemPrompt,
  formatAlgorithmContext,
  isAiConfigured,
} from '@/modules/ai/aiClient'

/** Compact language switcher labels for the left-nav dock. */
const LANG_SHORT: { value: AlgoLanguage; short: string; title: string }[] = [
  { value: 'javascript', short: 'JS', title: 'JavaScript' },
  { value: 'python', short: 'Py', title: 'Python' },
  { value: 'cpp', short: 'C++', title: 'C++' },
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

function usePersistedString(key: string, fallback: string) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? fallback
    } catch {
      return fallback
    }
  })
  const set = useCallback(
    (next: string) => {
      setValue(next)
      try {
        localStorage.setItem(key, next)
      } catch {
        /* ignore */
      }
    },
    [key],
  )
  return [value, set] as const
}

function usePersistedJSON<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  })
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          /* ignore */
        }
        return resolved
      })
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
        <IconButton label={collapseLabel ?? '折叠面板'} title={collapseLabel ?? '折叠面板'} onClick={onCollapse}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="panel-chrome__fold-icon">
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 5v14" stroke="currentColor" strokeWidth="1.5" />
            <path d="M15.5 10l-2 2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
  const [lang, setLangState] = useState<AlgoLanguage>(() => {
    try {
      const raw = localStorage.getItem('algolab.lib.lang')
      if (raw === 'python' || raw === 'cpp' || raw === 'javascript') return raw
    } catch {
      /* ignore */
    }
    return 'javascript'
  })
  const [navSel, setNavSel] = usePersistedString('algolab.nav.sel', 'all')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Algorithm[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [exitingId, setExitingId] = useState<string | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set())
  const [editorMode, setEditorMode] = useState<'source' | 'viz'>('viz')
  const [aiOpen, setAiOpen] = useState(false)
  const [converting, setConverting] = useState(false)
  // 跨路由同步「生成可视化」全局任务状态，防止切页后按钮可再点导致重复执行
  useEffect(() => subscribeAiJobs(() => setConverting(hasRunningVizJob())), [])
  const [mobileTab, setMobileTab] = useState<'library' | 'viz' | 'code'>('viz')
  const [openCats, setOpenCats] = usePersistedJSON<Record<string, boolean>>('algolab.nav.open', {})
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement | null>(null)
  /** VS Code Explorer-style context menu */
  const [ctxMenu, setCtxMenu] = useState<{
    x: number
    y: number
    target: 'folder' | 'file' | 'blank'
    category?: string
    algoId?: string
  } | null>(null)
  const [renameState, setRenameState] = useState<{
    kind: 'folder' | 'file'
    key: string
    value: string
  } | null>(null)
  const [confirmFolderDel, setConfirmFolderDel] = useState<string | null>(null)
  const [confirmFileDel, setConfirmFileDel] = useState<string | null>(null)
  /** Tree focus drives create-target path (folder selected → inside; file → parent). */
  const [treeFocus, setTreeFocus] = useState<
    | { kind: 'none' }
    | { kind: 'folder'; category: string }
    | { kind: 'file'; id: string; category: string }
  >({ kind: 'none' })
  /** Empty folders (no algos yet) — categories otherwise derive from algorithm.category. */
  const [extraFolders, setExtraFolders] = usePersistedJSON<string[]>('algolab.nav.folders', [])
  const ctxRef = useRef<HTMLDivElement | null>(null)

  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const [cursor, setCursor] = useState(0)
  const [activeLine, setActiveLine] = useState<number | null>(null)
  const [tracers, setTracers] = useState<ReturnType<AvEngine['getAll']>>([])
  const [chunkTotal, setChunkTotal] = useState(0)

  /* —— Panel layout state (persisted) —— */
  const [libW, setLibW] = usePersistedWidth('algolab.lib.w', 260)
  const [codeW, setCodeW] = usePersistedWidth('algolab.code.w', 420)
  const [libCollapsed, setLibCollapsed] = usePersistedFlag('algolab.lib.collapsed', false)
  const [codeCollapsed, setCodeCollapsed] = usePersistedFlag('algolab.code.collapsed', false)
  const [preset, setPreset] = useState<LayoutPreset>('default')
  const [logTab, setLogTab] = useState<'log' | 'stats'>('log')
  const [autoScroll, setAutoScroll] = usePersistedFlag('algolab.log.autoscroll', true)
  const [logCollapsed, setLogCollapsed] = usePersistedFlag('algolab.log.collapsed', false)
  const [logH, setLogH] = usePersistedWidth('algolab.log.h', 168)
  const logStart = useRef(logH)
  const libStart = useRef(libW)
  const codeStart = useRef(codeW)
  const logBodyRef = useRef<HTMLDivElement | null>(null)

  const engineRef = useRef(new AvEngine())
  const timerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const total = chunkTotal

  const selected = useMemo(
    () => items.find((a) => a.id === selectedId) ?? null,
    [items, selectedId],
  )

  const setLang = useCallback((next: AlgoLanguage) => {
    setLangState(next)
    try {
      localStorage.setItem('algolab.lib.lang', next)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleCat = useCallback(
    (cat: string, force?: boolean) => {
      setOpenCats((prev) => ({
        ...prev,
        [cat]: force ?? !prev[cat],
      }))
    },
    [setOpenCats],
  )

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }, [])

  /** Create-target category: none→根「其他」; folder→其内; file→父文件夹（VS Code）. */
  const resolveCreateCategory = useCallback(() => {
    if (treeFocus.kind === 'folder') return treeFocus.category || '其他'
    if (treeFocus.kind === 'file') return treeFocus.category || '其他'
    return '其他'
  }, [treeFocus])

  const openCtx = useCallback(
    (e: React.MouseEvent, target: 'folder' | 'file' | 'blank', category?: string, algoId?: string) => {
      e.preventDefault()
      e.stopPropagation()
      setCtxMenu({ x: e.clientX, y: e.clientY, target, category, algoId })
    },
    [],
  )

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [ctxMenu])

  const uniqueFolderName = useCallback(
    (base: string) => {
      const taken = new Set([
        ...items.map((a) => a.category || '其他'),
        ...extraFolders,
      ])
      if (!taken.has(base)) return base
      let i = 2
      while (taken.has(`${base} ${i}`)) i++
      return `${base} ${i}`
    },
    [items, extraFolders],
  )

  /** ＋文件 / 右键新建文件 → 空文件（不提供示例骨架） */
  const handleNewFileIn = useCallback(
    async (category?: string) => {
      const now = Date.now()
      const language = lang
      const cat = category || resolveCreateCategory()
      const ext = language === 'python' ? 'py' : language === 'cpp' ? 'cpp' : 'js'
      const title = '未命名算法'
      const empty = ''
      const algo: Algorithm = {
        id: createAlgorithmId(),
        title,
        description: '',
        language,
        category: cat,
        tags: [],
        favorite: false,
        createdAt: now,
        updatedAt: now,
        source: 'user',
        files: [{ name: `main.${ext}`, content: empty }],
        sourceCode: empty,
        vizCode: undefined,
        editorMode: 'source',
      }
      await saveAlgorithm(algo)
      const all = await listAlgorithms()
      setItems(all)
      setSelectedId(algo.id)
      setNavSel(cat)
      toggleCat(cat, true)
      setTreeFocus({ kind: 'file', id: algo.id, category: cat })
      setRenameState({ kind: 'file', key: algo.id, value: title })
      showToast('已新建空算法')
    },
    [lang, resolveCreateCategory, setNavSel, showToast, toggleCat],
  )

  /** ＋文件夹 / 右键新建文件夹 → 根级分类，立即重命名 */
  const handleNewFolder = useCallback(async () => {
    const name = uniqueFolderName('新文件夹')
    setExtraFolders((prev) => (prev.includes(name) ? prev : [...prev, name]))
    setOpenCats((prev) => ({ ...prev, [name]: true }))
    setNavSel(name)
    setTreeFocus({ kind: 'folder', category: name })
    setRenameState({ kind: 'folder', key: name, value: name })
    showToast('已新建文件夹，可重命名')
  }, [setExtraFolders, setNavSel, setOpenCats, showToast, uniqueFolderName])

  const commitRename = useCallback(async () => {
    if (!renameState) return
    const nextName = renameState.value.trim()
    if (!nextName) {
      setRenameState(null)
      return
    }
    if (renameState.kind === 'folder') {
      const oldName = renameState.key
      if (nextName !== oldName) {
        const affected = items.filter((a) => (a.category || '其他') === oldName)
        if (affected.length) {
          await bulkPutAlgorithms(
            affected.map((a) => ({ ...a, category: nextName, updatedAt: Date.now() })),
          )
        }
        setExtraFolders((prev) => prev.map((f) => (f === oldName ? nextName : f)))
        setOpenCats((prev) => {
          const { [oldName]: _drop, ...rest } = prev
          return { ...rest, [nextName]: true }
        })
        setNavSel(nextName)
        setTreeFocus({ kind: 'folder', category: nextName })
      }
    } else {
      const algo = items.find((a) => a.id === renameState.key)
      if (algo && nextName !== algo.title) {
        await saveAlgorithm({ ...algo, title: nextName, updatedAt: Date.now() })
      }
    }
    const all = await listAlgorithms()
    setItems(all)
    setRenameState(null)
    showToast('已重命名')
  }, [items, renameState, setExtraFolders, setNavSel, setOpenCats, showToast])

  const handleDeleteFolder = useCallback(
    async (category: string, dropAlgos: boolean) => {
      const affected = items.filter((a) => (a.category || '其他') === category)
      if (dropAlgos) {
        for (const a of affected) await deleteAlgorithm(a.id)
      } else if (affected.length) {
        await bulkPutAlgorithms(
          affected.map((a) => ({ ...a, category: '其他', updatedAt: Date.now() })),
        )
      }
      setExtraFolders((prev) => prev.filter((f) => f !== category))
      setOpenCats((prev) => {
        const { [category]: _drop, ...rest } = prev
        return rest
      })
      if (navSel === category) setNavSel('all')
      setConfirmFolderDel(null)
      setCtxMenu(null)
      const all = await listAlgorithms()
      setItems(all)
      showToast(dropAlgos ? '已删除文件夹与内含算法' : '已删除文件夹，算法归入「其他」')
    },
    [items, navSel, setExtraFolders, setNavSel, setOpenCats, showToast],
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
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [tracers, autoScroll, logTab])

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
    setChunkTotal(engine.getChunkCount())
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

  // load editor when selection **content** changes（忽略 lastRunAt 等元数据，避免回放被重置）
  const selKey = selected
    ? `${selected.id}|${selected.editorMode ?? 'viz'}|${selected.sourceCode ?? ''}|${selected.vizCode ?? ''}|${selected.title}`
    : ''
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
    setChunkTotal(0)
    setActiveLine(null)
    setTracers([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, stopPlay])

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

  /** 生成可视化：全局互斥；已有结果时确认覆盖 */
  const silentVisualize = useCallback(() => {
    if (!selected) return
    if (hasRunningVizJob() || converting) {
      showToast('正在生成可视化，请稍候')
      return
    }
    const hasViz = Boolean(selected.vizCode && selected.vizCode.trim())
    if (hasViz) {
      const ok = window.confirm('已存在可视化代码，是否重新生成并覆盖？')
      if (!ok) return
    }
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
      },
      onSettled: () => setConverting(false),
    })
  }, [code, converting, editorMode, selected, selectedId, showToast])


  const categories = useMemo(() => {
    const set = new Set(items.filter((a) => a.language === lang).map((a) => a.category || '其他'))
    for (const f of extraFolders) set.add(f)
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }, [items, lang, extraFolders])

  const matchesQuery = useCallback(
    (a: Algorithm) => {
      if (!query.trim()) return true
      const q = query.trim().toLowerCase()
      const hay = `${a.title} ${a.description ?? ''} ${a.tags.join(' ')}`.toLowerCase()
      return hay.includes(q)
    },
    [query],
  )

  const langItems = useMemo(
    () => items.filter((a) => a.language === lang && matchesQuery(a)),
    [items, lang, matchesQuery],
  )

  const visible = useMemo(() => {
    if (navSel === '__fav') return langItems.filter((a) => a.favorite)
    if (navSel === 'all') return langItems
    return langItems.filter((a) => (a.category || '其他') === navSel)
  }, [langItems, navSel])

  const favItems = useMemo(() => langItems.filter((a) => a.favorite), [langItems])

  const navPath = useMemo(() => {
    if (navSel === '__fav') return '收藏'
    if (navSel !== 'all') return navSel
    return selected?.category || '算法库'
  }, [navSel, selected])

  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen])

  useEffect(() => {
    if (!query.trim()) return
    const hits = new Set(langItems.map((a) => a.category || '其他'))
    setOpenCats((prev) => {
      const next = { ...prev }
      let changed = false
      for (const c of hits) {
        if (!next[c]) {
          next[c] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [query, langItems, setOpenCats])

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
  }, [code, desc, editorMode, persistSelected, selected, title])

  // 编辑后防抖自动保存
  useEffect(() => {
    if (!dirty || !selected) return
    const t = window.setTimeout(() => {
      void handleSave()
    }, 700)
    return () => window.clearTimeout(t)
  }, [code, title, desc, dirty, selected, handleSave])

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
      setConfirmFileDel(null)
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
      const n = engineRef.current.getChunkCount()
      engineRef.current.replayTo(Math.min(1, n))
      setCursor(engineRef.current.getCursor())
      setChunkTotal(n)
      setTracers(engineRef.current.getAll())
      const ln = engineRef.current.getCurrentLine()
      setActiveLine(ln === undefined ? null : ln + 1)
      if (selected) {
        void saveAlgorithm({ ...selected, lastRunAt: Date.now() })
      }
      if (engineRef.current.getCursor() < n) setPlaying(true)
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
              title="展开算法库"
              onClick={() => {
                setLibCollapsed(false)
                markCustom()
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 4v16" stroke="currentColor" strokeWidth="1.5" />
                <path d="M13 10l2.5 2L13 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </IconButton>
          </aside>
        ) : (
          <aside
            className="panel algo-lab__nav"
            style={{ '--lib-w': `${libW}px` } as CSSProperties}
          >
            <PanelChrome
              title="算法库"
              subtitle={navPath}
              onCollapse={() => {
                setLibCollapsed(true)
                markCustom()
              }}
              collapseLabel="折叠算法库"
            />

            <div className="algo-lab__nav-toolbar" role="toolbar" aria-label="文件操作">
              <button type="button" className="nav-tool" title="新建文件夹" aria-label="新建文件夹" onClick={() => void handleNewFolder()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 7.5h7l2 2H21v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7.5z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 12v5M9.5 14.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className="nav-tool" title="新建文件" aria-label="新建文件" onClick={() => void handleNewFileIn()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M14 3.5v4h4M12 11v6M9 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className="nav-tool" title="刷新" aria-label="刷新" onClick={() => void refresh()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M19 12a7 7 0 1 1-2-4.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M19 5v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="nav-tool"
                title="折叠全部"
                aria-label="折叠全部"
                onClick={() => setOpenCats({})}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 5h12M8 10h8M10 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <span className="nav-tool__spacer" />
              <div className="nav-more" ref={moreRef}>
                <button
                  type="button"
                  className="nav-tool"
                  title="更多"
                  aria-label="更多"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="6" cy="12" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="18" cy="12" r="1.6" />
                  </svg>
                </button>
                {moreOpen ? (
                  <div className="nav-more__menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); fileInputRef.current?.click() }}>导入 …</button>
                    <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); void handleExport() }}>导出 …</button>
                    <hr className="nav-more__sep" />
                    <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); setBulkMode(true); setBulkIds(new Set()) }}>多选</button>
                  </div>
                ) : null}
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

            <div className="algo-lab__nav-search">
              <span className="algo-search__icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <input
                className="algo-search"
                placeholder="Search …"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="搜索算法"
              />
            </div>

            {bulkMode ? (
              <div className="bulk-bar" role="toolbar" aria-label="多选操作">
                <Button size="sm" variant="ghost" onClick={() => { setBulkMode(false); setBulkIds(new Set()) }}>退出多选</Button>
                <Button size="sm" variant="ghost" onClick={selectAllVisible}>全选</Button>
                <Button size="sm" variant="danger" disabled={bulkIds.size === 0} onClick={() => void handleBulkDelete()}>
                  删除（{bulkIds.size}）
                </Button>
              </div>
            ) : null}

            <div
              className="algo-lab__nav-tree"
              role="tree"
              aria-label="算法文件树"
              onContextMenu={(e) => openCtx(e, 'blank')}
            >
              {categories.map((cat) => {
                const catItems = langItems.filter((a) => (a.category || '其他') === cat)
                const isOpen = Boolean(openCats[cat])
                const isFolderActive = treeFocus.kind === 'folder' && treeFocus.category === cat
                if (query.trim() && catItems.length === 0) return null
                return (
                  <div key={cat} className="nav-group" role="none">
                    <div
                      role="treeitem"
                      aria-expanded={isOpen}
                      aria-selected={isFolderActive || navSel === cat}
                      className={`nav-cat${isFolderActive || navSel === cat ? ' is-active' : ''}`}
                      onClick={() => {
                        setNavSel(cat)
                        setTreeFocus({ kind: 'folder', category: cat })
                        toggleCat(cat)
                      }}
                      onContextMenu={(e) => openCtx(e, 'folder', cat)}
                    >
                      <span className={`nav-cat__chev${isOpen ? ' is-open' : ''}`} aria-hidden="true">
                        {isOpen ? '▾' : '▸'}
                      </span>
                      <span className="nav-cat__icon" aria-hidden="true">📁</span>
                      {renameState?.kind === 'folder' && renameState.key === cat ? (
                        <input
                          className="nav-rename"
                          autoFocus
                          value={renameState.value}
                          onChange={(e) => setRenameState({ ...renameState, value: e.target.value })}
                          onBlur={() => void commitRename()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitRename()
                            if (e.key === 'Escape') setRenameState(null)
                          }}
                        />
                      ) : (
                        <span className="nav-cat__name">{cat}</span>
                      )}
                    </div>
                    {isOpen ? (
                      <ul className="nav-kids" role="group">
                        {catItems.map((a) => (
                          <li
                            key={a.id}
                            className={exitingId === a.id ? 'is-exiting' : ''}
                          >
                            <div
                              className={`nav-file${a.id === selectedId ? ' is-active' : ''}`}
                              onClick={() => {
                                setSelectedId(a.id)
                                setTreeFocus({ kind: 'file', id: a.id, category: a.category || '其他' })
                              }}
                              onContextMenu={(e) => openCtx(e, 'file', a.category || '其他', a.id)}
                            >
                              <span className="nav-file__icon" aria-hidden="true">📄</span>
                              {renameState?.kind === 'file' && renameState.key === a.id ? (
                                <input
                                  className="nav-rename"
                                  autoFocus
                                  value={renameState.value}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setRenameState({ ...renameState, value: e.target.value })}
                                  onBlur={() => void commitRename()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') void commitRename()
                                    if (e.key === 'Escape') setRenameState(null)
                                  }}
                                />
                              ) : (
                                <span className="nav-file__name">
                                  {a.favorite ? '★ ' : ''}
                                  {a.title}
                                </span>
                              )}
                              <button
                                type="button"
                                className="nav-file__del"
                                title="删除"
                                aria-label={`删除 ${a.title}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setConfirmFileDel(a.id)
                                }}
                              >
                                ×
                              </button>
                            </div>
                            {confirmFileDel === a.id ? (
                              <div className="algo-item__confirm">
                                <span>删除「{a.title}」？</span>
                                <Button size="sm" variant="danger" onClick={() => void handleDelete(a.id).then(() => setConfirmFileDel(null))}>删除</Button>
                                <Button size="sm" variant="ghost" onClick={() => setConfirmFileDel(null)}>取消</Button>
                              </div>
                            ) : null}
                            {bulkMode ? (
                              <label className="nav-file__bulk">
                                <input
                                  type="checkbox"
                                  checked={bulkIds.has(a.id)}
                                  onChange={() => toggleBulk(a.id)}
                                />
                                选择
                              </label>
                            ) : null}
                          </li>
                        ))}
                        {catItems.length === 0 ? <li className="algo-empty">空文件夹 — 右键或「新建文件」</li> : null}
                      </ul>
                    ) : null}
                    {confirmFolderDel === cat ? (
                      <div className="algo-item__confirm nav-folder-confirm">
                        <span>删除文件夹「{cat}」？</span>
                        <Button size="sm" variant="danger" onClick={() => void handleDeleteFolder(cat, false)}>仅解散</Button>
                        <Button size="sm" variant="danger" onClick={() => void handleDeleteFolder(cat, true)}>连删算法</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmFolderDel(null)}>取消</Button>
                      </div>
                    ) : null}
                  </div>
                )
              })}

              <div className="nav-group nav-group--pseudo" role="none">
                <div
                  role="treeitem"
                  aria-selected={navSel === '__fav'}
                  className={`nav-cat nav-cat--pseudo${navSel === '__fav' ? ' is-active' : ''}`}
                  onClick={() => {
                    setNavSel('__fav')
                    setTreeFocus({ kind: 'none' })
                    toggleCat('__fav', true)
                  }}
                >
                  <span className="nav-cat__icon" aria-hidden="true">★</span>
                  <span className="nav-cat__name">收藏</span>
                </div>
                {navSel === '__fav' ? (
                  <ul className="nav-kids" role="group">
                    {favItems.map((a) => (
                      <li key={a.id}>
                        <div
                          className={`nav-file${a.id === selectedId ? ' is-active' : ''}`}
                          onClick={() => {
                            setSelectedId(a.id)
                            setTreeFocus({ kind: 'file', id: a.id, category: a.category || '其他' })
                          }}
                          onContextMenu={(e) => openCtx(e, 'file', a.category || '其他', a.id)}
                        >
                          <span className="nav-file__icon" aria-hidden="true">📄</span>
                          <span className="nav-file__name">{a.title}</span>
                        </div>
                      </li>
                    ))}
                    {favItems.length === 0 ? <li className="algo-empty">暂无收藏算法</li> : null}
                  </ul>
                ) : null}
              </div>

              {categories.length === 0 ? (
                <div className="algo-empty">{query.trim() ? '没有匹配的算法' : '右键空白区或点「新建文件夹」'}</div>
              ) : null}
            </div>

            <div className="algo-lab__nav-dock">
              <div className="nav-lang" role="radiogroup" aria-label="语言">
                <span className="nav-lang__label" aria-hidden="true">★</span>
                {LANG_SHORT.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={lang === opt.value}
                    className={`nav-lang__btn${lang === opt.value ? ' is-active' : ''}`}
                    title={opt.title}
                    onClick={() => setLang(opt.value)}
                  >
                    {opt.short}
                  </button>
                ))}
              </div>
            </div>

            {ctxMenu ? (
              <div
                ref={ctxRef}
                className="ctx-menu"
                role="menu"
                style={{ left: Math.min(ctxMenu.x, window.innerWidth - 180), top: Math.min(ctxMenu.y, window.innerHeight - 200) }}
                onClick={(e) => e.stopPropagation()}
              >
                {ctxMenu.target !== 'file' && (
                  <button type="button" role="menuitem" onClick={() => { void handleNewFileIn(ctxMenu.category); setCtxMenu(null) }}>
                    新建文件
                  </button>
                )}
                {ctxMenu.target !== 'file' && (
                  <button type="button" role="menuitem" onClick={() => { void handleNewFolder(); setCtxMenu(null) }}>
                    新建文件夹
                  </button>
                )}
                {ctxMenu.target === 'file' && (
                  <button type="button" role="menuitem" onClick={() => { void handleNewFileIn(ctxMenu.category); setCtxMenu(null) }}>
                    在父文件夹新建
                  </button>
                )}
                <hr className="nav-more__sep" />
                {ctxMenu.target === 'folder' ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setRenameState({ kind: 'folder', key: ctxMenu.category!, value: ctxMenu.category! })
                      setCtxMenu(null)
                    }}
                  >
                    重命名
                  </button>
                ) : null}
                {ctxMenu.target === 'file' ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      const a = items.find((x) => x.id === ctxMenu.algoId)
                      if (a) setRenameState({ kind: 'file', key: a.id, value: a.title })
                      setCtxMenu(null)
                    }}
                  >
                    重命名
                  </button>
                ) : null}
                {ctxMenu.target === 'folder' ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="ctx-menu__danger"
                    onClick={() => {
                      setConfirmFolderDel(ctxMenu.category!)
                      setCtxMenu(null)
                    }}
                  >
                    删除
                  </button>
                ) : null}
                {ctxMenu.target === 'file' ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="ctx-menu__danger"
                    onClick={() => {
                      setConfirmFileDel(ctxMenu.algoId!)
                      setCtxMenu(null)
                    }}
                  >
                    删除
                  </button>
                ) : null}
                {ctxMenu.target === 'blank' ? (
                  <>
                    <hr className="nav-more__sep" />
                    <button type="button" role="menuitem" onClick={() => { setCtxMenu(null); fileInputRef.current?.click() }}>导入 …</button>
                    <button type="button" role="menuitem" onClick={() => { setCtxMenu(null); void handleExport() }}>导出 …</button>
                  </>
                ) : null}
              </div>
            ) : null}
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
                <span className="viz-step-info" title="回放步骤">
                  {Math.min(cursor, total)} / {total}
                </span>
              )}
              {activeLine != null && (
                <span className="viz-step-info viz-step-info--muted" title="当前源码行">
                  行 {activeLine}
                </span>
              )}
              <SelectMenu
                ariaLabel="布局预设"
                items={LAYOUT_ITEMS}
                value={preset}
                onChange={(p) => applyPreset(p)}
              />
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

        {/* 统计信息并入底部「统计」Tab，不再使用浮动窗口 */}

        <ResizeHandle
          label="调整日志区高度"
          className="algo-lab__split algo-lab__split--y"
          axis="y"
          onStart={() => {
            logStart.current = logH
          }}
          onDrag={(delta) => {
            if (logCollapsed) return
            setLogH(clamp(logStart.current - delta, 80, 360))
          }}
        />

        <div
          className={`viz-logsec${logCollapsed ? ' is-collapsed' : ''}`}
          style={{ height: logCollapsed ? 34 : logH } as CSSProperties}
        >
          <div className="viz-logsec__bar">
            <div className="viz-logsec__tabs" role="tablist" aria-label="日志与统计">
              <button
                type="button"
                role="tab"
                aria-selected={logTab === 'log'}
                className={`viz-logsec__tab${logTab === 'log' ? ' is-active' : ''}`}
                onClick={() => {
                  setLogCollapsed(false)
                  setLogTab('log')
                }}
              >
                日志
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={logTab === 'stats'}
                className={`viz-logsec__tab${logTab === 'stats' ? ' is-active' : ''}`}
                onClick={() => {
                  setLogCollapsed(false)
                  setLogTab('stats')
                }}
              >
                统计
              </button>
            </div>
            <span className="viz-logsec__spacer" />
            {!logCollapsed ? (
              <Switch checked={autoScroll} onChange={setAutoScroll} label="自动滚动" />
            ) : null}
            <IconButton
              label={logCollapsed ? '展开日志区' : '收起日志区'}
              title={logCollapsed ? '展开日志区' : '收起日志区'}
              onClick={() => setLogCollapsed(!logCollapsed)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {logCollapsed ? (
                  <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </IconButton>
          </div>
          {!logCollapsed ? (
            logTab === 'log' ? (
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
            )
          ) : null}
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
            title="展开代码面板"
            onClick={() => {
              setCodeCollapsed(false)
              markCustom()
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M15 4v16" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 10L8.5 12 11 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
                  setAiOpen(true)
                }}
              >
                <Icon name="message" size={18} />
              </IconButton>
                <IconButton
                  label={selected?.vizCode ? '重新生成可视化' : '生成可视化代码'}
                  title={selected?.vizCode ? '已可视化，点击可重新生成' : '生成可视化代码'}
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
          {/* 元信息已移除：描述/分类/标签改由文件树与右键管理 */}
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
          setAiOpen(false)
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
        autoAsk={undefined}
      />
    </div>
  )
}
