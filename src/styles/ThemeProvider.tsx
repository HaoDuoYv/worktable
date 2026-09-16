import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_KEY = 'worktable.theme'

type ThemeContextValue = {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
  toggleFromEvent: (clientX: number, clientY: number) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'dark'
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
}

function farthestRadius(x: number, y: number): number {
  return Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  )
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Radial Theme Transition — advanced-interaction-design §1
 *
 * 旧主题克隆层盖在最上层，从点击点「挖洞」逐步露出底层新主题。
 * 即使系统开了「减少动态效果」，也保留 320ms 可见扩散（缩短时长，不直接跳变）。
 */
function runRadialTransition(
  from: 'light' | 'dark',
  to: 'light' | 'dark',
  x: number,
  y: number,
  onApply: () => void,
) {
  if (from === to) {
    onApply()
    return
  }

  // 减少动态：仍做短扩散，保证用户能看见「以按钮为圆心」
  const duration = prefersReducedMotion() ? 320 : 780
  const radius = farthestRadius(x, y)

  const cloneHost = document.createElement('div')
  cloneHost.id = 'theme-radial-clone'
  cloneHost.className = 'theme-clone-overlay'
  cloneHost.setAttribute('aria-hidden', 'true')
  cloneHost.dataset.theme = from

  const bodyClone = document.body.cloneNode(true) as HTMLElement
  // 克隆里不要再嵌套克隆层
  bodyClone.querySelectorAll('#theme-radial-clone, .theme-clone-ring').forEach((n) => n.remove())
  bodyClone.style.margin = '0'
  bodyClone.style.width = '100%'
  bodyClone.style.height = '100%'
  bodyClone.style.overflow = 'hidden'
  bodyClone.style.position = 'static'

  const liveMain = document.querySelector('.app-shell__main')
  const mainClone = bodyClone.querySelector('.app-shell__main')
  if (mainClone instanceof HTMLElement && liveMain instanceof HTMLElement) {
    mainClone.scrollTop = liveMain.scrollTop
  }

  cloneHost.appendChild(bodyClone)

  const ring = document.createElement('div')
  ring.className = 'theme-clone-ring'
  ring.setAttribute('aria-hidden', 'true')

  const setGeom = (r: number) => {
    const inner = Math.max(0, r - 3)
    const outer = r + 2
    // 必须同时写 webkit + 标准属性
    const mask = `radial-gradient(circle at ${x}px ${y}px, rgba(0,0,0,0) ${inner}px, rgba(0,0,0,1) ${outer}px)`
    cloneHost.style.webkitMaskImage = mask
    cloneHost.style.maskImage = mask
    cloneHost.style.webkitMaskRepeat = 'no-repeat'
    cloneHost.style.maskRepeat = 'no-repeat'
    cloneHost.style.webkitMaskSize = '100% 100%'
    cloneHost.style.maskSize = '100% 100%'
    cloneHost.dataset.r = String(Math.round(r))
    cloneHost.dataset.xy = `${Math.round(x)},${Math.round(y)}`

    const d = r * 2
    ring.style.width = `${d}px`
    ring.style.height = `${d}px`
    ring.style.left = `${x}px`
    ring.style.top = `${y}px`
    // 扩散期间保持可见，最低不透明度 0.92，避免整体发灰导致字糊
    ring.style.opacity = r < 12 ? '0' : String(Math.max(0.92, 1 - r / (radius || 1) * 0.35))
  }

  Object.assign(cloneHost.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    right: '0',
    bottom: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '2147483000',
    pointerEvents: 'none',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  })

  Object.assign(ring.style, {
    position: 'fixed',
    borderRadius: '50%',
    border: '3px solid',
    borderColor: to === 'dark' ? 'rgba(148,163,184,0.7)' : 'rgba(37,99,235,0.55)',
    boxShadow:
      to === 'dark'
        ? '0 0 30px 10px rgba(15,23,42,0.4)'
        : '0 0 30px 10px rgba(37,99,235,0.22)',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: '2147483001',
    width: '0px',
    height: '0px',
    left: `${x}px`,
    top: `${y}px`,
  })

  setGeom(0)

  // 挂到 html 下，避免被 body 内其它逻辑影响
  document.documentElement.appendChild(cloneHost)
  document.documentElement.appendChild(ring)

  // 先绘制一帧完整旧主题，再切换底层并开始挖洞
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      onApply()

      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 2.2)
        setGeom(radius * eased)
        if (t < 1) {
          requestAnimationFrame(tick)
        } else {
          cloneHost.remove()
          ring.remove()
        }
      }
      requestAnimationFrame(tick)
    })
  })

  window.setTimeout(() => {
    cloneHost.remove()
    ring.remove()
  }, duration + 120)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode())
  const [systemDark, setSystemDark] = useState(() => systemPrefersDark())
  const busyRef = useRef(false)

  const resolved: 'light' | 'dark' =
    mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      if (busyRef.current) return
      const from: 'light' | 'dark' = resolved
      const to: 'light' | 'dark' = from === 'dark' ? 'light' : 'dark'
      busyRef.current = true
      runRadialTransition(from, to, clientX, clientY, () => {
        applyTheme(to)
        setMode(to)
      })
      window.setTimeout(() => {
        busyRef.current = false
      }, prefersReducedMotion() ? 360 : 820)
    },
    [resolved, setMode],
  )

  const value = useMemo(
    () => ({ mode, resolved, setMode, toggleFromEvent }),
    [mode, resolved, setMode, toggleFromEvent],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
