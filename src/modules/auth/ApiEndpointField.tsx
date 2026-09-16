import { useCallback, useState } from 'react'
import {
  loadApiMode,
  loadCustomApiBase,
  saveApiEndpoint,
  type ApiEndpointMode,
} from './api'

/**
 * Cloud endpoint picker — official service is the product default.
 * The official host is intentionally not displayed in the UI.
 */
export function ApiEndpointField() {
  const [mode, setMode] = useState<ApiEndpointMode>(() => loadApiMode())
  const [custom, setCustom] = useState(() => loadCustomApiBase())

  const apply = useCallback((nextMode: ApiEndpointMode, url?: string) => {
    setMode(nextMode)
    saveApiEndpoint(nextMode, url)
  }, [])

  return (
    <div className="auth-field auth-endpoint">
      <span className="auth-endpoint__label">云端服务</span>
      <div className="auth-endpoint__modes" role="radiogroup" aria-label="云端服务">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'official'}
          className={`auth-endpoint__mode${mode === 'official' ? ' is-active' : ''}`}
          onClick={() => apply('official')}
        >
          官方服务
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'custom'}
          className={`auth-endpoint__mode${mode === 'custom' ? ' is-active' : ''}`}
          onClick={() => apply('custom', custom)}
        >
          自定义
        </button>
      </div>
      {mode === 'custom' ? (
        <input
          value={custom}
          onChange={(e) => {
            const v = e.target.value
            setCustom(v)
            saveApiEndpoint('custom', v)
          }}
          placeholder="https://your-api.example.com"
          spellCheck={false}
          autoComplete="off"
          inputMode="url"
        />
      ) : (
        <p className="auth-endpoint__hint">使用产品内置的云端同步服务</p>
      )}
    </div>
  )
}
