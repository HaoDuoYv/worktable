import { listAlgorithms, listNotes, listTutorials, saveNote, saveTutorial, bulkPutAlgorithms } from '@/core/storage/indexedDb'
import type { Tutorial, TutorialNote } from '@/modules/tutorials/types'
import type { Algorithm } from '@/modules/algorithms/types'
import {
  downloadSnapshot,
  deviceLabel,
  getSyncMeta,
  uploadSnapshot,
  withAuth,
  type AuthSession,
} from '@/modules/auth/api'

export const SYNC_SCHEMA = 1

export interface SyncPayload {
  schemaVersion: number
  tutorials: Tutorial[]
  tutorialNotes: TutorialNote[]
  algorithms: Algorithm[]
  chatSessions: unknown[]
  preferences: Record<string, unknown>
  exportedAt: number
}

function loadPreferences(): Record<string, unknown> {
  const keys = ['worktable.theme']
  const prefs: Record<string, unknown> = {}
  for (const k of keys) {
    try {
      const v = localStorage.getItem(k)
      if (v != null) prefs[k] = v
    } catch {
      /* ignore */
    }
  }
  return prefs
}

function applyPreferences(prefs: Record<string, unknown>) {
  for (const [k, v] of Object.entries(prefs || {})) {
    try {
      localStorage.setItem(k, String(v))
    } catch {
      /* ignore */
    }
  }
}

function loadChatSessions(): unknown[] {
  try {
    return JSON.parse(localStorage.getItem('worktable.chat.sessions') || '[]')
  } catch {
    return []
  }
}

function saveChatSessions(list: unknown[]) {
  localStorage.setItem('worktable.chat.sessions', JSON.stringify(list))
}

/** Collect local data into a sync snapshot (no secrets). */
export async function buildLocalSnapshot(): Promise<SyncPayload> {
  const [tutorials, algorithms] = await Promise.all([listTutorials(), listAlgorithms()])
  const allNotes: TutorialNote[] = []
  for (const t of tutorials) {
    const ns = await listNotes(t.id)
    allNotes.push(...ns)
  }

  return {
    schemaVersion: SYNC_SCHEMA,
    tutorials,
    tutorialNotes: allNotes,
    algorithms,
    chatSessions: loadChatSessions(),
    preferences: loadPreferences(),
    exportedAt: Date.now(),
  }
}

/** Replace local stores from cloud snapshot. */
export async function applySnapshot(payload: SyncPayload): Promise<void> {
  if (!payload || typeof payload !== 'object') {
    throw new Error('快照无效')
  }
  const tutorials = Array.isArray(payload.tutorials) ? payload.tutorials : []
  const notes = Array.isArray(payload.tutorialNotes) ? payload.tutorialNotes : []
  const algorithms = Array.isArray(payload.algorithms) ? payload.algorithms : []

  for (const t of tutorials) {
    if (t?.id) await saveTutorial(t)
  }
  for (const n of notes) {
    if (n?.id) await saveNote(n)
  }
  if (algorithms.length) {
    await bulkPutAlgorithms(algorithms.filter((a) => a?.id))
  }
  if (Array.isArray(payload.chatSessions)) {
    saveChatSessions(payload.chatSessions)
  }
  applyPreferences(payload.preferences || {})
}

export async function pushToCloud(onSession?: (s: AuthSession) => void) {
  const snapshot = await buildLocalSnapshot()
  return withAuth(
    (token) => uploadSnapshot(token, snapshot as unknown as Record<string, unknown>, deviceLabel()),
    onSession,
  )
}

export async function pullFromCloud(onSession?: (s: AuthSession) => void) {
  const snap = await withAuth((token) => downloadSnapshot(token), onSession)
  await applySnapshot(snap.payload as unknown as SyncPayload)
  return snap
}

export async function cloudMeta(onSession?: (s: AuthSession) => void) {
  return withAuth((token) => getSyncMeta(token), onSession)
}
