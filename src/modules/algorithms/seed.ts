import type { Algorithm } from '@/modules/algorithms/types'
import { BUILTIN_ALGORITHMS } from './builtin'
import { listAlgorithms, saveAlgorithm } from '@/core/storage/indexedDb'

export function builtinToAlgorithm(
  b: (typeof BUILTIN_ALGORITHMS)[number],
  overrides?: Partial<Algorithm>,
): Algorithm {
  const now = Date.now()
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    language: b.language,
    category: b.category,
    tags: [...b.tags],
    favorite: false,
    createdAt: now,
    updatedAt: now,
    source: 'builtin',
    files: [{ name: `${b.id}.js`, content: b.code }],
    // 内置示例：源码与可视化代码同一份，delay 行号对齐本文件
    sourceCode: b.code,
    vizCode: b.code,
    editorMode: 'viz',
    ...overrides,
  }
}

/** Ensure built-in algorithms exist in IndexedDB (idempotent). */
export async function seedBuiltinAlgorithms(): Promise<Algorithm[]> {
  const existing = await listAlgorithms()
  const ids = new Set(existing.map((a) => a.id))
  const missing = BUILTIN_ALGORITHMS.filter((b) => !ids.has(b.id)).map((b) =>
    builtinToAlgorithm(b),
  )
  for (const m of missing) {
    await saveAlgorithm(m)
  }
  return listAlgorithms()
}
