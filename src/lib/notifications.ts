import type { AppData, Payday, Task } from '../types'
import { addDaysKey, formatMoney, keyToDate, todayKey } from './utils'

export type NotificationKind = 'overdue' | 'today' | 'reminder' | 'payday' | 'sync'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  tone: 'info' | 'warning' | 'success' | 'danger'
  taskId?: string
  paydayId?: string
  date?: string
  timestamp: number
}

function taskNotification(task: Task, kind: NotificationKind): AppNotification {
  if (kind === 'overdue') {
    return {
      id: `overdue:${task.id}`,
      kind,
      title: 'Прострочена задача',
      body: task.title,
      tone: 'danger',
      taskId: task.id,
      date: task.dueDate ?? undefined,
      timestamp: task.dueDate ? keyToDate(task.dueDate).getTime() : Date.now(),
    }
  }
  if (kind === 'today') {
    return {
      id: `today:${task.id}`,
      kind,
      title: task.dueTime ? `Сьогодні о ${task.dueTime}` : 'Задача на сьогодні',
      body: task.title,
      tone: 'warning',
      taskId: task.id,
      date: task.dueDate ?? undefined,
      timestamp: Date.now(),
    }
  }
  return {
    id: `reminder:${task.id}`,
    kind: 'reminder',
    title: 'Нагадування',
    body: task.title,
    tone: 'info',
    taskId: task.id,
    timestamp: task.reminderAt ?? Date.now(),
  }
}

export function paydayNotification(payday: Payday, daysLeft: number, currency: string): AppNotification {
  const amount = payday.amount !== null ? ` · ${formatMoney(payday.amount, currency, 0)}` : ''
  return {
    id: `payday:${payday.id}:${daysLeft}`,
    kind: 'payday',
    title:
      daysLeft <= 0
        ? 'Сьогодні зарплатний день'
        : daysLeft === 1
          ? 'Зарплата завтра'
          : `Зарплата через ${daysLeft} дн.`,
    body: `${payday.note || 'Зарплата'}${amount}`,
    tone: 'success',
    paydayId: payday.id,
    date: payday.date,
    timestamp: keyToDate(payday.date).getTime(),
  }
}

export function collectNotifications(data: AppData, now = Date.now()): AppNotification[] {
  const today = todayKey()
  const items: AppNotification[] = []
  const seen = new Set<string>()

  for (const task of data.tasks) {
    if (task.completed) continue
    if (task.dueDate && task.dueDate < today) {
      const item = taskNotification(task, 'overdue')
      if (!seen.has(item.id)) {
        items.push(item)
        seen.add(item.id)
      }
      continue
    }
    if (task.reminderAt && !task.notifiedAt && Math.abs(now - task.reminderAt) < 86_400_000) {
      const item = taskNotification(task, 'reminder')
      if (!seen.has(item.id)) {
        items.push(item)
        seen.add(item.id)
      }
      continue
    }
    if (task.dueDate === today) {
      const item = taskNotification(task, 'today')
      if (!seen.has(item.id)) {
        items.push(item)
        seen.add(item.id)
      }
    }
  }

  for (const payday of data.paydays) {
    const daysLeft = Math.round(
      (keyToDate(payday.date).getTime() - keyToDate(today).getTime()) / 86_400_000,
    )
    if (daysLeft < 0 || daysLeft > data.settings.paydayReminderDays) continue
    const item = paydayNotification(payday, daysLeft, data.settings.currency)
    if (!seen.has(item.id)) {
      items.push(item)
      seen.add(item.id)
    }
  }

  const order: Record<NotificationKind, number> = {
    overdue: 0,
    reminder: 1,
    today: 2,
    payday: 3,
    sync: 4,
  }
  return items.sort((a, b) => order[a.kind] - order[b.kind] || a.timestamp - b.timestamp)
}

export function nextPayday(data: AppData): Payday | null {
  const today = todayKey()
  return (
    [...data.paydays]
      .filter((payday) => payday.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  )
}

export function paydayDaysLeft(payday: Payday): number {
  return Math.round((keyToDate(payday.date).getTime() - keyToDate(todayKey()).getTime()) / 86_400_000)
}

export function upcomingWeekRange(): { start: string; end: string } {
  return { start: todayKey(), end: addDaysKey(todayKey(), 7) }
}
