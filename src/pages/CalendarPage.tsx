import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'
import {
  calcSalary,
  cn,
  formatDuration,
  formatMoney,
  formatMonth,
  isWeekendKey,
  keyToDate,
  monthMatrix,
  parseQuickAdd,
  pluralizeUk,
  todayKey,
} from '../lib/utils'
import { useAppStore } from '../store'
import { RoundCheck, toast } from '../components/ui'

export function CalendarPage() {
  const tasks = useAppStore((state) => state.tasks)
  const lists = useAppStore((state) => state.lists)
  const entries = useAppStore((state) => state.entries)
  const paydays = useAppStore((state) => state.paydays)
  const settings = useAppStore((state) => state.settings)
  const addTask = useAppStore((state) => state.addTask)
  const toggleTask = useAppStore((state) => state.toggleTask)
  const addPayday = useAppStore((state) => state.addPayday)
  const updatePayday = useAppStore((state) => state.updatePayday)
  const deletePayday = useAppStore((state) => state.deletePayday)
  const selectTask = useAppStore((state) => state.selectTask)

  const today = todayKey()
  const [anchor, setAnchor] = useState(() => {
    const date = keyToDate(today)
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const [selected, setSelected] = useState(today)
  const [draft, setDraft] = useState('')

  const matrix = useMemo(() => monthMatrix(anchor), [anchor])
  const monthStart = anchor.getTime()
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1).getTime()
  const monthSummary = useMemo(
    () => calcSalary(entries, lists, settings, { start: monthStart, end: monthEnd }),
    [entries, lists, settings, monthStart, monthEnd],
  )
  const byDay = useMemo(
    () => new Map(monthSummary.byDay.map((bucket) => [bucket.key, bucket])),
    [monthSummary],
  )

  const tasksByDay = useMemo(() => {
    const map = new Map<string, typeof tasks>()
    for (const task of tasks) {
      if (!task.dueDate) continue
      const bucket = map.get(task.dueDate)
      if (bucket) bucket.push(task)
      else map.set(task.dueDate, [task])
    }
    return map
  }, [tasks])

  const paydaysByDay = useMemo(() => {
    const map = new Map<string, typeof paydays>()
    for (const payday of paydays) {
      const bucket = map.get(payday.date)
      if (bucket) bucket.push(payday)
      else map.set(payday.date, [payday])
    }
    return map
  }, [paydays])

  const selectedDate = keyToDate(selected)
  const selectedTasks = (tasksByDay.get(selected) ?? [])
    .slice()
    .sort((a, b) => Number(a.completed) - Number(b.completed) || a.title.localeCompare(b.title, 'uk'))
  const selectedPaydays = paydaysByDay.get(selected) ?? []
  const selectedEntries = entries.filter(
    (entry) => new Date(entry.startedAt).toDateString() === selectedDate.toDateString(),
  )
  const selectedSeconds = selectedEntries.reduce((sum, entry) => sum + entry.seconds, 0)
  const selectedSalary = calcSalary(entries, lists, settings, {
    start: selectedDate.getTime(),
    end: new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate() + 1,
    ).getTime(),
  })

  const submit = () => {
    const value = draft.trim()
    if (!value) return
    const parsed = parseQuickAdd(value)
    addTask({
      title: parsed.title || value,
      dueDate: selected,
      dueTime: parsed.dueTime,
      myDay: selected === today,
      tags: parsed.tags,
      repeat: parsed.repeat,
    })
    setDraft('')
    toast('Задачу додано на цей день')
  }

  return (
    <div className="page calendar-page">
      <div className="page-inner">
        <div className="page-header">
          <div className="page-header-main">
            <div className="eyebrow">Планування</div>
            <h1 className="page-title">Календар</h1>
            <div className="page-sub">
              Задачі, години, заробіток і зарплатні дні в одному місці.
            </div>
          </div>
          <div className="page-actions">
            <div className="month-switcher">
              <button className="btn-icon" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))} aria-label="Попередній місяць">
                <ChevronLeft size={17} />
              </button>
              <b>{formatMonth(anchor)}</b>
              <button className="btn-icon" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))} aria-label="Наступний місяць">
                <ChevronRight size={17} />
              </button>
              <button
                className="btn btn-sm btn-soft"
                onClick={() => {
                  const date = keyToDate(today)
                  setAnchor(new Date(date.getFullYear(), date.getMonth(), 1))
                  setSelected(today)
                }}
              >
                Сьогодні
              </button>
            </div>
          </div>
        </div>

        <div className="calendar-summary">
          <div>
            <span>За місяць</span>
            <b>{formatDuration(monthSummary.seconds)}</b>
          </div>
          <div>
            <span>Заробіток</span>
            <b>{formatMoney(monthSummary.gross, settings.currency, 0)}</b>
          </div>
          <div>
            <span>На руки</span>
            <b>{formatMoney(monthSummary.net, settings.currency, 0)}</b>
          </div>
          <div>
            <span>Зарплатних днів</span>
            <b>{paydays.filter((payday) => payday.date >= formatDate(monthStart) && payday.date < formatDate(monthEnd)).length}</b>
          </div>
        </div>

        <div className="calendar-layout">
          <section className="calendar-card">
            <div className="calendar-weekdays">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {matrix.map((key) => {
                const date = keyToDate(key)
                const inMonth = date.getMonth() === anchor.getMonth()
                const dayTasks = tasksByDay.get(key) ?? []
                const activeTasks = dayTasks.filter((task) => !task.completed)
                const paydayList = paydaysByDay.get(key) ?? []
                const bucket = byDay.get(key)
                return (
                  <button
                    key={key}
                    className={cn(
                      'calendar-day',
                      !inMonth && 'outside',
                      key === today && 'today',
                      key === selected && 'selected',
                      isWeekendKey(key) && 'weekend',
                    )}
                    onClick={() => setSelected(key)}
                  >
                    <span className="calendar-day-top">
                      <span className="calendar-num">{date.getDate()}</span>
                      {paydayList.length > 0 && (
                        <span className="calendar-pay" title="Зарплатний день">
                          <Wallet size={10} />
                        </span>
                      )}
                    </span>
                    <span className="calendar-day-body">
                      {activeTasks.slice(0, 2).map((task) => {
                        const list = lists.find((item) => item.id === task.listId)
                        return (
                          <span className="calendar-task" key={task.id}>
                            <span className="dot" style={{ background: list?.color ?? 'var(--accent)' }} />
                            {task.title}
                          </span>
                        )
                      })}
                      {activeTasks.length > 2 && (
                        <span className="calendar-more">+{activeTasks.length - 2}</span>
                      )}
                    </span>
                    <span className="calendar-day-foot">
                      {bucket && bucket.seconds > 0 && (
                        <span>
                          <Clock size={9} /> {formatDuration(bucket.seconds)}
                        </span>
                      )}
                      {bucket && bucket.amount > 0 && (
                        <span>{formatMoney(bucket.amount, settings.currency, 0)}</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <aside className="calendar-side">
            <div className="calendar-side-head">
              <div>
                <div className="calendar-side-date">
                  {selectedDate.toLocaleDateString('uk-UA', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </div>
                <div className="calendar-side-sub">
                  {selectedTasks.length}{' '}
                  {pluralizeUk(selectedTasks.length, ['задача', 'задачі', 'задач'])} ·{' '}
                  {formatDuration(selectedSeconds)} ·{' '}
                  {formatMoney(selectedSalary.gross, settings.currency, 0)}
                </div>
              </div>
            </div>

            <div className="calendar-section">
              <div className="calendar-section-title">Задачі</div>
              {selectedTasks.length === 0 && (
                <div className="calendar-empty">На цей день задач немає</div>
              )}
              <div className="calendar-task-list">
                {selectedTasks.map((task) => (
                  <div className={cn('calendar-task-row', task.completed && 'done')} key={task.id}>
                    <RoundCheck
                      checked={task.completed}
                      onClick={() => toggleTask(task.id)}
                      label="Виконано"
                    />
                    <button className="calendar-task-title" onClick={() => selectTask(task.id)}>
                      {task.title}
                    </button>
                    {task.dueTime && <span className="calendar-time">{task.dueTime}</span>}
                  </div>
                ))}
              </div>
              <div className="calendar-add">
                <Plus size={15} />
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submit()
                  }}
                  placeholder="Задача на цей день · 18:00 #тег"
                  aria-label="Нова задача на вибраний день"
                />
                <button className="btn btn-sm btn-primary" onClick={submit} disabled={!draft.trim()}>
                  Додати
                </button>
              </div>
              <div className="calendar-hint">
                Підказка: «завтра 18:00 #робота» або «щопонеділка».
              </div>
            </div>

            <div className="calendar-section">
              <div className="calendar-section-title">
                <span>Зарплатний день</span>
                <Wallet size={13} />
              </div>
              {selectedPaydays.length === 0 ? (
                <button
                  className="calendar-payday-add"
                  onClick={() => {
                    addPayday({ date: selected, note: 'Зарплата', amount: null })
                    toast('Зарплатний день позначено')
                  }}
                >
                  <Wallet size={16} />
                  Позначити зарплатним днем
                </button>
              ) : (
                selectedPaydays.map((payday) => (
                  <div className="calendar-payday-card" key={payday.id}>
                    <div className="calendar-payday-top">
                      <span className="payday-badge">
                        <Wallet size={12} /> Зарплата
                      </span>
                      <button
                        className="btn-icon"
                        onClick={() => deletePayday(payday.id)}
                        aria-label="Прибрати зарплатний день"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <label className="field">
                      <span className="field-label">Нотатка</span>
                      <input
                        className="input"
                        value={payday.note}
                        placeholder="Наприклад, зарплата за жовтень"
                        onChange={(event) => updatePayday(payday.id, { note: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Очікувана сума, {settings.currency}</span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="100"
                        value={payday.amount ?? ''}
                        placeholder="Необов’язково"
                        onChange={(event) =>
                          updatePayday(payday.id, {
                            amount: event.target.value === '' ? null : Math.max(0, Number(event.target.value)),
                          })
                        }
                      />
                    </label>
                  </div>
                ))
              )}
              <div className="calendar-hint">
                Нагадаємо за {settings.paydayReminderDays}{' '}
                {pluralizeUk(settings.paydayReminderDays, ['день', 'дні', 'днів'])} до зарплати.
              </div>
            </div>

            {selectedDate.getTime() >= new Date(today).getTime() &&
              selectedDate.getTime() < new Date(today).getTime() + 86_400_000 * 7 && (
                <div className="calendar-section">
                  <div className="calendar-section-title">Наступні 7 днів</div>
                  <div className="calendar-agenda">
                    {Array.from({ length: 7 }, (_, index) => {
                      const date = new Date(selectedDate)
                      date.setDate(date.getDate() + index)
                      const key = formatDate(date.getTime())
                      const count = (tasksByDay.get(key) ?? []).filter((task) => !task.completed).length
                      const pay = (paydaysByDay.get(key) ?? []).length
                      if (count === 0 && pay === 0) return null
                      return (
                        <button key={key} className="agenda-row" onClick={() => setSelected(key)}>
                          <span>
                            {date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                          </span>
                          <span>{count > 0 ? `${count} задач` : 'Задач немає'}</span>
                          {pay > 0 && <Wallet size={11} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
          </aside>
        </div>
      </div>
    </div>
  )
}

function formatDate(ms: number): string {
  const date = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
