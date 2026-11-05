import { create } from 'zustand'
import type { AppData } from '../types'
import { normalizeData, snapshot, useAppStore } from '../store'
import { mergeAppData } from './merge'

export interface SyncConfig {
  enabled: boolean
  auto: boolean
  host: string
  port: number
  pin: string
  token: string
  lastSyncAt: number | null
}

export type SyncPhase = 'idle' | 'syncing' | 'ok' | 'error' | 'offline'

interface SyncStatusStore {
  phase: SyncPhase
  message: string
  lastSyncAt: number | null
  set: (patch: Partial<Omit<SyncStatusStore, 'set'>>) => void
}

export const useSyncStatus = create<SyncStatusStore>((set) => ({
  phase: 'idle',
  message: '',
  lastSyncAt: null,
  set: (patch) => set(patch),
}))

const KEY = 'vibedo-sync-v1'
export const DEFAULT_SYNC_PORT = 47823

const DEFAULTS: SyncConfig = {
  enabled: false,
  auto: true,
  host: '',
  port: DEFAULT_SYNC_PORT,
  pin: '',
  token: '',
  lastSyncAt: null,
}

export function isNativeMobile(): boolean {
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return Boolean(capacitor?.isNativePlatform?.())
}

export function makePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS, pin: makePin() }
    const parsed = JSON.parse(raw) as Partial<SyncConfig>
    return {
      ...DEFAULTS,
      ...parsed,
      port: Number(parsed.port) || DEFAULT_SYNC_PORT,
      pin: /^\d{4,8}$/.test(String(parsed.pin ?? '')) ? String(parsed.pin) : makePin(),
    }
  } catch {
    return { ...DEFAULTS, pin: makePin() }
  }
}

export function saveSyncConfig(patch: Partial<SyncConfig>): SyncConfig {
  const next = { ...loadSyncConfig(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export interface DesktopSyncState {
  running: boolean
  port: number
  addresses: string[]
  clients: number
  lastSyncAt: number | null
  error?: string
}

export async function startDesktopServer(pin: string, port = DEFAULT_SYNC_PORT): Promise<DesktopSyncState> {
  const api = window.desktop
  if (!api?.syncStart) {
    return { running: false, port, addresses: [], clients: 0, lastSyncAt: null, error: 'Лише для десктопу' }
  }
  return api.syncStart({ pin, port })
}

export async function stopDesktopServer(): Promise<void> {
  await window.desktop?.syncStop?.()
}

export async function getDesktopSyncState(): Promise<DesktopSyncState> {
  const api = window.desktop
  if (!api?.syncStatus) {
    return { running: false, port: DEFAULT_SYNC_PORT, addresses: [], clients: 0, lastSyncAt: null }
  }
  return api.syncStatus()
}

async function request<T>(
  url: string,
  options: RequestInit = {},
  timeout = 8000,
): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const text = await response.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    if (!response.ok) {
      const message =
        body && typeof body === 'object' && 'error' in body
          ? String((body as { error: unknown }).error)
          : `HTTP ${response.status}`
      throw new Error(message)
    }
    return body as T
  } finally {
    window.clearTimeout(timer)
  }
}

function baseUrl(config: SyncConfig): string {
  const host = config.host.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return `http://${host}:${config.port}`
}

export async function pairDevice(config: SyncConfig): Promise<string> {
  const result = await request<{ ok: boolean; token?: string; error?: string }>(
    `${baseUrl(config)}/api/pair`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: config.pin }),
    },
    7000,
  )
  if (!result.ok || !result.token) throw new Error(result.error || 'Невірний PIN')
  return result.token
}

export async function syncNow(): Promise<boolean> {
  const config = loadSyncConfig()
  if (!config.host) {
    useSyncStatus.getState().set({ phase: 'idle', message: 'Вкажіть адресу комп’ютера' })
    return false
  }
  useSyncStatus.getState().set({ phase: 'syncing', message: 'Синхронізація…' })

  let token = config.token
  try {
    if (!token) {
      token = await pairDevice(config)
      saveSyncConfig({ token })
    }

    const local = snapshot(useAppStore.getState())
    let merged: AppData
    try {
      merged = await request<AppData>(`${baseUrl(config)}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(local),
      })
    } catch (error) {
      if (!String(error).includes('401') && !String(error).includes('Сесія')) throw error
      token = await pairDevice(config)
      saveSyncConfig({ token })
      merged = await request<AppData>(`${baseUrl(config)}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(local),
      })
    }

    const data = normalizeData(merged)
    useAppStore.getState().replaceData(data)
    const now = Date.now()
    saveSyncConfig({ lastSyncAt: now, enabled: true })
    useSyncStatus.getState().set({ phase: 'ok', message: 'Синхронізовано', lastSyncAt: now })
    return true
  } catch (error) {
    const message = String(error)
    const offline = message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('aborted')
    useSyncStatus.getState().set({
      phase: offline ? 'offline' : 'error',
      message: offline ? 'Комп’ютер недоступний у цій мережі' : humanizeSyncError(message),
    })
    return false
  }
}

export function humanizeSyncError(message: string): string {
  if (message.includes('PIN') || message.includes('401')) return 'Невірний PIN або сесія застаріла'
  if (message.includes('aborted')) return 'Комп’ютер не відповідає'
  return 'Не вдалося синхронізувати дані'
}

let autoStarted = false

export function startAutoSync(): () => void {
  if (autoStarted) return () => {}
  autoStarted = true
  const attempt = () => {
    const config = loadSyncConfig()
    if (config.auto && config.host && config.pin) void syncNow()
  }
  const initial = window.setTimeout(attempt, 2500)
  const timer = window.setInterval(attempt, 60_000)
  const onFocus = () => {
    const config = loadSyncConfig()
    if (config.auto && config.host && Date.now() - (config.lastSyncAt ?? 0) > 30_000) attempt()
  }
  window.addEventListener('focus', onFocus)
  return () => {
    autoStarted = false
    window.clearTimeout(initial)
    window.clearInterval(timer)
    window.removeEventListener('focus', onFocus)
  }
}

export function subscribeDesktopSync(handler: (data: unknown) => void): () => void {
  return window.desktop?.onSyncUpdated?.(handler) ?? (() => {})
}

export function applyIncomingSync(data: unknown): void {
  const merged = mergeAppData(snapshot(useAppStore.getState()), normalizeData(data))
  useAppStore.getState().replaceData(merged)
}
