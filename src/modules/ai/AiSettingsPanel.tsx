import { useCallback, useState } from 'react'
import { Button } from '@/components/Button'
import { Disclosure } from '@/components/Disclosure'
import {
  DEFAULT_AI,
  isAiConfigured,
  loadAiSettings,
  saveAiSettings,
  testAiConnection,
  type AiSettings,
} from '@/modules/ai/aiClient'

export function AiSettingsPanel() {
  const [form, setForm] = useState<AiSettings>(() => loadAiSettings())
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const configured = isAiConfigured(form)

  const patch = (p: Partial<AiSettings>) => setForm((f) => ({ ...f, ...p }))

  const onSave = useCallback(() => {
    saveAiSettings(form)
    setStatus('已保存 AI 配置（密钥仅存本机）')
  }, [form])

  const onTest = useCallback(async () => {
    saveAiSettings(form)
    setTesting(true)
    setStatus(null)
    try {
      const text = await testAiConnection(form)
      setStatus(`连接成功：${text.slice(0, 80)}`)
    } catch (e) {
      setStatus(`连接失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setTesting(false)
    }
  }, [form])

  return (
    <section className="panel">
      <h2 className="panel__title">AI 接口</h2>
      <p className="panel__text">
        OpenAI 兼容端点。可接 DeepSeek、通义、Kimi、Ollama 等。密钥只保存在浏览器本地。
      </p>
      <div style={{ display: 'grid', gap: 10, marginTop: 14, maxWidth: 560 }}>
        <label className="algo-field">
          <span>Base URL</span>
          <input
            value={form.baseUrl}
            onChange={(e) => patch({ baseUrl: e.target.value })}
            placeholder="https://api.deepseek.com/v1"
          />
        </label>
        <label className="algo-field">
          <span>API Key</span>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => patch({ apiKey: e.target.value })}
            placeholder="sk-..."
            autoComplete="off"
          />
        </label>
        <label className="algo-field">
          <span>模型</span>
          <input
            value={form.model}
            onChange={(e) => patch({ model: e.target.value })}
            placeholder="deepseek-chat"
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="algo-field">
            <span>温度</span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={form.temperature ?? 0.7}
              onChange={(e) => patch({ temperature: Number(e.target.value) })}
            />
          </label>
          <label className="algo-field">
            <span>最大 tokens</span>
            <input
              type="number"
              min={256}
              max={8192}
              step={256}
              value={form.maxTokens ?? 2048}
              onChange={(e) => patch({ maxTokens: Number(e.target.value) })}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={onSave}>
            保存 AI 配置
          </Button>
          <Button variant="ghost" busy={testing} onClick={() => void onTest()}>
            测试连接
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setForm({ ...DEFAULT_AI, apiKey: form.apiKey })
            }}
          >
            重置默认
          </Button>
        </div>
        {status ? (
          <p className="panel__text" role="status">
            {status}
          </p>
        ) : null}
        <Disclosure label="示例配置" defaultOpen={false}>
          <ul style={{ margin: '0 0 0 18px', color: 'var(--text-muted)', fontSize: 13 }}>
            <li>DeepSeek：https://api.deepseek.com/v1 · deepseek-chat</li>
            <li>OpenAI：https://api.openai.com/v1 · gpt-4o-mini</li>
            <li>Ollama：http://127.0.0.1:11434/v1 · qwen2.5</li>
          </ul>
        </Disclosure>
        <p className="panel__text">当前状态：{configured ? '已配置' : '未配置（AI 页暂不可用）'}</p>
      </div>
    </section>
  )
}
