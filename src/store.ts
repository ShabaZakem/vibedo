import { create } from 'zustand'
import type {
  ActiveTimer,
  AppData,
  ID,
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
import { SCHEMA_VERSION } from './constants'
import { addDaysKey, dateKey, keyToDate, nextRepeatKey, todayKey, uid } from './lib/utils'
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
          createdAt: asNumber(payday.createdAt, Date.now()),
          updatedAt: asNumber(payday.updatedAt, Date.now()),
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
