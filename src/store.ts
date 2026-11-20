import { create } from 'zustand'
import type {
  ActiveTimer,
  AppData,
  ID,
  MoneyBudget,
  MoneyCategory,
  MoneyKind,
  MoneyRecurring,
  MoneyTransaction,
  Payday,
  RepeatFreq,
  RepeatRule,
  Settings,
  SortMode,
  Task,
  TaskList,
  TimeEntry,
  View,
} from './types'
import { MONEY_CATEGORY_PRESETS, SCHEMA_VERSION } from './constants'
import { advanceRepeatDate, addDaysKey, dateKey, keyToDate, nextRepeatKey, todayKey, uid } from './lib/utils'
import { loadAppData } from './lib/storage'

export const DEFAULT_SETTINGS: Settings = {
  currency: '₴',
  hourlyRate: 250,
  taxPercent: 19.5,
  overtimeMultiplier: 1.5,
  dailyNormHours: 8,
  weeklyNormHours: 40,
  overtimeEnabled: true,
  theme: 'system',
  accent: '#2383e2',
  notifications: true,
  compactMode: false,
  firstName: '',
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  pomodoroAutoBreak: true,
  paydayReminderDays: 3,
  moneyAutoPayday: true,
}

const LIST_PALETTE = ['#2383e2', '#0f7b6c', '#6940a5', '#ad1a72', '#d9730d', '#e03e3e']

function makeList(name: string, color: string, order: number, hourlyRate: number | null = null): TaskList {
  const now = Date.now()
  return {
    id: uid('list_'),
    name,
    color,
    hourlyRate,
    createdAt: now,
    updatedAt: now,
    order,
  }
}

function makeCategory(
  preset: (typeof MONEY_CATEGORY_PRESETS)[number],
): MoneyCategory {
  const now = Date.now()
  return {
    id: preset.id,
    name: preset.name,
    color: preset.color,
    icon: preset.icon,
    kind: preset.kind,
    createdAt: now,
    updatedAt: now,
  }
}

function makeTask(partial: Partial<Task> & Pick<Task, 'listId' | 'title'>): Task {
  const now = Date.now()
  return {
    id: uid('task_'),
    listId: partial.listId,
    title: partial.title,
    notes: partial.notes ?? '',
    completed: false,
    completedAt: null,
    important: partial.important ?? false,
    myDayDate: partial.myDayDate ?? null,
    dueDate: partial.dueDate ?? null,
    dueTime: partial.dueTime ?? null,
    reminderAt: partial.reminderAt ?? null,
    notifiedAt: null,
    createdAt: now,
    updatedAt: now,
    steps: partial.steps ?? [],
    estimateMinutes: partial.estimateMinutes ?? null,
    tags: partial.tags ?? [],
    repeat: partial.repeat ?? null,
    spawnedTaskId: null,
  }
}

export function createSeedData(): AppData {
  const work = makeList('Робота', LIST_PALETTE[0], 0)
  const personal = makeList('Особисте', LIST_PALETTE[1], 1, 0)
  const today = todayKey()

  const welcome = makeTask({
    listId: personal.id,
    title: 'Ласкаво просимо до VibeDo',
    notes:
      'Це ваш локальний простір для задач, часу та зарплати. Усе зберігається лише на цьому пристрої.\n\n' +
      'Спробуйте можливості:\n' +
      '• додайте задачу з датою просто у полі вводу — «завтра 18:00 #робота»;\n' +
      '• позначте зарплатний день у календарі;\n' +
      '• запустіть Pomodoro-фокус у трекері часу.',
    important: true,
    myDayDate: today,
    tags: ['початок'],
    steps: [
      { id: uid('step_'), title: 'Додати першу задачу', done: false },
      { id: uid('step_'), title: 'Запустити таймер на задачі', done: false },
      { id: uid('step_'), title: 'Переглянути статистику', done: false },
    ],
  })

  const plan = makeTask({
    listId: work.id,
    title: 'Підготувати план на тиждень',
    notes: 'Оглянути календар і визначити три головні пріоритети.',
    important: true,
    myDayDate: today,
    dueDate: today,
    dueTime: '18:00',
    estimateMinutes: 30,
    tags: ['план', 'робота'],
  })

  const rate = makeTask({
    listId: work.id,
    title: 'Перевірити ставку та податки',
    notes:
      'У налаштуваннях можна змінити погодинну ставку, податок і понаднормові. Для кожного списку можна задати окрему ставку.',
    dueDate: addDaysKey(today, 1),
    estimateMinutes: 10,
    tags: ['гроші'],
  })

  const review = makeTask({
    listId: work.id,
    title: 'Щотижневий огляд задач',
    notes: 'Прибрати виконане, оновити пріоритети та спланувати наступний тиждень.',
    dueDate: addDaysKey(today, 3),
    dueTime: '17:00',
    repeat: { freq: 'weekly', interval: 1 },
    tags: ['огляд'],
  })

  const now = new Date()
  let payDate = new Date(now.getFullYear(), now.getMonth(), 5)
  if (dateKey(payDate) < today) payDate = new Date(now.getFullYear(), now.getMonth() + 1, 5)
  const payday: Payday = {
    id: uid('pay_'),
    date: dateKey(payDate),
    note: 'Зарплата',
    amount: null,
    transactionId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    lists: [work, personal],
    tasks: [welcome, plan, rate, review],
    entries: [],
    paydays: [payday],
    categories: MONEY_CATEGORY_PRESETS.map(makeCategory),
    transactions: [],
    recurring: [],
    budgets: [],
    activeTimer: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function asNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const tag = item.trim().slice(0, 30)
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
    if (tags.length >= 12) break
  }
  return tags
}

export function normalizeRepeat(value: unknown): RepeatRule | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<RepeatRule>
  const freq = String(raw.freq ?? '')
  const allowed: RepeatFreq[] = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly']
  if (!allowed.includes(freq as RepeatFreq)) return null
  return {
    freq: freq as RepeatFreq,
    interval: Math.max(1, Math.min(365, Math.round(asNumber(raw.interval, 1)))),
  }
}

function normalizeMoneyKind(value: unknown, fallback: MoneyKind = 'expense'): MoneyKind {
  return value === 'income' || value === 'expense' ? value : fallback
}

function normalizeMoneyCategory(value: unknown, index: number): MoneyCategory | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<MoneyCategory>
  if (!raw.id) return null
  const preset = MONEY_CATEGORY_PRESETS[index]
  return {
    id: String(raw.id),
    name: String(raw.name || preset?.name || 'Категорія').slice(0, 60),
    color: /^#[0-9a-f]{6}$/i.test(String(raw.color)) ? String(raw.color) : LIST_PALETTE[index % LIST_PALETTE.length],
    icon: typeof raw.icon === 'string' ? raw.icon.slice(0, 8) : preset?.icon ?? '',
    kind:
      raw.kind === 'income' || raw.kind === 'expense' || raw.kind === 'both'
        ? raw.kind
        : preset?.kind ?? 'both',
    createdAt: asNumber(raw.createdAt, Date.now()),
    updatedAt: asNumber(raw.updatedAt, asNumber(raw.createdAt, Date.now())),
  }
}

function normalizeMoneyTransaction(value: unknown): MoneyTransaction | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<MoneyTransaction>
  if (!raw.id) return null
  return {
    id: String(raw.id),
    kind: normalizeMoneyKind(raw.kind),
    amount: Math.max(0, asNumber(raw.amount, 0)),
    categoryId: typeof raw.categoryId === 'string' ? raw.categoryId.slice(0, 80) : '',
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date)) ? String(raw.date) : todayKey(),
    note: typeof raw.note === 'string' ? raw.note.slice(0, 500) : '',
    recurringId: typeof raw.recurringId === 'string' && raw.recurringId ? raw.recurringId : null,
    createdAt: asNumber(raw.createdAt, Date.now()),
    updatedAt: asNumber(raw.updatedAt, asNumber(raw.createdAt, Date.now())),
  }
}

function normalizeMoneyRecurring(value: unknown): MoneyRecurring | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<MoneyRecurring>
  if (!raw.id) return null
  const repeat = normalizeRepeat(raw)
  return {
    id: String(raw.id),
    kind: normalizeMoneyKind(raw.kind),
    amount: Math.max(0, asNumber(raw.amount, 0)),
    categoryId: typeof raw.categoryId === 'string' ? raw.categoryId.slice(0, 80) : '',
    note: typeof raw.note === 'string' ? raw.note.slice(0, 500) : '',
    freq: repeat?.freq ?? 'monthly',
    interval: repeat?.interval ?? 1,
    nextDate: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.nextDate)) ? String(raw.nextDate) : todayKey(),
    lastRunAt: raw.lastRunAt ? asNumber(raw.lastRunAt, 0) || null : null,
    active: raw.active !== false,
    createdAt: asNumber(raw.createdAt, Date.now()),
    updatedAt: asNumber(raw.updatedAt, asNumber(raw.createdAt, Date.now())),
  }
}

function normalizeMoneyBudget(value: unknown): MoneyBudget | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<MoneyBudget>
  if (!raw.id) return null
  return {
    id: String(raw.id),
    categoryId: typeof raw.categoryId === 'string' && raw.categoryId ? raw.categoryId : 'all',
    amount: Math.max(0, asNumber(raw.amount, 0)),
    period: raw.period === 'year' ? 'year' : 'month',
    createdAt: asNumber(raw.createdAt, Date.now()),
    updatedAt: asNumber(raw.updatedAt, asNumber(raw.createdAt, Date.now())),
  }
}

export function normalizeData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') return createSeedData()
  const input = raw as Partial<AppData>
  if (!Array.isArray(input.lists) || !Array.isArray(input.tasks)) {
    return createSeedData()
  }

  const settings: Settings = { ...DEFAULT_SETTINGS, ...(input.settings ?? {}) }
  settings.hourlyRate = Math.max(0, asNumber(settings.hourlyRate, DEFAULT_SETTINGS.hourlyRate))
  settings.taxPercent = Math.max(0, Math.min(100, asNumber(settings.taxPercent, 19.5)))
  settings.overtimeMultiplier = Math.max(1, asNumber(settings.overtimeMultiplier, 1.5))
  settings.dailyNormHours = Math.max(0, asNumber(settings.dailyNormHours, 8))
  settings.weeklyNormHours = Math.max(0, asNumber(settings.weeklyNormHours, 40))
  settings.pomodoroWorkMinutes = Math.max(1, Math.min(180, asNumber(settings.pomodoroWorkMinutes, 25)))
  settings.pomodoroBreakMinutes = Math.max(1, Math.min(60, asNumber(settings.pomodoroBreakMinutes, 5)))
  settings.pomodoroAutoBreak = settings.pomodoroAutoBreak !== false
  settings.paydayReminderDays = Math.max(0, Math.min(30, asNumber(settings.paydayReminderDays, 3)))
  settings.moneyAutoPayday = settings.moneyAutoPayday !== false
  settings.currency = typeof settings.currency === 'string' && settings.currency.trim()
    ? settings.currency.trim().slice(0, 6)
    : '₴'
  settings.accent = /^#[0-9a-f]{6}$/i.test(settings.accent) ? settings.accent : '#2383e2'

  const lists: TaskList[] = input.lists
    .filter((list): list is TaskList => Boolean(list && typeof list === 'object' && list.id))
    .map((list, index) => ({
      id: String(list.id),
      name: String(list.name || 'Новий список').slice(0, 80),
      color: /^#[0-9a-f]{6}$/i.test(list.color) ? list.color : LIST_PALETTE[index % LIST_PALETTE.length],
      hourlyRate:
        list.hourlyRate === null || list.hourlyRate === undefined
          ? null
          : Math.max(0, asNumber(list.hourlyRate, 0)),
      createdAt: asNumber(list.createdAt, Date.now()),
      updatedAt: asNumber(list.updatedAt, asNumber(list.createdAt, Date.now())),
      order: asNumber(list.order, index),
    }))

  if (lists.length === 0) {
    lists.push(makeList('Мої задачі', LIST_PALETTE[0], 0))
  }
  const fallbackList = lists[0].id
  const listIds = new Set(lists.map((list) => list.id))

  const tasks: Task[] = input.tasks
    .filter((task): task is Task => Boolean(task && typeof task === 'object' && task.id))
    .map((task) => ({
      id: String(task.id),
      listId: listIds.has(task.listId) ? task.listId : fallbackList,
      title: String(task.title || 'Без назви').slice(0, 500),
      notes: typeof task.notes === 'string' ? task.notes.slice(0, 20_000) : '',
      completed: Boolean(task.completed),
      completedAt: task.completed && task.completedAt ? asNumber(task.completedAt, Date.now()) : null,
      important: Boolean(task.important),
      myDayDate: typeof task.myDayDate === 'string' ? task.myDayDate : null,
      dueDate: typeof task.dueDate === 'string' ? task.dueDate.slice(0, 10) : null,
      dueTime: typeof task.dueTime === 'string' ? task.dueTime.slice(0, 5) : null,
      reminderAt: task.reminderAt ? asNumber(task.reminderAt, 0) || null : null,
      notifiedAt: task.notifiedAt ? asNumber(task.notifiedAt, 0) || null : null,
      createdAt: asNumber(task.createdAt, Date.now()),
      updatedAt: asNumber(task.updatedAt, Date.now()),
      steps: Array.isArray(task.steps)
        ? task.steps
            .filter((step) => step && typeof step === 'object')
            .map((step) => ({
              id: String(step.id || uid('step_')),
              title: String(step.title || ''),
              done: Boolean(step.done),
            }))
        : [],
      estimateMinutes:
        task.estimateMinutes === null || task.estimateMinutes === undefined
          ? null
          : Math.max(0, asNumber(task.estimateMinutes, 0)),
      tags: normalizeTags(task.tags),
      repeat: normalizeRepeat(task.repeat),
      spawnedTaskId:
        typeof task.spawnedTaskId === 'string' && task.spawnedTaskId ? task.spawnedTaskId : null,
    }))

  const taskIds = new Set(tasks.map((task) => task.id))
  const entries: TimeEntry[] = Array.isArray(input.entries)
    ? input.entries
        .filter((entry) => entry && typeof entry === 'object' && entry.id)
        .map((entry) => ({
          id: String(entry.id),
          taskId: entry.taskId && taskIds.has(entry.taskId) ? entry.taskId : null,
          listId: listIds.has(entry.listId) ? entry.listId : fallbackList,
          startedAt: asNumber(entry.startedAt, Date.now()),
          endedAt: asNumber(entry.endedAt, Date.now()),
          seconds: Math.max(0, asNumber(entry.seconds, 0)),
          note: typeof entry.note === 'string' ? entry.note : '',
          manual: Boolean(entry.manual),
        }))
    : []

  const paydays: Payday[] = Array.isArray(input.paydays)
    ? input.paydays
        .filter((payday) => payday && typeof payday === 'object' && payday.id)
        .map((payday) => ({
          id: String(payday.id),
          date: /^\d{4}-\d{2}-\d{2}$/.test(String(payday.date)) ? String(payday.date) : todayKey(),
          note: typeof payday.note === 'string' ? payday.note.slice(0, 120) : '',
          amount:
            payday.amount === null || payday.amount === undefined
              ? null
              : Math.max(0, asNumber(payday.amount, 0)),
          transactionId:
            typeof payday.transactionId === 'string' && payday.transactionId
              ? payday.transactionId
              : null,
          createdAt: asNumber(payday.createdAt, Date.now()),
          updatedAt: asNumber(payday.updatedAt, Date.now()),
        }))
    : []

  const categories: MoneyCategory[] = Array.isArray(input.categories)
    ? input.categories
        .map((item, index) => normalizeMoneyCategory(item, index))
        .filter((item): item is MoneyCategory => Boolean(item))
    : []
  if (categories.length === 0) {
    categories.push(...MONEY_CATEGORY_PRESETS.map(makeCategory))
  }
  const categoryIds = new Set(categories.map((item) => item.id))

  const transactions: MoneyTransaction[] = Array.isArray(input.transactions)
    ? input.transactions
        .map(normalizeMoneyTransaction)
        .filter((item): item is MoneyTransaction => Boolean(item))
        .map((item) => ({ ...item, categoryId: categoryIds.has(item.categoryId) ? item.categoryId : '' }))
    : []

  const recurring: MoneyRecurring[] = Array.isArray(input.recurring)
    ? input.recurring
        .map(normalizeMoneyRecurring)
        .filter((item): item is MoneyRecurring => Boolean(item))
        .map((item) => ({ ...item, categoryId: categoryIds.has(item.categoryId) ? item.categoryId : '' }))
    : []

  const budgets: MoneyBudget[] = Array.isArray(input.budgets)
    ? input.budgets
        .map(normalizeMoneyBudget)
        .filter((item): item is MoneyBudget => Boolean(item))
        .map((item) => ({
          ...item,
          categoryId: item.categoryId === 'all' || categoryIds.has(item.categoryId) ? item.categoryId : 'all',
        }))
    : []

  let activeTimer: ActiveTimer | null = null
  if (input.activeTimer && taskIds.has(input.activeTimer.taskId)) {
    activeTimer = {
      taskId: input.activeTimer.taskId,
      startedAt: asNumber(input.activeTimer.startedAt, Date.now()),
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    settings,
    lists,
    tasks,
    entries,
    paydays,
    categories,
    transactions,
    recurring,
    budgets,
    activeTimer,
    createdAt: asNumber(input.createdAt, Date.now()),
    updatedAt: asNumber(input.updatedAt, Date.now()),
  }
}

export function snapshot(state: AppData): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: state.settings,
    lists: state.lists,
    tasks: state.tasks,
    entries: state.entries,
    paydays: state.paydays,
    categories: state.categories,
    transactions: state.transactions,
    recurring: state.recurring,
    budgets: state.budgets,
    activeTimer: state.activeTimer,
    createdAt: state.createdAt,
    updatedAt: Date.now(),
  }
}

interface ManualEntryInput {
  taskId: ID | null
  listId: ID
  startedAt: number
  seconds: number
  note?: string
}

interface MoneyCategoryInput {
  name: string
  color?: string
  icon?: string
  kind?: MoneyKind | 'both'
}

interface MoneyTransactionInput {
  kind: MoneyKind
  amount: number
  categoryId: ID | ''
  date: string
  note?: string
  recurringId?: ID | null
}

interface MoneyRecurringInput {
  kind: MoneyKind
  amount: number
  categoryId: ID | ''
  note?: string
  freq: RepeatFreq
  interval?: number
  nextDate: string
}

interface MoneyBudgetInput {
  categoryId: ID | 'all'
  amount: number
  period: 'month' | 'year'
}

interface StoreState extends AppData {
  hydrated: boolean
  view: View
  selectedTaskId: ID | null
  search: string
  sort: SortMode
  init: () => Promise<void>
  setView: (view: View) => void
  setSearch: (search: string) => void
  setSort: (sort: SortMode) => void
  selectTask: (id: ID | null) => void
  addList: (name: string, color?: string) => ID
  updateList: (id: ID, patch: Partial<Pick<TaskList, 'name' | 'color' | 'hourlyRate'>>) => void
  deleteList: (id: ID) => void
  addTask: (input: {
    title: string
    listId?: ID
    dueDate?: string | null
    dueTime?: string | null
    important?: boolean
    myDay?: boolean
    notes?: string
    tags?: string[]
    repeat?: RepeatRule | null
    reminderAt?: number | null
    estimateMinutes?: number | null
  }) => ID
  updateTask: (id: ID, patch: Partial<Task>) => void
  toggleTask: (id: ID) => void
  toggleImportant: (id: ID) => void
  toggleMyDay: (id: ID) => void
  deleteTask: (id: ID) => void
  addStep: (taskId: ID, title: string) => void
  toggleStep: (taskId: ID, stepId: ID) => void
  updateStep: (taskId: ID, stepId: ID, title: string) => void
  deleteStep: (taskId: ID, stepId: ID) => void
  clearCompleted: (listId?: ID) => void
  startTimer: (taskId: ID) => void
  stopTimer: () => void
  discardTimer: () => void
  addManualEntry: (input: ManualEntryInput) => void
  updateEntry: (id: ID, patch: Partial<Pick<TimeEntry, 'seconds' | 'note' | 'startedAt' | 'listId' | 'taskId'>>) => void
  deleteEntry: (id: ID) => void
  addPayday: (input: { date: string; note?: string; amount?: number | null }) => ID
  updatePayday: (id: ID, patch: Partial<Pick<Payday, 'date' | 'note' | 'amount'>>) => void
  deletePayday: (id: ID) => void
  addCategory: (input: MoneyCategoryInput) => ID
  updateCategory: (id: ID, patch: Partial<MoneyCategoryInput>) => void
  deleteCategory: (id: ID) => void
  addTransaction: (input: MoneyTransactionInput) => ID
  updateTransaction: (id: ID, patch: Partial<MoneyTransactionInput & { date: string }>) => void
  deleteTransaction: (id: ID) => void
  addRecurring: (input: MoneyRecurringInput) => ID
  updateRecurring: (id: ID, patch: Partial<MoneyRecurringInput & { active: boolean }>) => void
  deleteRecurring: (id: ID) => void
  addBudget: (input: MoneyBudgetInput) => ID
  updateBudget: (id: ID, patch: Partial<MoneyBudgetInput>) => void
  deleteBudget: (id: ID) => void
  runMoneyMaintenance: () => void
  updateSettings: (patch: Partial<Settings>) => void
  resetSettings: () => void
  replaceData: (data: AppData) => void
  resetAllData: () => void
  markNotified: (taskId: ID) => void
}

function finalizeActive(state: StoreState, now = Date.now()): Partial<StoreState> {
  const active = state.activeTimer
  if (!active) return { activeTimer: null }
  const task = state.tasks.find((item) => item.id === active.taskId)
  const seconds = Math.max(1, Math.round((now - active.startedAt) / 1000))
  const entry: TimeEntry = {
    id: uid('entry_'),
    taskId: task ? task.id : null,
    listId: task ? task.listId : state.lists[0]?.id,
    startedAt: active.startedAt,
    endedAt: now,
    seconds,
    note: '',
    manual: false,
  }
  return { activeTimer: null, entries: [...state.entries, entry] }
}

function repeatCopy(task: Task): Task {
  const now = Date.now()
  const nextDue = nextRepeatKey(task)
  const shift = task.dueDate ? keyToDate(nextDue).getTime() - keyToDate(task.dueDate).getTime() : 0
  return {
    ...task,
    id: uid('task_'),
    completed: false,
    completedAt: null,
    myDayDate: null,
    dueDate: nextDue,
    reminderAt: task.reminderAt ? task.reminderAt + shift : null,
    notifiedAt: null,
    createdAt: now,
    updatedAt: now,
    steps: task.steps.map((step) => ({ ...step, id: uid('step_'), done: false })),
    spawnedTaskId: null,
  }
}

export const useAppStore = create<StoreState>((set, get) => ({
  ...createSeedData(),
  hydrated: false,
  view: { kind: 'smart', id: 'myday' },
  selectedTaskId: null,
  search: '',
  sort: 'created',

  init: async () => {
    const loaded = await loadAppData()
    const data = loaded ? normalizeData(loaded) : createSeedData()
    set({ ...data, hydrated: true })
    get().runMoneyMaintenance()
  },

  setView: (view) => set({ view, selectedTaskId: null, search: '' }),
  setSearch: (search) => set({ search }),
  setSort: (sort) => set({ sort }),
  selectTask: (selectedTaskId) => set({ selectedTaskId }),

  addList: (name, color) => {
    const state = get()
    const palette = LIST_PALETTE
    const list = makeList(
      name.trim() || 'Новий список',
      color ?? palette[state.lists.length % palette.length],
      state.lists.length,
    )
    set({ lists: [...state.lists, list], view: { kind: 'list', id: list.id } })
    return list.id
  },

  updateList: (id, patch) =>
    set((state) => ({
      lists: state.lists.map((list) =>
        list.id === id ? { ...list, ...patch, updatedAt: Date.now() } : list,
      ),
    })),

  deleteList: (id) =>
    set((state) => {
      const lists = state.lists.filter((list) => list.id !== id)
      const removedTaskIds = new Set(state.tasks.filter((task) => task.listId === id).map((task) => task.id))
      if (lists.length === 0) {
        lists.push(makeList('Мої задачі', LIST_PALETTE[0], 0))
      }
      const view = state.view.kind === 'list' && state.view.id === id
        ? { kind: 'smart' as const, id: 'myday' as const }
        : state.view
      return {
        lists,
        tasks: state.tasks.filter((task) => task.listId !== id),
        entries: state.entries.filter((entry) => entry.listId !== id && !removedTaskIds.has(entry.taskId ?? '')),
        activeTimer:
          state.activeTimer && removedTaskIds.has(state.activeTimer.taskId) ? null : state.activeTimer,
        view,
        selectedTaskId: null,
      }
    }),

  addTask: (input) => {
    const state = get()
    const targetList =
      input.listId ??
      (state.view.kind === 'list' ? state.view.id : undefined) ??
      state.lists[0]?.id
    if (!targetList) return ''
    const task = makeTask({
      listId: targetList,
      title: input.title.trim(),
      dueDate: input.dueDate ?? null,
      dueTime: input.dueTime ?? null,
      important: input.important ?? false,
      notes: input.notes ?? '',
      myDayDate: input.myDay ? todayKey() : null,
      tags: normalizeTags(input.tags ?? []),
      repeat: normalizeRepeat(input.repeat),
      reminderAt: input.reminderAt ?? null,
      estimateMinutes: input.estimateMinutes ?? null,
    })
    set({ tasks: [task, ...state.tasks] })
    return task.id
  },

  updateTask: (id, patch) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              ...patch,
              tags: patch.tags ? normalizeTags(patch.tags) : task.tags,
              repeat: patch.repeat !== undefined ? normalizeRepeat(patch.repeat) : task.repeat,
              updatedAt: Date.now(),
            }
          : task,
      ),
    })),

  toggleTask: (id) => {
    const state = get()
    const task = state.tasks.find((item) => item.id === id)
    if (!task) return
    const completing = !task.completed
    const timerPatch = completing && state.activeTimer?.taskId === id ? finalizeActive(state) : {}

    let spawned: Task | null = null
    if (completing && task.repeat && !task.spawnedTaskId) {
      spawned = repeatCopy(task)
    }

    const tasks = state.tasks.map((item) =>
      item.id === id
        ? {
            ...item,
            completed: completing,
            completedAt: completing ? Date.now() : null,
            updatedAt: Date.now(),
            spawnedTaskId: spawned ? spawned.id : item.spawnedTaskId,
          }
        : item,
    )
    if (spawned) tasks.unshift(spawned)

    set({ ...timerPatch, tasks })
  },

  toggleImportant: (id) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, important: !task.important, updatedAt: Date.now() } : task,
      ),
    })),

  toggleMyDay: (id) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              myDayDate: task.myDayDate === todayKey() ? null : todayKey(),
              updatedAt: Date.now(),
            }
          : task,
      ),
    })),

  deleteTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
      entries: state.entries.filter((entry) => entry.taskId !== id),
      activeTimer: state.activeTimer?.taskId === id ? null : state.activeTimer,
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
    })),

  addStep: (taskId, title) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              steps: [...task.steps, { id: uid('step_'), title: title.trim(), done: false }],
              updatedAt: Date.now(),
            }
          : task,
      ),
    })),

  toggleStep: (taskId, stepId) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              steps: task.steps.map((step) =>
                step.id === stepId ? { ...step, done: !step.done } : step,
              ),
              updatedAt: Date.now(),
            }
          : task,
      ),
    })),

  updateStep: (taskId, stepId, title) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              steps: task.steps.map((step) => (step.id === stepId ? { ...step, title } : step)),
              updatedAt: Date.now(),
            }
          : task,
      ),
    })),

  deleteStep: (taskId, stepId) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? { ...task, steps: task.steps.filter((step) => step.id !== stepId), updatedAt: Date.now() }
          : task,
      ),
    })),

  clearCompleted: (listId) =>
    set((state) => {
      const targets = state.tasks.filter(
        (task) => task.completed && (!listId || task.listId === listId),
      )
      const ids = new Set(targets.map((task) => task.id))
      return {
        tasks: state.tasks.filter((task) => !ids.has(task.id)),
        entries: state.entries.filter((entry) => !entry.taskId || !ids.has(entry.taskId)),
        activeTimer:
          state.activeTimer && ids.has(state.activeTimer.taskId) ? null : state.activeTimer,
      }
    }),

  startTimer: (taskId) => {
    const state = get()
    const task = state.tasks.find((item) => item.id === taskId)
    if (!task || task.completed) return
    const patch = state.activeTimer ? finalizeActive(state) : {}
    set({ ...patch, activeTimer: { taskId, startedAt: Date.now() } })
  },

  stopTimer: () => {
    const state = get()
    if (!state.activeTimer) return
    set(finalizeActive(state))
  },

  discardTimer: () => set({ activeTimer: null }),

  addManualEntry: ({ taskId, listId, startedAt, seconds, note }) =>
    set((state) => ({
      entries: [
        ...state.entries,
        {
          id: uid('entry_'),
          taskId,
          listId,
          startedAt,
          endedAt: startedAt + seconds * 1000,
          seconds: Math.max(1, Math.round(seconds)),
          note: note ?? '',
          manual: true,
        },
      ],
    })),

  updateEntry: (id, patch) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...patch,
              endedAt:
                patch.startedAt !== undefined || patch.seconds !== undefined
                  ? (patch.startedAt ?? entry.startedAt) + (patch.seconds ?? entry.seconds) * 1000
                  : entry.endedAt,
            }
          : entry,
      ),
    })),

  deleteEntry: (id) =>
    set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),

  addPayday: ({ date, note, amount }) => {
    const now = Date.now()
    const payday: Payday = {
      id: uid('pay_'),
      date,
      note: (note ?? '').trim().slice(0, 120),
      amount: amount === undefined || amount === null ? null : Math.max(0, amount),
      transactionId: null,
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({ paydays: [...state.paydays, payday] }))
    return payday.id
  },

  updatePayday: (id, patch) =>
    set((state) => ({
      paydays: state.paydays.map((payday) =>
        payday.id === id ? { ...payday, ...patch, updatedAt: Date.now() } : payday,
      ),
    })),

  deletePayday: (id) =>
    set((state) => ({ paydays: state.paydays.filter((payday) => payday.id !== id) })),

  addCategory: ({ name, color, icon, kind }) => {
    const now = Date.now()
    const category: MoneyCategory = {
      id: uid('cat_'),
      name: name.trim().slice(0, 60) || 'Категорія',
      color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : LIST_PALETTE[0],
      icon: typeof icon === 'string' ? icon.slice(0, 8) : '',
      kind: kind && ['income', 'expense', 'both'].includes(kind) ? kind : 'both',
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({ categories: [...state.categories, category] }))
    return category.id
  },

  updateCategory: (id, patch) =>
    set((state) => ({
      categories: state.categories.map((category) =>
        category.id === id ? { ...category, ...patch, updatedAt: Date.now() } : category,
      ),
    })),

  deleteCategory: (id) =>
    set((state) => ({
      categories: state.categories.filter((category) => category.id !== id),
      transactions: state.transactions.map((item) =>
        item.categoryId === id ? { ...item, categoryId: '', updatedAt: Date.now() } : item,
      ),
      recurring: state.recurring.map((item) =>
        item.categoryId === id ? { ...item, categoryId: '', updatedAt: Date.now() } : item,
      ),
      budgets: state.budgets.map((item) =>
        item.categoryId === id ? { ...item, categoryId: 'all', updatedAt: Date.now() } : item,
      ),
    })),

  addTransaction: ({ kind, amount, categoryId, date, note, recurringId }) => {
    const now = Date.now()
    const transaction: MoneyTransaction = {
      id: uid('tx_'),
      kind,
      amount: Math.max(0, Math.round(amount * 100) / 100),
      categoryId,
      date,
      note: (note ?? '').trim().slice(0, 500),
      recurringId: recurringId ?? null,
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({ transactions: [transaction, ...state.transactions] }))
    return transaction.id
  },

  updateTransaction: (id, patch) =>
    set((state) => ({
      transactions: state.transactions.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              amount: patch.amount !== undefined ? Math.max(0, Math.round(patch.amount * 100) / 100) : item.amount,
              updatedAt: Date.now(),
            }
          : item,
      ),
    })),

  deleteTransaction: (id) =>
    set((state) => ({ transactions: state.transactions.filter((item) => item.id !== id) })),

  addRecurring: ({ kind, amount, categoryId, note, freq, interval, nextDate }) => {
    const now = Date.now()
    const item: MoneyRecurring = {
      id: uid('rec_'),
      kind,
      amount: Math.max(0, Math.round(amount * 100) / 100),
      categoryId,
      note: (note ?? '').trim().slice(0, 500),
      freq,
      interval: Math.max(1, Math.min(365, Math.round(interval ?? 1))),
      nextDate,
      lastRunAt: null,
      active: true,
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({ recurring: [item, ...state.recurring] }))
    return item.id
  },

  updateRecurring: (id, patch) =>
    set((state) => ({
      recurring: state.recurring.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              amount: patch.amount !== undefined ? Math.max(0, Math.round(patch.amount * 100) / 100) : item.amount,
              interval: patch.interval !== undefined
                ? Math.max(1, Math.min(365, Math.round(patch.interval)))
                : item.interval,
              updatedAt: Date.now(),
            }
          : item,
      ),
    })),

  deleteRecurring: (id) =>
    set((state) => ({ recurring: state.recurring.filter((item) => item.id !== id) })),

  addBudget: ({ categoryId, amount, period }) => {
    const now = Date.now()
    const budget: MoneyBudget = {
      id: uid('bud_'),
      categoryId,
      amount: Math.max(0, Math.round(amount * 100) / 100),
      period,
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({ budgets: [...state.budgets, budget] }))
    return budget.id
  },

  updateBudget: (id, patch) =>
    set((state) => ({
      budgets: state.budgets.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              amount: patch.amount !== undefined ? Math.max(0, Math.round(patch.amount * 100) / 100) : item.amount,
              updatedAt: Date.now(),
            }
          : item,
      ),
    })),

  deleteBudget: (id) =>
    set((state) => ({ budgets: state.budgets.filter((item) => item.id !== id) })),

  runMoneyMaintenance: () => {
    const state = get()
    const today = todayKey()
    const now = Date.now()

    const due = state.recurring.filter((item) => item.active && item.nextDate <= today)
    if (due.length > 0) {
      const created: MoneyTransaction[] = []
      const recurring = state.recurring.map((item) => {
        if (!item.active || item.nextDate > today) return item
        let cursor = item.nextDate
        let guard = 0
        while (cursor <= today && guard < 36) {
          created.push({
            id: uid('tx_'),
            kind: item.kind,
            amount: item.amount,
            categoryId: item.categoryId,
            date: cursor,
            note: item.note,
            recurringId: item.id,
            createdAt: now,
            updatedAt: now,
          })
          cursor = advanceRepeatDate(cursor, { freq: item.freq, interval: item.interval })
          guard += 1
        }
        return { ...item, nextDate: cursor, lastRunAt: now, updatedAt: now }
      })
      set({ recurring, transactions: [...created, ...state.transactions] })
    }

    const current = get()
    if (!current.settings.moneyAutoPayday) return
    const category =
      current.categories.find((item) => item.kind === 'income' && /зарп/i.test(item.name)) ??
      current.categories.find((item) => item.kind === 'income')
    if (!category) return

    const transactions = [...current.transactions]
    let changed = false
    const paydays = current.paydays.map((payday) => {
      if (payday.transactionId || payday.amount === null || payday.amount <= 0 || payday.date > today) {
        return payday
      }
      const id = uid('tx_')
      transactions.push({
        id,
        kind: 'income',
        amount: payday.amount,
        categoryId: category.id,
        date: payday.date,
        note: payday.note || 'Зарплата',
        recurringId: null,
        createdAt: now,
        updatedAt: now,
      })
      changed = true
      return { ...payday, transactionId: id, updatedAt: now }
    })
    if (changed) set({ paydays, transactions })
  },

  updateSettings: (patch) =>
    set((state) => ({ settings: { ...state.settings, ...patch } })),

  resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS } }),

  replaceData: (data) => {
    const normalized = normalizeData(data)
    set((state) => ({
      ...normalized,
      hydrated: true,
      view: state.view,
      selectedTaskId: state.selectedTaskId,
      search: state.search,
    }))
  },

  resetAllData: () => {
    const seed = createSeedData()
    set({
      ...seed,
      hydrated: true,
      view: { kind: 'smart', id: 'myday' },
      selectedTaskId: null,
      search: '',
    })
  },

  markNotified: (taskId) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, notifiedAt: Date.now() } : task,
      ),
    })),
}))

export type { StoreState }
