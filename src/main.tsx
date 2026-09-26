import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyThemePrefs } from './core/theme/themePrefs'
import './styles/tokens.css'
import './styles/theme.css'
import './styles/shell.css'
import './styles/ui.css'
import './styles/tutorial.css'
import './styles/algo-lab.css'
import './styles/select-menu.css'
import './styles/news.css'
import './styles/overview.css'

// 启动即应用主题偏好（主题色预设 / 玻璃液态 / 自定义主题）
applyThemePrefs()

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element #root not found')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
