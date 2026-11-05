import { clsx, type ClassValue } from 'clsx'
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isWeekend,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { uk } from 'date-fns/locale'
import { REPEAT_LABELS } from '../constants'
import type {
  RepeatRule,
  SalaryBucket,
  SalarySummary,
  Settings,
  Task,
  TaskList,
  TimeEntry,
} from '../types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function uid(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}${Date.now().toString(36)}${random}`
}

export function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function todayKey(): string {
  return dateKey(new Date())
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDaysKey(key: string, days: number): string {
  return dateKey(addDays(keyToDate(key), days))
}

export function isTodayKey(key: string | null): boolean {
  return key === todayKey()
}

export function formatDayLabel(key: string): string {
  const today = todayKey()
  if (key === today) return 'Сьогодні'
  if (key === addDaysKey(today, 1)) return 'Завтра'
  if (key === addDaysKey(today, -1)) return 'Вчора'
  const date = keyToDate(key)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return format(date, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: uk })
}

export function formatDueLabel(dueDate: string | null, dueTime: string | null): string {
  if (!dueDate) return ''
  const base = formatDayLabel(dueDate)
  return dueTime ? `${base}, ${dueTime}` : base
}

export function formatLongDate(date: Date): string {
  return format(date, 'd MMMM yyyy, EEEE', { locale: uk })
}

export function formatMonth(date: Date): string {
  return format(date, 'LLLL yyyy', { locale: uk })
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h === 0 && m === 0) return `${total} с`
  if (h === 0) return `${m} хв`
  if (m === 0) return `${h} год`
  return `${h} год ${m} хв`
}

export function formatDurationShort(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatHours(seconds: number, digits = 1): string {
  return (seconds / 3600).toFixed(digits).replace('.', ',')
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0)
}

export function formatMoney(value: number, currency: string, digits = 2): string {
  return `${formatNumber(value, digits)}\u00A0${currency}`
}

export function pluralizeUk(count: number, forms: [string, string, string]): string {
  const n = Math.abs(count) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return forms[2]
  if (n1 > 1 && n1 < 5) return forms[1]
  if (n1 === 1) return forms[0]
  return forms[2]
}

export function listRate(list: TaskList | undefined, settings: Settings): number {
  if (list && list.hourlyRate !== null && !Number.isNaN(list.hourlyRate)) return list.hourlyRate
  return settings.hourlyRate
}

export function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.completed) return false
  return task.dueDate < todayKey()
}

export function dueLabelTone(task: Task): 'overdue' | 'today' | 'soon' | 'normal' {
  if (!task.dueDate) return 'normal'
  if (isOverdue(task)) return 'overdue'
  if (task.dueDate === todayKey()) return 'today'
  if (task.dueDate <= addDaysKey(todayKey(), 2)) return 'soon'
  return 'normal'
}

export type Period = 'today' | 'week' | 'month' | 'all' | 'custom'

export interface DateRange {
  start: number
  end: number
}

export function rangeFor(period: Exclude<Period, 'custom'>, anchor = new Date()): DateRange {
  if (period === 'today') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
    return { start: start.getTime(), end: addDays(start, 1).getTime() }
  }
  if (period === 'week') {
    const start = startOfWeek(anchor, { weekStartsOn: 1 })
    return { start: start.getTime(), end: addDays(start, 7).getTime() }
  }
  if (period === 'month') {
    const start = startOfMonth(anchor)
    return { start: start.getTime(), end: addDays(endOfMonth(anchor), 1).getTime() }
  }
  return { start: 0, end: Date.now() + 86_400_000 }
}

export interface EntryAmount {
  amount: number
  regularSeconds: number
  overtimeSeconds: number
  rate: number
}

function dayAmounts(
  dayEntries: TimeEntry[],
  lists: TaskList[],
  settings: Settings,
): Map<string, EntryAmount> {
  const listMap = new Map(lists.map((list) => [list.id, list]))
  const result = new Map<string, EntryAmount>()
  let hoursUsed = 0

  for (const entry of [...dayEntries].sort((a, b) => a.startedAt - b.startedAt)) {
    const rate = listRate(listMap.get(entry.listId), settings)
    const hours = entry.seconds / 3600
    let regularHours = hours
    let overHours = 0

    if (settings.overtimeEnabled && settings.dailyNormHours > 0) {
      const remaining = Math.max(0, settings.dailyNormHours - hoursUsed)
      regularHours = Math.min(hours, remaining)
      overHours = Math.max(0, hours - regularHours)
      hoursUsed += hours
    }

    result.set(entry.id, {
      amount:
        regularHours * rate +
        overHours * rate * Math.max(1, settings.overtimeMultiplier),
      regularSeconds: Math.round(regularHours * 3600),
      overtimeSeconds: Math.round(overHours * 3600),
      rate,
    })
  }
  return result
}

export function calcSalary(
  entries: TimeEntry[],
  lists: TaskList[],
  settings: Settings,
  range: DateRange,
): SalarySummary {
  const filtered = entries
    .filter((entry) => entry.startedAt >= range.start && entry.startedAt < range.end)
    .sort((a, b) => a.startedAt - b.startedAt)

  const dayMap = new Map<string, TimeEntry[]>()
  for (const entry of filtered) {
    const key = dateKey(new Date(entry.startedAt))
    const bucket = dayMap.get(key)
    if (bucket) bucket.push(entry)
    else dayMap.set(key, [entry])
  }

  const byDay: SalaryBucket[] = []
  const listTotals = new Map<string, SalaryBucket>()

  let gross = 0
  let regularSeconds = 0
  let overtimeSeconds = 0

  for (const [day, dayEntries] of [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const amounts = dayAmounts(dayEntries, lists, settings)
    let dayAmount = 0
    let daySeconds = 0
    let dayOver = 0

    for (const entry of dayEntries) {
      const info = amounts.get(entry.id)
      if (!info) continue
      gross += info.amount
      dayAmount += info.amount
      daySeconds += entry.seconds
      regularSeconds += info.regularSeconds
      overtimeSeconds += info.overtimeSeconds
      dayOver += info.overtimeSeconds

      const existing = listTotals.get(entry.listId) ?? {
        key: entry.listId,
        seconds: 0,
        amount: 0,
        overtimeSeconds: 0,
      }
      existing.seconds += entry.seconds
      existing.amount += info.amount
      existing.overtimeSeconds += info.overtimeSeconds
      listTotals.set(entry.listId, existing)
    }

    byDay.push({
      key: day,
      seconds: daySeconds,
      amount: dayAmount,
      overtimeSeconds: dayOver,
    })
  }

  const taxPercent = Math.max(0, Math.min(100, settings.taxPercent))
  const taxes = (gross * taxPercent) / 100
  const net = gross - taxes

  const byList = [...listTotals.values()].sort((a, b) => b.amount - a.amount)

  return {
    gross,
    net,
    taxes,
    seconds: filtered.reduce((sum, entry) => sum + entry.seconds, 0),
    regularSeconds,
    overtimeSeconds,
    byDay,
    byList,
    entries: filtered,
  }
}

export function amountForEntry(
  entry: TimeEntry,
  entries: TimeEntry[],
  lists: TaskList[],
  settings: Settings,
): EntryAmount {
  const day = dateKey(new Date(entry.startedAt))
  const dayEntries = entries.filter((item) => dateKey(new Date(item.startedAt)) === day)
  return (
    dayAmounts(dayEntries, lists, settings).get(entry.id) ?? {
      amount: 0,
      regularSeconds: 0,
      overtimeSeconds: 0,
      rate: 0,
    }
  )
}

export function formatWeekRange(anchor = new Date()): string {
  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  const end = addDays(start, 6)
  return `${format(start, 'd MMM', { locale: uk })} — ${format(end, 'd MMM yyyy', { locale: uk })}`
}

export function formatDateInput(ms: number): string {
  return format(new Date(ms), 'yyyy-MM-dd')
}

export function formatTimeInput(ms: number): string {
  return format(new Date(ms), 'HH:mm')
}

export function combineDateTime(date: string, time: string): number {
  return new Date(`${date}T${time || '00:00'}:00`).getTime()
}

export function relativeDayLabel(ts: number): string {
  const diff = differenceInCalendarDays(new Date(), new Date(ts))
  if (diff === 0) return 'Сьогодні'
  if (diff === 1) return 'Вчора'
  return format(new Date(ts), 'd MMM', { locale: uk })
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/* ---------------- repeating tasks ---------------- */

export function advanceRepeatDate(baseKey: string, rule: RepeatRule): string {
  const interval = Math.max(1, Math.round(rule.interval || 1))
  const base = keyToDate(baseKey)
  if (rule.freq === 'daily') return dateKey(addDays(base, interval))
  if (rule.freq === 'weekdays') {
    let cursor = addDays(base, 1)
    while (isWeekend(cursor)) cursor = addDays(cursor, 1)
    return dateKey(cursor)
  }
  if (rule.freq === 'weekly') return dateKey(addWeeks(base, interval))
  if (rule.freq === 'monthly') return dateKey(addMonths(base, interval))
  return dateKey(addYears(base, interval))
}

export function nextRepeatKey(task: Task): string {
  const today = todayKey()
  let base = task.dueDate ?? today
  if (base < today) base = today
  return advanceRepeatDate(base, task.repeat ?? { freq: 'daily', interval: 1 })
}

export function repeatLabel(rule: RepeatRule | null): string {
  if (!rule) return ''
  const base = REPEAT_LABELS[rule.freq] ?? 'Повтор'
  if (rule.freq === 'weekdays' || rule.interval <= 1) return base
  return `${base} · кожні ${rule.interval}`
}

/* ---------------- calendar ---------------- */

export function monthMatrix(anchor: Date): string[] {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
  return Array.from({ length: 42 }, (_, index) => dateKey(addDays(start, index)))
}

export function isWeekendKey(key: string): boolean {
  return isWeekend(keyToDate(key))
}

export function daysInRange(start: number, end: number): number {
  return Math.max(1, differenceInCalendarDays(new Date(end), new Date(start)))
}

/* ---------------- quick add parser ---------------- */

export interface QuickAddResult {
  title: string
  dueDate: string | null
  dueTime: string | null
  repeat: RepeatRule | null
  tags: string[]
}

const WEEKDAY_WORDS: { re: RegExp; day: number; repeat?: boolean }[] = [
  { re: /щопонеділка|по понеділках/giu, day: 1, repeat: true },
  { re: /щовівторка|по вівторках/giu, day: 2, repeat: true },
  { re: /щосереди|по середах/giu, day: 3, repeat: true },
  { re: /щочетверга|по четвергах/giu, day: 4, repeat: true },
  { re: /щоп['’]?ятниці|по п['’]?ятницях/giu, day: 5, repeat: true },
  { re: /щосуботи|по суботах/giu, day: 6, repeat: true },
  { re: /щонеділі|по неділях/giu, day: 0, repeat: true },
  { re: /понеділок/giu, day: 1 },
  { re: /вівторок/giu, day: 2 },
  { re: /середу|середа/giu, day: 3 },
  { re: /четвер/giu, day: 4 },
  { re: /п['’]?ятницю|п['’]?ятниця/giu, day: 5 },
  { re: /суботу|субота/giu, day: 6 },
  { re: /неділю|неділя/giu, day: 0 },
]

function nextWeekdayKey(day: number): string {
  const today = keyToDate(todayKey())
  const current = today.getDay()
  let delta = (day - current + 7) % 7
  if (delta === 0) delta = 0
  return dateKey(addDays(today, delta))
}

const DANGLING_PREPOSITION =
  /(?:^|\s)(?:у|в|о|об|на|до|з|із|зі|за|для|під|над|про|по|та|і|й)$/iu

function cleanTitle(value: string): string {
  let result = value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s,.;:–—-]+|[\s,.;:–—-]+$/g, '')
    .trim()
  // A date/time phrase often leaves a dangling preposition ("Зустріч у середу").
  for (let i = 0; i < 3 && DANGLING_PREPOSITION.test(result); i += 1) {
    result = result.replace(DANGLING_PREPOSITION, '').trim()
  }
  return result
}

export function parseQuickAdd(raw: string): QuickAddResult {
  let text = ` ${raw} `
  let dueDate: string | null = null
  let dueTime: string | null = null
  let repeat: RepeatRule | null = null
  const tags: string[] = []

  text = text.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_match, space: string, tag: string) => {
    const value = tag.trim()
    if (value && !tags.some((item) => item.toLowerCase() === value.toLowerCase())) tags.push(value)
    return space
  })

  const take = (re: RegExp, handler: (match: RegExpMatchArray) => void) => {
    text = text.replace(re, (...args) => {
      const match = args.slice(0, -2) as unknown as RegExpMatchArray
      handler(match)
      return ' '
    })
  }

  // JS \b only understands ASCII, so Cyrillic words need explicit Unicode
  // lookarounds instead of \b.
  take(/(?<![\p{L}\p{N}])щодня(?![\p{L}\p{N}])/giu, () => {
    repeat = { freq: 'daily', interval: 1 }
  })
  take(/(?<![\p{L}\p{N}])по буднях(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])щобудня(?![\p{L}\p{N}])/giu, () => {
    repeat = { freq: 'weekdays', interval: 1 }
  })
  take(/(?<![\p{L}\p{N}])щотижня(?![\p{L}\p{N}])/giu, () => {
    repeat = { freq: 'weekly', interval: 1 }
  })
  take(/(?<![\p{L}\p{N}])щомісяця(?![\p{L}\p{N}])/giu, () => {
    repeat = { freq: 'monthly', interval: 1 }
  })
  take(/(?<![\p{L}\p{N}])щороку(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])щорічно(?![\p{L}\p{N}])/giu, () => {
    repeat = { freq: 'yearly', interval: 1 }
  })

  for (const weekday of WEEKDAY_WORDS) {
    const bounded = new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${weekday.re.source})(?![\\p{L}\\p{N}])`,
      weekday.re.flags,
    )
    take(bounded, () => {
      if (!dueDate) dueDate = nextWeekdayKey(weekday.day)
      if (weekday.repeat) repeat = { freq: 'weekly', interval: 1 }
    })
  }

  take(/(?<![\p{L}\p{N}])післязавтра(?![\p{L}\p{N}])/giu, () => {
    dueDate = addDaysKey(todayKey(), 2)
  })
  take(/(?<![\p{L}\p{N}])завтра(?![\p{L}\p{N}])/giu, () => {
    dueDate = addDaysKey(todayKey(), 1)
  })
  take(/(?<![\p{L}\p{N}])сьогодні(?![\p{L}\p{N}])/giu, () => {
    dueDate = todayKey()
  })

  take(/(?<![\p{L}\p{N}])через\s+(\d+)\s+(день|дні|днів)(?![\p{L}\p{N}])/giu, (match) => {
    dueDate = addDaysKey(todayKey(), Math.max(1, Number(match[1]) || 1))
  })
  take(/(?<![\p{L}\p{N}])через\s+(\d+)\s+(тиждень|тижні|тижнів)(?![\p{L}\p{N}])/giu, (match) => {
    dueDate = addDaysKey(todayKey(), Math.max(1, Number(match[1]) || 1) * 7)
  })
  take(/(?<![\p{L}\p{N}])через\s+(\d+)\s+(місяць|місяці|місяців)(?![\p{L}\p{N}])/giu, (match) => {
    dueDate = dateKey(addMonths(new Date(), Math.max(1, Number(match[1]) || 1)))
  })

  take(/(?<![\d.])(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?![\d.])/g, (match) => {
    const day = Number(match[1])
    const month = Number(match[2])
    let year = match[3] ? Number(match[3]) : new Date().getFullYear()
    if (year < 100) year += 2000
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      let candidate = new Date(year, month - 1, day)
      if (!match[3] && candidate.getTime() < new Date(todayKey()).getTime()) {
        candidate = new Date(year + 1, month - 1, day)
      }
      dueDate = dateKey(candidate)
    }
  })

  take(/(?<![\p{L}\p{N}])о\s*(\d{1,2})(?::(\d{2}))?(?![\p{L}\p{N}\d])/giu, (match) => {
    const hour = Number(match[1])
    const minute = Number(match[2] ?? 0)
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      dueTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
  })

  take(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/g, (match) => {
    dueTime = `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`
  })

  if ((dueTime || repeat) && !dueDate) dueDate = todayKey()

  return {
    title: cleanTitle(text),
    dueDate,
    dueTime,
    repeat,
    tags,
  }
}
