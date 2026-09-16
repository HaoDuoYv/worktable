import { useTheme } from '@/styles/ThemeProvider'
import { IconButton } from '@/components/IconButton'
import { Icon } from '@/components/Icon'

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
        <Icon name={resolved === 'dark' ? 'sun' : 'moon'} size={18} />
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
