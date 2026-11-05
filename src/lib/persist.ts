import { create } from 'zustand'
import type { AppData } from '../types'
import { snapshot, useAppStore } from '../store'
import { saveAppData } from './storage'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SaveStatusStore {
  status: SaveState
  lastSavedAt: number | null
  error: string | null
}

export const useSaveStatus = create<SaveStatusStore>(() => ({
  status: 'idle',
  lastSavedAt: null,
  error: null,
}))

let started = false
let timer: number | undefined
let pending: AppData | null = null
let lastFingerprint = ''

function fingerprint(data: AppData): string {
  return JSON.stringify({ ...data, updatedAt: 0 })
}

async function flush(): Promise<void> {
  const data = pending
  if (!data) return
  pending = null
  const result = await saveAppData(data)
  if (result.ok) {
    useSaveStatus.setState({
      status: 'saved',
      lastSavedAt: result.savedAt ?? Date.now(),
      error: null,
    })
  } else {
    useSaveStatus.setState({
      status: 'error',
      error: result.error ?? 'Не вдалося зберегти дані',
    })
  }
}

function scheduleSave(data: AppData): void {
  pending = data
  useSaveStatus.setState({ status: 'saving', error: null })
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    void flush()
  }, 400)
}

export function setupPersistence(): void {
  if (started) return
  started = true

  const initial = snapshot(useAppStore.getState())
  lastFingerprint = fingerprint(initial)
  useSaveStatus.setState({ status: 'saved', lastSavedAt: Date.now() })
  scheduleSave(initial)

  useAppStore.subscribe((state) => {
    if (!state.hydrated) return
    const data = snapshot(state)
    const nextFingerprint = fingerprint(data)
    if (nextFingerprint === lastFingerprint) return
    lastFingerprint = nextFingerprint
    scheduleSave(data)
  })

  window.addEventListener('beforeunload', () => {
    if (pending) void saveAppData(pending)
  })
}

export async function saveNow(): Promise<void> {
  const data = snapshot(useAppStore.getState())
  pending = data
  lastFingerprint = fingerprint(data)
  await flush()
}
