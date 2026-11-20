export type ID = string

export type ThemeMode = 'light' | 'dark' | 'system'

export type SmartViewId = 'myday' | 'important' | 'planned' | 'all'

export type View =
  | { kind: 'smart'; id: SmartViewId }
  | { kind: 'list'; id: ID }
  | { kind: 'time' }
  | { kind: 'salary' }
  | { kind: 'money' }
  | { kind: 'calendar' }
  | { kind: 'stats' }
  | { kind: 'settings' }

export type SortMode = 'created' | 'due' | 'important' | 'alpha'

export type RepeatFreq = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'

export interface RepeatRule {
  freq: RepeatFreq
  interval: number
}

export interface Step {
  id: ID
  title: string
  done: boolean
}

export interface Task {
  id: ID
  listId: ID
  title: string
  notes: string
  completed: boolean
  completedAt: number | null
  important: boolean
  myDayDate: string | null
  dueDate: string | null
  dueTime: string | null
  reminderAt: number | null
  notifiedAt: number | null
  createdAt: number
  updatedAt: number
  steps: Step[]
  estimateMinutes: number | null
  tags: string[]
  repeat: RepeatRule | null
  spawnedTaskId: ID | null
}

export interface TaskList {
  id: ID
  name: string
  color: string
  hourlyRate: number | null
  createdAt: number
  updatedAt: number
  order: number
}

export interface TimeEntry {
  id: ID
  taskId: ID | null
  listId: ID
  startedAt: number
  endedAt: number
  seconds: number
  note: string
  manual: boolean
}

export interface ActiveTimer {
  taskId: ID
  startedAt: number
}

export interface Payday {
  id: ID
  date: string
  note: string
  amount: number | null
  /** Income transaction created automatically from this payday (if enabled). */
  transactionId: ID | null
  createdAt: number
  updatedAt: number
}

export type MoneyKind = 'income' | 'expense'

export interface MoneyCategory {
  id: ID
  name: string
  color: string
  /** Emoji or short glyph used as the category icon. */
  icon: string
  kind: MoneyKind | 'both'
  createdAt: number
  updatedAt: number
}

export interface MoneyTransaction {
  id: ID
  kind: MoneyKind
  amount: number
  categoryId: ID | ''
  date: string
  note: string
  recurringId: ID | null
  createdAt: number
  updatedAt: number
}

export interface MoneyRecurring {
  id: ID
  kind: MoneyKind
  amount: number
  categoryId: ID | ''
  note: string
  freq: RepeatFreq
  interval: number
  /** Next date the transaction should be created (YYYY-MM-DD). */
  nextDate: string
  lastRunAt: number | null
  active: boolean
  createdAt: number
  updatedAt: number
}

export interface MoneyBudget {
  id: ID
  categoryId: ID | 'all'
  amount: number
  period: 'month' | 'year'
  createdAt: number
  updatedAt: number
}

export interface Settings {
  currency: string
  hourlyRate: number
  taxPercent: number
  overtimeMultiplier: number
  dailyNormHours: number
  weeklyNormHours: number
  overtimeEnabled: boolean
  theme: ThemeMode
  accent: string
  notifications: boolean
  compactMode: boolean
  firstName: string
  pomodoroWorkMinutes: number
  pomodoroBreakMinutes: number
  pomodoroAutoBreak: boolean
  paydayReminderDays: number
  /** Automatically record paydays as income transactions. */
  moneyAutoPayday: boolean
}

export interface AppData {
  schemaVersion: number
  settings: Settings
  lists: TaskList[]
  tasks: Task[]
  entries: TimeEntry[]
  paydays: Payday[]
  categories: MoneyCategory[]
  transactions: MoneyTransaction[]
  recurring: MoneyRecurring[]
  budgets: MoneyBudget[]
  activeTimer: ActiveTimer | null
  createdAt: number
  updatedAt: number
}

export interface SalaryBucket {
  key: string
  seconds: number
  amount: number
  overtimeSeconds: number
}

export interface SalarySummary {
  gross: number
  net: number
  taxes: number
  seconds: number
  regularSeconds: number
  overtimeSeconds: number
  byDay: SalaryBucket[]
  byList: SalaryBucket[]
  entries: TimeEntry[]
}
