import type { AppData } from '../types'
import { isNative, shareTextFile } from './native'

const LOCAL_KEY = 'vibedo-data-v1'

function desktop() {
  return typeof window !== 'undefined' ? window.desktop : undefined
}

export async function loadAppData(): Promise<unknown | null> {
  const api = desktop()
  if (api) {
    try {
      const data = await api.load()
      if (data) return data
    } catch (error) {
      console.error('Не вдалося прочитати дані з диска', error)
    }
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function saveAppData(
  data: AppData,
): Promise<{ ok: boolean; error?: string; path?: string; savedAt?: number }> {
  const api = desktop()
  if (api) {
    try {
      return await api.save(data)
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  }
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
    return { ok: true, savedAt: Date.now() }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportAppData(data: AppData): Promise<{ ok: boolean; canceled?: boolean; path?: string }> {
  const api = desktop()
  if (api) return api.exportData(data)
  const stamp = new Date().toISOString().slice(0, 10)
  if (isNative) {
    return shareTextFile(`vibedo-backup-${stamp}.json`, JSON.stringify(data, null, 2))
  }
  downloadFile(`vibedo-backup-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json')
  return { ok: true }
}

export async function importAppData(): Promise<{
  ok: boolean
  canceled?: boolean
  data?: unknown
  error?: string
}> {
  const api = desktop()
  if (api) return api.importData()
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve({ ok: false, canceled: true })
      try {
        resolve({ ok: true, data: JSON.parse(await file.text()) })
      } catch (error) {
        resolve({ ok: false, error: String(error) })
      }
    }
    input.click()
  })
}

export async function saveTextFile(
  defaultName: string,
  content: string,
  filters?: { name: string; extensions: string[] }[],
): Promise<{ ok: boolean; canceled?: boolean; path?: string }> {
  const api = desktop()
  if (api) return api.saveText({ defaultName, content, filters })
  if (isNative) return shareTextFile(defaultName, content)
  downloadFile(defaultName, content, 'text/plain;charset=utf-8')
  return { ok: true }
}

export async function getAppInfo(): Promise<{ version: string; dataPath: string; platform: string }> {
  const api = desktop()
  if (api) return api.info()
  return {
    version: '1.0.2',
    dataPath: isNative ? 'локальне сховище застосунку' : 'localStorage браузера',
    platform: isNative ? 'Android' : navigator.platform,
  }
}

export async function openDataFolder(): Promise<{ ok: boolean; error?: string }> {
  const api = desktop()
  if (!api) return { ok: false, error: 'Доступно лише в десктопній версії' }
  return api.openDataFolder()
}

export function isDesktopApp(): boolean {
  return Boolean(desktop()?.isDesktop)
}
