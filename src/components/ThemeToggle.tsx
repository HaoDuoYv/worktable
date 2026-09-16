import { useTheme } from '@/styles/ThemeProvider'
import { IconButton } from '@/components/IconButton'

/**
 * Theme toggle with Radial Theme Transition (advanced-interaction-design #1).
 */
export function ThemeToggle() {
  const { resolved, mode, setMode, toggleFromEvent } = useTheme()

  const onPointerToggle = (e: React.MouseEvent) => {
    toggleFromEvent(e.clientX, e.clientY)
  }

  const label = resolved === 'dark' ? '切换到明亮主题' : '切换到黑暗主题'

  return (
    <div className="theme-toggle" role="group" aria-label="主题">
      <IconButton label={label} onClick={onPointerToggle} className="theme-toggle__main">
        {resolved === 'dark' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7.5 7.5 0 1 0 21 14.5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </IconButton>
      <button
        type="button"
        className="theme-toggle__cycle"
        title="深色 / 浅色 / 跟随系统"
        aria-label={`主题模式：${mode}，点击切换模式`}
        onClick={() => {
          const next = mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark'
          setMode(next)
        }}
      >
        {mode === 'system' ? '系统' : mode === 'light' ? '浅色' : '深色'}
      </button>
    </div>
  )
}
