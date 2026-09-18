import { useCallback, useState } from 'react'
import {
  loadApiMode,
  loadCustomApiBase,
  normalizeApiBaseUrl,
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
  const [hint, setHint] = useState<string | null>(null)

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
        <>
          <input
            value={custom}
            onChange={(e) => {
              const v = e.target.value
              setCustom(v)
              const norm = normalizeApiBaseUrl(v)
              saveApiEndpoint('custom', v)
              if (v.trim() && !norm) setHint('地址无效，请填写域名或 IP，例如 192.168.1.10:8788')
              else if (norm && !/^https?:\/\//i.test(v.trim())) setHint(`将请求：${norm}/api/...`)
              else setHint(null)
            }}
            placeholder="http://192.144.141.115:8788 或 https://api.example.com"
            spellCheck={false}
            autoComplete="off"
            inputMode="url"
          />
          {hint ? <p className="auth-endpoint__hint">{hint}</p> : null}
          <p className="auth-endpoint__hint">必须是服务器地址/域名，不能只填 IP 且不要拼接当前网站路径</p>
        </>
      ) : (
        <p className="auth-endpoint__hint">使用产品内置的云端同步服务（若域名不可用，请改用自定义地址）</p>
      )}
    </div>
  )
}
