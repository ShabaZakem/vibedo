import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { StatusBar, Style } from '@capacitor/status-bar'
import type { AppData } from '../types'
import { combineDateTime, formatDateInput, keyToDate } from './utils'

export const isNative = Capacitor.isNativePlatform()

export interface NativeNotificationExtra {
  taskId?: string
  paydayId?: string
  kind?: string
}

export async function initNativeUI(
  onBack: () => boolean,
  onNotification: (extra: NativeNotificationExtra) => void,
): Promise<() => void> {
  if (!isNative) return () => {}
  const back = await NativeApp.addListener('backButton', () => {
    if (!onBack()) void NativeApp.minimizeApp()
  })
  const tap = await LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (event) => {
      const extra = (event.notification.extra ?? {}) as NativeNotificationExtra
      onNotification(extra)
    },
  )
  try {
    await StatusBar.setOverlaysWebView({ overlay: false })
  } catch {
    /* ignore */
  }
  return () => {
    void back.remove()
    void tap.remove()
  }
}

export async function setNativeTheme(dark: boolean): Promise<void> {
  if (!isNative) return
  try {
    await StatusBar.setBackgroundColor({ color: dark ? '#191919' : '#fbfbfa' })
    await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark })
  } catch {
    /* ignore */
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative) {
    if (typeof Notification === 'undefined') return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    return (await Notification.requestPermission()) === 'granted'
  }
  try {
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'granted') return true
    const next = await LocalNotifications.requestPermissions()
    return next.display === 'granted'
  } catch {
    return false
  }
}

function hashId(key: string): number {
  let hash = 2166136261
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (Math.abs(hash) % 2_000_000_000) + 1
}

interface PlannedNotification {
  id: number
  key: string
  title: string
  body: string
  at: Date
  extra: NativeNotificationExtra
}

function atNine(dateKey: string, daysBefore = 0): number {
  const date = keyToDate(dateKey)
  date.setDate(date.getDate() - daysBefore)
  date.setHours(9, 0, 0, 0)
  return date.getTime()
}

export async function scheduleNativeNotifications(data: AppData): Promise<void> {
  if (!isNative || !data.settings.notifications) return
  const granted = await requestNotificationPermission()
  if (!granted) return

  const now = Date.now()
  const planned: PlannedNotification[] = []
  const listNames = new Map<string, string>(
    data.lists.map((list) => [list.id, list.name] as [string, string]),
  )

  for (const task of data.tasks) {
    if (task.completed) continue
    const list = listNames.get(task.listId)
    const body = list ? `${task.title} · ${list}` : task.title
    if (task.reminderAt && !task.notifiedAt && task.reminderAt > now + 60_000) {
      planned.push({
        id: hashId(`task:${task.id}:reminder`),
        key: `task:${task.id}:reminder`,
        title: 'VibeDo · нагадування',
        body,
        at: new Date(task.reminderAt),
        extra: { taskId: task.id, kind: 'reminder' },
      })
      continue
    }
    if (task.dueDate && task.dueTime) {
      const due = combineDateTime(task.dueDate, task.dueTime) - 10 * 60_000
      if (due > now + 60_000) {
        planned.push({
          id: hashId(`task:${task.id}:due`),
          key: `task:${task.id}:due`,
          title: 'Скоро дедлайн',
          body,
          at: new Date(due),
          extra: { taskId: task.id, kind: 'due' },
        })
      }
    }
  }

  for (const payday of data.paydays) {
    if (payday.date < formatDateInput(Date.now())) continue
    const label = payday.note || 'Зарплата'
    if (data.settings.paydayReminderDays > 0) {
      const reminderAt = atNine(payday.date, data.settings.paydayReminderDays)
      if (reminderAt > now + 60_000) {
        planned.push({
          id: hashId(`payday:${payday.id}:before`),
          key: `payday:${payday.id}:before`,
          title: 'Наближається зарплатний день',
          body: `${label} · ${payday.date}`,
          at: new Date(reminderAt),
          extra: { paydayId: payday.id, kind: 'payday' },
        })
      }
    }
    const dayAt = atNine(payday.date)
    if (dayAt > now + 60_000) {
      planned.push({
        id: hashId(`payday:${payday.id}:day`),
        key: `payday:${payday.id}:day`,
        title: 'Сьогодні зарплатний день',
        body: label,
        at: new Date(dayAt),
        extra: { paydayId: payday.id, kind: 'payday' },
      })
    }
  }

  const unique = new Map<number, PlannedNotification>()
  for (const item of planned) {
    let id = item.id
    while (unique.has(id)) id += 1
    unique.set(id, { ...item, id })
  }

  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((item) => ({ id: item.id })),
      })
    }
    await LocalNotifications.createChannel({
      id: 'vibedo',
      name: 'VibeDo',
      description: 'Задачі, нагадування та зарплатні дні',
      importance: 4,
      visibility: 1,
      vibration: true,
    })
    const list = [...unique.values()].slice(0, 60)
    if (list.length === 0) return
    await LocalNotifications.schedule({
      notifications: list.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        schedule: { at: item.at, allowWhileIdle: true },
        channelId: 'vibedo',
        extra: item.extra,
      })),
    })
  } catch (error) {
    console.warn('Не вдалося запланувати сповіщення', error)
  }
}

export async function notifyNow(title: string, body: string): Promise<boolean> {
  if (isNative) {
    const granted = await requestNotificationPermission()
    if (!granted) return false
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: hashId(`${title}:${Date.now()}`),
            title,
            body,
            schedule: { at: new Date(Date.now() + 300) },
            channelId: 'vibedo',
          },
        ],
      })
      return true
    } catch {
      return false
    }
  }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body })
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export async function shareTextFile(
  fileName: string,
  content: string,
): Promise<{ ok: boolean; canceled?: boolean; path?: string }> {
  if (!isNative) return { ok: false }
  try {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    await Share.share({
      title: 'VibeDo · резервна копія',
      text: 'Локальна резервна копія VibeDo',
      url: result.uri,
      dialogTitle: 'Поділитися резервною копією',
    })
    return { ok: true, path: fileName }
  } catch (error) {
    if (String(error).toLowerCase().includes('cancel')) return { ok: false, canceled: true }
    return { ok: false }
  }
}
