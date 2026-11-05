/// <reference types="vite/client" />

import type { AppData } from './types'

export interface DesktopSyncState {
  running: boolean
  port: number
  addresses: string[]
  clients: number
  lastSyncAt: number | null
  error?: string
}

interface DesktopApi {
  isDesktop: boolean
  load: () => Promise<unknown | null>
  save: (data: AppData) => Promise<{ ok: boolean; error?: string; path?: string; savedAt?: number }>
  exportData: (data: AppData) => Promise<{ ok: boolean; canceled?: boolean; error?: string; path?: string }>
  importData: () => Promise<{ ok: boolean; canceled?: boolean; error?: string; data?: unknown; path?: string }>
  saveText: (payload: {
    defaultName: string
    content: string
    filters?: { name: string; extensions: string[] }[]
  }) => Promise<{ ok: boolean; canceled?: boolean; error?: string; path?: string }>
  info: () => Promise<{ version: string; dataPath: string; platform: string }>
  openDataFolder: () => Promise<{ ok: boolean; error?: string }>
  setTheme: (theme: 'light' | 'dark') => Promise<{ ok: boolean }>
  focusWindow: () => Promise<{ ok: boolean }>
  syncStart: (payload: { pin: string; port: number }) => Promise<DesktopSyncState>
  syncStop: () => Promise<DesktopSyncState>
  syncStatus: () => Promise<DesktopSyncState>
  onSyncUpdated: (handler: (data: unknown) => void) => () => void
  onSyncRequest: (handler: () => void) => () => void
  sendSnapshot: (data: AppData) => void
}

declare global {
  interface Window {
    desktop?: DesktopApi
  }
}

export {}
