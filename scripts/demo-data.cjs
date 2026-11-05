// Demo dataset for documentation screenshots. Nothing here is written to disk.
function createDemoData() {
  const base = new Date()
  base.setHours(0, 0, 0, 0)

  const pad = (value) => String(value).padStart(2, '0')
  const key = (offset) => {
    const date = new Date(base)
    date.setDate(date.getDate() + offset)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }
  const at = (offset, hour, minute = 0) => {
    const date = new Date(base)
    date.setDate(date.getDate() + offset)
    date.setHours(hour, minute, 0, 0)
    return date.getTime()
  }
  const minutes = (value) => value * 60

  const now = Date.now()
  const today = key(0)

  const DEMO_TAGS = {
    task_report: ['робота', 'звіт'],
    task_design: ['робота', 'дизайн'],
    task_call: ['робота', 'клієнти'],
    task_groceries: ['побут'],
    task_docs: ['робота', 'документація'],
    task_book: ['навчання', 'читання'],
    task_dentist: ['здоров’я'],
    task_morning: ['рутина'],
    task_sprint: ['робота', 'планування'],
  }

  const DEMO_REPEAT = {
    task_report: { freq: 'weekly', interval: 1 },
    task_morning: { freq: 'daily', interval: 1 },
  }

  const lists = [
    {
      id: 'list_work',
      name: 'Робота',
      color: '#0f6cbd',
      hourlyRate: 400,
      createdAt: now - 90 * 86400000,
      updatedAt: now - 90 * 86400000,
      order: 0,
    },
    {
      id: 'list_personal',
      name: 'Особисте',
      color: '#0f7b6c',
      hourlyRate: 0,
      createdAt: now - 90 * 86400000,
      updatedAt: now - 90 * 86400000,
      order: 1,
    },
    {
      id: 'list_study',
      name: 'Навчання',
      color: '#6b4fc9',
      hourlyRate: null,
      createdAt: now - 80 * 86400000,
      updatedAt: now - 80 * 86400000,
      order: 2,
    },
  ]

  const steps = (items) =>
    items.map(([title, done], index) => ({ id: `step_${title}_${index}`, title, done }))

  const tasks = [
    {
      id: 'task_report',
      listId: 'list_work',
      title: 'Підготувати тижневий звіт',
      notes: 'Зібрати години з трекера, перевірити понаднормові та надіслати команді до 18:00.',
      completed: false,
      completedAt: null,
      important: true,
      myDayDate: today,
      dueDate: today,
      dueTime: '18:00',
      reminderAt: null,
      notifiedAt: null,
      createdAt: now - 60 * 60 * 1000,
      updatedAt: now - 60 * 60 * 1000,
      steps: steps([
        ['Зібрати дані з трекера', true],
        ['Перевірити понаднормові години', true],
        ['Оформити висновки', false],
        ['Надіслати команді', false],
      ]),
      estimateMinutes: 90,
    },
    {
      id: 'task_design',
      listId: 'list_work',
      title: 'Оновити дизайн головного екрана',
      notes: 'Fluent-стиль, світла й темна теми, нові картки статистики.',
      completed: false,
      completedAt: null,
      important: false,
      myDayDate: today,
      dueDate: today,
      dueTime: '16:00',
      reminderAt: null,
      notifiedAt: null,
      createdAt: now - 2 * 60 * 60 * 1000,
      updatedAt: now - 2 * 60 * 60 * 1000,
      steps: steps([
        ['Переглянути макети', true],
        ['Зібрати відгуки команди', false],
        ['Підготувати фінальні екрани', false],
      ]),
      estimateMinutes: 120,
    },
    {
      id: 'task_call',
      listId: 'list_work',
      title: 'Дзвінок із клієнтом',
      notes: '',
      completed: false,
      completedAt: null,
      important: false,
      myDayDate: today,
      dueDate: today,
      dueTime: '14:30',
      reminderAt: null,
      notifiedAt: null,
      createdAt: now - 3 * 60 * 60 * 1000,
      updatedAt: now - 3 * 60 * 60 * 1000,
      steps: [],
      estimateMinutes: 30,
    },
    {
      id: 'task_groceries',
      listId: 'list_personal',
      title: 'Купити продукти на тиждень',
      notes: '',
      completed: false,
      completedAt: null,
      important: false,
      myDayDate: today,
      dueDate: null,
      dueTime: null,
      reminderAt: null,
      notifiedAt: null,
      createdAt: now - 4 * 60 * 60 * 1000,
      updatedAt: now - 4 * 60 * 60 * 1000,
      steps: [],
      estimateMinutes: 45,
    },
    {
      id: 'task_docs',
      listId: 'list_work',
      title: 'Описати API для інтеграції',
      notes: '',
      completed: false,
      completedAt: null,
      important: false,
      myDayDate: null,
      dueDate: key(1),
      dueTime: '12:00',
      reminderAt: null,
      notifiedAt: null,
      createdAt: now - 5 * 60 * 60 * 1000,
      updatedAt: now - 5 * 60 * 60 * 1000,
      steps: steps([
        ['Описати авторизацію', false],
        ['Додати приклади запитів', false],
      ]),
      estimateMinutes: 60,
    },
    {
      id: 'task_book',
      listId: 'list_study',
      title: 'Прочитати розділ про TypeScript',
      notes: '',
      completed: false,
      completedAt: null,
      important: true,
      myDayDate: null,
      dueDate: key(2),
      dueTime: null,
      reminderAt: null,
      notifiedAt: null,
      createdAt: now - 6 * 60 * 60 * 1000,
      updatedAt: now - 6 * 60 * 60 * 1000,
      steps: [],
      estimateMinutes: 60,
    },
    {
      id: 'task_dentist',
      listId: 'list_personal',
      title: 'Записатися до стоматолога',
      notes: '',
      completed: false,
      completedAt: null,
      important: true,
      myDayDate: null,
      dueDate: key(3),
      dueTime: null,
      reminderAt: null,
      notifiedAt: null,
      createdAt: now - 7 * 60 * 60 * 1000,
      updatedAt: now - 7 * 60 * 60 * 1000,
      steps: [],
      estimateMinutes: null,
    },
    {
      id: 'task_morning',
      listId: 'list_personal',
      title: 'Ранкова рутина',
      notes: '',
      completed: true,
      completedAt: now - 5 * 60 * 60 * 1000,
      important: false,
      myDayDate: today,
      dueDate: null,
      dueTime: null,
      reminderAt: null,
      notifiedAt: null,
      createdAt: now - 8 * 60 * 60 * 1000,
      updatedAt: now - 5 * 60 * 60 * 1000,
      steps: [],
      estimateMinutes: 20,
    },
    {
      id: 'task_sprint',
      listId: 'list_work',
      title: 'Спланувати спринт',
      notes: '',
      completed: true,
      completedAt: now - 4 * 60 * 60 * 1000,
      important: false,
      myDayDate: today,
      dueDate: null,
      dueTime: null,
      reminderAt: null,
      notifiedAt: null,
      createdAt: now - 9 * 60 * 60 * 1000,
      updatedAt: now - 4 * 60 * 60 * 1000,
      steps: [],
      estimateMinutes: 30,
    },
  ]

  const entries = []
  let entryIndex = 0
  const addEntry = (taskId, listId, startedAt, seconds, note = '', manual = false) => {
    entries.push({
      id: `entry_demo_${entryIndex++}`,
      taskId,
      listId,
      startedAt,
      endedAt: startedAt + seconds * 1000,
      seconds,
      note,
      manual,
    })
  }

  // Today: a realistic working day that fills the hero card and the tracker.
  addEntry('task_report', 'list_work', at(0, 8, 45), minutes(90))
  addEntry('task_design', 'list_work', at(0, 10, 30), minutes(120))
  addEntry('task_call', 'list_work', at(0, 13, 0), minutes(45))
  addEntry('task_docs', 'list_work', at(0, 14, 0), minutes(120))

  // Previous weekdays: enough history for week/month/all-time charts.
  const patterns = [7, 6.5, 8, 7.5, 9.5, 6, 8]
  let patternIndex = 0
  for (let offset = -364; offset <= -1; offset += 1) {
    const date = new Date(base)
    date.setDate(date.getDate() + offset)
    const weekday = date.getDay()
    if (weekday === 0 || weekday === 6) continue

    const total = patterns[patternIndex % patterns.length]
    patternIndex += 1
    const morning = Math.min(4, Math.max(2, total - 2))
    const afternoon = total - morning

    addEntry(
      patternIndex % 3 === 0 ? 'task_design' : 'task_report',
      'list_work',
      at(offset, 9, 0),
      minutes(morning * 60),
    )
    addEntry(
      patternIndex % 4 === 0 ? 'task_report' : 'task_design',
      'list_work',
      at(offset, 14, 0),
      minutes(afternoon * 60),
    )

    if (weekday === 5) {
      addEntry('task_book', 'list_study', at(offset, 19, 0), minutes(60), '', true)
    }
  }

  return {
    schemaVersion: 2,
    settings: {
      currency: '₴',
      hourlyRate: 250,
      taxPercent: 19.5,
      overtimeMultiplier: 1.5,
      dailyNormHours: 8,
      weeklyNormHours: 40,
      overtimeEnabled: true,
      theme: 'light',
      accent: '#2383e2',
      notifications: true,
      compactMode: false,
      firstName: '',
      pomodoroWorkMinutes: 25,
      pomodoroBreakMinutes: 5,
      pomodoroAutoBreak: true,
      paydayReminderDays: 2,
    },
    lists,
    tasks: tasks.map((task) => ({
      ...task,
      tags: DEMO_TAGS[task.id] ?? [],
      repeat: DEMO_REPEAT[task.id] ?? null,
      spawnedTaskId: null,
    })),
    entries,
    paydays: [
      {
        id: 'payday_next',
        date: key(2),
        note: 'Зарплата',
        amount: 24000,
        createdAt: now - 86400000,
        updatedAt: now - 86400000,
      },
      {
        id: 'payday_prev',
        date: key(-18),
        note: 'Аванс',
        amount: 8000,
        createdAt: now - 20 * 86400000,
        updatedAt: now - 20 * 86400000,
      },
    ],
    activeTimer: null,
    createdAt: now - 90 * 86400000,
    updatedAt: now,
  }
}

module.exports = { createDemoData }
