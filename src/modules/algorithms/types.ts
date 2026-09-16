export type AlgoLanguage = 'javascript' | 'python' | 'cpp'

export interface AlgorithmMeta {
  id: string
  title: string
  description?: string
  language: AlgoLanguage
  category: string
  tags: string[]
  favorite: boolean
  createdAt: number
  updatedAt: number
  lastRunAt?: number
  source: 'builtin' | 'user'
}

export interface AlgorithmFile {
  name: string
  content: string
}

export interface Algorithm extends AlgorithmMeta {
  files: AlgorithmFile[]
  /**
   * 用户原始/编辑中的业务源码（可与可视化代码不同）
   * 缺省时与 files[0] 相同
   */
  sourceCode?: string
  /** 用于执行与可视化的代码（含 tracers） */
  vizCode?: string
  /** 当前编辑器展示哪份 */
  editorMode?: 'source' | 'viz'
}

export function createAlgorithmId(): string {
  return `algo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function primaryCode(algo: Algorithm): string {
  return algo.vizCode ?? algo.files[0]?.content ?? ''
}

export function sourceCodeOf(algo: Algorithm): string {
  return algo.sourceCode ?? algo.files[0]?.content ?? ''
}
