import type { AppData, SalarySummary } from '../types'
import { calcSalary, dateKey, formatDateInput, keyToDate, todayKey } from './utils'

export interface DayStat {
  key: string
  seconds: number
  completed: number
  earnings: number
}

export interface StatsSummary {
  days: DayStat[]
  seconds: number
  completed: number
  gross: number
  net: number
  streak: number
  bestStreak: number
  activeDays: number
  topTags: { tag: string; count: number }[]
  salary: SalarySummary
}

export function computeStats(data: AppData, days: number): StatsSummary {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))

  const range = { start: start.getTime(), end: end.getTime() }
  const salary = calcSalary(data.entries, data.lists, data.settings, range)

  const byDay = new Map<string, DayStat>()
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = dateKey(date)
    byDay.set(key, { key, seconds: 0, completed: 0, earnings: 0 })
  }

  for (const entry of data.entries) {
    if (entry.startedAt < range.start || entry.startedAt > range.end) continue
    const key = formatDateInput(entry.startedAt)
    const bucket = byDay.get(key)
    if (bucket) bucket.seconds += entry.seconds
  }

  for (const bucket of salary.byDay) {
    const day = byDay.get(bucket.key)
    if (day) day.earnings += bucket.amount
  }

  const tagCounts = new Map<string, number>()
  for (const task of data.tasks) {
    if (!task.completed || !task.completedAt) continue
    if (task.completedAt < range.start || task.completedAt > range.end) continue
    const key = formatDateInput(task.completedAt)
    const bucket = byDay.get(key)
    if (bucket) bucket.completed += 1
    for (const tag of task.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  }

  const allDays = [...byDay.values()]

  // Streak: consecutive days with completed tasks or tracked time.
  let streak = 0
  let cursor = keyToDate(todayKey())
  let guard = 0
  while (guard < 3650) {
    const key = dateKey(cursor)
    const day = byDay.get(key)
    const hasActivity = day ? day.completed > 0 || day.seconds > 0 : false
    if (hasActivity) {
      streak += 1
    } else if (streak === 0 && key === todayKey()) {
      // Today may still be in progress — start counting from yesterday.
    } else {
      break
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
    guard += 1
    if (formatDateInput(cursor.getTime()) === '1970-01-01') break
  }

  // Best streak over the last year.
  const activity = new Set<string>()
  for (const entry of data.entries) activity.add(formatDateInput(entry.startedAt))
  for (const task of data.tasks) {
    if (task.completedAt) activity.add(formatDateInput(task.completedAt))
  }
  let bestStreak = 0
  let running = 0
  let bestCursor = keyToDate(todayKey())
  for (let index = 0; index < 365; index += 1) {
    const key = dateKey(bestCursor)
    if (activity.has(key)) {
      running += 1
      bestStreak = Math.max(bestStreak, running)
    } else {
      running = 0
    }
    bestCursor = new Date(bestCursor.getFullYear(), bestCursor.getMonth(), bestCursor.getDate() - 1)
  }

  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return {
    days: allDays,
    seconds: salary.seconds,
    completed: allDays.reduce((sum, day) => sum + day.completed, 0),
    gross: salary.gross,
    net: salary.net,
    streak,
    bestStreak: Math.max(bestStreak, streak),
    activeDays: allDays.filter((day) => day.completed > 0 || day.seconds > 0).length,
    topTags,
    salary,
  }
}
