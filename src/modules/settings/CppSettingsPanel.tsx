import { useCallback, useState } from 'react'
import { Button } from '@/components/Button'
import { ChipRow, type ChipOption } from '@/components/Chip'
import {
  DEFAULT_CPP_BASE,
  DEFAULT_CPP_TIMEOUT_MS,
  detectCppServer,
  isElectronRuntime,
  loadCppSettings,
  saveCppSettings,
  type CppCompilerInfo,
  type CppPreferred,
} from '@/core/runners/cpp'

const PREFERRED: ChipOption<CppPreferred>[] = [
  { value: 'auto', label: '自动' },
  { value: 'g++', label: 'g++' },
  { value: 'clang++', label: 'clang++' },
]

export function CppSettingsPanel() {
  const [form, setForm] = useState(() => loadCppSettings())
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [details, setDetails] = useState<CppCompilerInfo[]>([])
  const electron = isElectronRuntime()

  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }))

  const onSave = useCallback(() => {
    const next = saveCppSettings(form)
    setForm(next)
    setStatus('已保存 C++ 配置（仅存本机）')
  }, [form])

  const onTest = useCallback(async () => {
    const next = saveCppSettings(form)
    setTesting(true)
    setStatus(null)
    try {
      const health = await detectCppServer(next.baseUrl)
      setDetails(health.details)
      if (health.ok) {
        const list = health.details
          .map((d) => `${d.name} — ${d.version}`)
          .join('；')
        setStatus(`连接成功。可用编译器：${list}`)
      } else {
        setStatus(
          health.detail ||
            '未检测到编译器。可填写完整路径，例如 C:\\mingw64\\bin\\g++.exe',
        )
      }
    } catch (e) {
      setStatus(`检测失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setTesting(false)
    }
  }, [form])

  return (
    <section className="panel">
      <h2 className="panel__title">C++ 运行</h2>
      <p className="panel__text">
        {electron
          ? '桌面版已内置本地 C++ 服务。若本机未加入 PATH，可在此指定编译器完整路径。'
          : '本地 g++ / clang++。可改服务地址，或指定编译器完整路径（无需加入 PATH）。'}
      </p>
      <div style={{ display: 'grid', gap: 10, marginTop: 14, maxWidth: 560 }}>
        <label className="algo-field">
          <span>服务地址</span>
          <input
            value={form.baseUrl}
            onChange={(e) => patch({ baseUrl: e.target.value })}
            placeholder={DEFAULT_CPP_BASE}
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            首选编译器
          </div>
          <ChipRow
            ariaLabel="首选 C++ 编译器"
            options={PREFERRED}
            value={form.preferredCompiler}
            onChange={(v) => patch({ preferredCompiler: v })}
          />
        </div>
        <label className="algo-field">
          <span>编译器完整路径（可选）</span>
          <input
            value={form.compilerPath}
            onChange={(e) => patch({ compilerPath: e.target.value })}
            placeholder="例如 C:\\mingw64\\bin\\g++.exe"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <label className="algo-field">
          <span>超时（毫秒）</span>
          <input
            type="number"
            min={1000}
            max={120000}
            step={1000}
            value={form.timeoutMs}
            onChange={(e) =>
              patch({ timeoutMs: Number(e.target.value) || DEFAULT_CPP_TIMEOUT_MS })
            }
          />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={onSave}>
            保存
          </Button>
          <Button onClick={onTest} busy={testing}>
            检测编译器
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const next = saveCppSettings({
                baseUrl: DEFAULT_CPP_BASE,
                preferredCompiler: 'auto',
                compilerPath: '',
                timeoutMs: DEFAULT_CPP_TIMEOUT_MS,
              })
              setForm(next)
              setDetails([])
              setStatus('已恢复默认')
            }}
          >
            恢复默认
          </Button>
        </div>
        {status ? (
          <p className="panel__text" style={{ margin: 0 }} role="status">
            {status}
          </p>
        ) : null}
        {details.length > 0 ? (
          <ul className="panel__text" style={{ margin: 0, paddingLeft: 18 }}>
            {details.map((d) => (
              <li key={d.cmd}>
                <code>{d.cmd}</code>
                <span style={{ color: 'var(--text-muted)' }}> — {d.version}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {!electron ? (
          <p className="panel__text" style={{ margin: 0, color: 'var(--text-muted)' }}>
            浏览器模式需自行启动：{' '}
            <code>node server-cpp/index.mjs</code>
          </p>
        ) : null}
      </div>
    </section>
  )
}
