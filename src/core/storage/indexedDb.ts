import type { Tutorial, TutorialNote } from '@/modules/tutorials/types'
import type { Algorithm } from '@/modules/algorithms/types'

const DB_NAME = 'worktable'
const DB_VERSION = 2

export const STORE = {
  tutorials: 'tutorials',
  tutorialNotes: 'tutorialNotes',
  algorithms: 'algorithms',
  kv: 'kv',
} as const

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE.tutorials)) {
        const s = db.createObjectStore(STORE.tutorials, { keyPath: 'id' })
        s.createIndex('updatedAt', 'updatedAt')
      }
      if (!db.objectStoreNames.contains(STORE.tutorialNotes)) {
        const s = db.createObjectStore(STORE.tutorialNotes, { keyPath: 'id' })
        s.createIndex('tutorialId', 'tutorialId')
        s.createIndex('updatedAt', 'updatedAt')
      }
      if (!db.objectStoreNames.contains(STORE.algorithms)) {
        const s = db.createObjectStore(STORE.algorithms, { keyPath: 'id' })
        s.createIndex('category', 'category')
        s.createIndex('updatedAt', 'updatedAt')
        s.createIndex('favorite', 'favorite')
      }
      if (!db.objectStoreNames.contains(STORE.kv)) {
        db.createObjectStore(STORE.kv, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
        t.onerror = () => {
          db.close()
          reject(t.error)
        }
      }),
  )
}

export async function saveTutorial(tutorial: Tutorial): Promise<void> {
  await tx(STORE.tutorials, 'readwrite', (s) => s.put(tutorial) as IDBRequest<IDBValidKey>)
}

export async function listTutorials(): Promise<Tutorial[]> {
  const all = await tx<Tutorial[]>(STORE.tutorials, 'readonly', (s) => s.getAll() as IDBRequest<Tutorial[]>)
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getTutorial(id: string): Promise<Tutorial | undefined> {
  return tx<Tutorial | undefined>(STORE.tutorials, 'readonly', (s) => s.get(id) as IDBRequest<Tutorial | undefined>)
}

export async function saveNote(note: TutorialNote): Promise<void> {
  await tx(STORE.tutorialNotes, 'readwrite', (s) => s.put(note) as IDBRequest<IDBValidKey>)
}

export async function getNote(id: string): Promise<TutorialNote | undefined> {
  return tx<TutorialNote | undefined>(
    STORE.tutorialNotes,
    'readonly',
    (s) => s.get(id) as IDBRequest<TutorialNote | undefined>,
  )
}

export async function listNotes(tutorialId: string): Promise<TutorialNote[]> {
  const all = await tx<TutorialNote[]>(STORE.tutorialNotes, 'readonly', (s) => s.getAll() as IDBRequest<TutorialNote[]>)
  return all.filter((n) => n.tutorialId === tutorialId)
}

export async function updateTutorialProgress(
  tutorialId: string,
  lastStep: number,
): Promise<void> {
  const t = await getTutorial(tutorialId)
  if (!t) return
  const completed = new Set(t.progress?.completedSteps ?? [])
  if (lastStep > 0) {
    for (let i = 0; i < lastStep; i++) completed.add(i)
  }
  const next: Tutorial = {
    ...t,
    updatedAt: Date.now(),
    progress: {
      lastStep,
      completedSteps: [...completed].sort((a, b) => a - b),
    },
  }
  await saveTutorial(next)
}

/* —— Algorithms —— */

export async function saveAlgorithm(algo: Algorithm): Promise<void> {
  await tx(STORE.algorithms, 'readwrite', (s) => s.put(algo) as IDBRequest<IDBValidKey>)
}

export async function getAlgorithm(id: string): Promise<Algorithm | undefined> {
  return tx<Algorithm | undefined>(
    STORE.algorithms,
    'readonly',
    (s) => s.get(id) as IDBRequest<Algorithm | undefined>,
  )
}

export async function listAlgorithms(): Promise<Algorithm[]> {
  const all = await tx<Algorithm[]>(STORE.algorithms, 'readonly', (s) => s.getAll() as IDBRequest<Algorithm[]>)
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteAlgorithm(id: string): Promise<void> {
  await tx(STORE.algorithms, 'readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>)
}

/* —— 通用 KV（供新闻缓存等按 key 存取） —— */

interface KvRecord<T> {
  key: string
  value: T
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await tx(STORE.kv, 'readwrite', (s) => s.put({ key, value } as KvRecord<T>) as IDBRequest<IDBValidKey>)
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const rec = await tx<KvRecord<T> | undefined>(
    STORE.kv,
    'readonly',
    (s) => s.get(key) as IDBRequest<KvRecord<T> | undefined>,
  )
  return rec?.value
}

export async function kvDelete(key: string): Promise<void> {
  await tx(STORE.kv, 'readwrite', (s) => s.delete(key) as unknown as IDBRequest<undefined>)
}

export async function bulkPutAlgorithms(algos: Algorithm[]): Promise<void> {
  if (algos.length === 0) return
  await openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction(STORE.algorithms, 'readwrite')
        const s = t.objectStore(STORE.algorithms)
        for (const a of algos) s.put(a)
        t.oncomplete = () => {
          db.close()
          resolve()
        }
        t.onerror = () => {
          db.close()
          reject(t.error)
        }
      }),
  )
}
