import { useMemo, useState } from 'react'
import {
  CalendarDays,
  Clock,
  ListPlus,
  Play,
  Plus,
  Square,
  Timer,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react'
import {
  amountForEntry,
  calcSalary,
  cn,
  formatClock,
  formatDateInput,
  formatDayLabel,
  formatDuration,
  formatMoney,
  formatTimeInput,
  listRate,
  rangeFor,
} from '../lib/utils'
import { useAppStore } from '../store'
import type { Period } from '../lib/utils'
import type { TimeEntry } from '../types'
import { ManualEntryDialog } from '../components/ManualEntryDialog'
import { Segmented, toast, useTick } from '../components/ui'
import { pomodoroRemaining, pomodoroTotal, usePomodoro } from '../lib/pomodoro'

const PERIODS: { value: Exclude<Period, 'custom'>; label: string }[] = [
  { value: 'today', label: 'Сьогодні' },
  { value: 'week', label: 'Тиждень' },
  { value: 'month', label: 'Місяць' },
  { value: 'all', label: 'Увесь час' },
]

export function TimePage() {
  const tasks = useAppStore((state) => state.tasks)
  const lists = useAppStore((state) => state.lists)
  const entries = useAppStore((state) => state.entries)
  const settings = useAppStore((state) => state.settings)
  const activeTimer = useAppStore((state) => state.activeTimer)
  const startTimer = useAppStore((state) => state.startTimer)
  const stopTimer = useAppStore((state) => state.stopTimer)
  const deleteEntry = useAppStore((state) => state.deleteEntry)
  const setView = useAppStore((state) => state.setView)
  const selectTask = useAppStore((state) => state.selectTask)

  const [period, setPeriod] = useState<Exclude<Period, 'custom'>>('today')
  const [manualOpen, setManualOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const now = useTick(1000)

  const pomodoroPhase = usePomodoro((state) => state.phase)
  const pomodoroEndsAt = usePomodoro((state) => state.endsAt)
  const pomodoroRemainingMs = usePomodoro((state) => state.remainingMs)
  const pomodoroTaskId = usePomodoro((state) => state.taskId)
  const startPomodoro = usePomodoro((state) => state.startWork)
  const pausePomodoro = usePomodoro((state) => state.pause)
  const resumePomodoro = usePomodoro((state) => state.resume)
  const stopPomodoro = usePomodoro((state) => state.stop)

  const availableTasks = useMemo(
    () =>
      tasks
        .filter((task) => !task.completed)
        .sort((a, b) => Number(b.important) - Number(a.important) || b.createdAt - a.createdAt),
    [tasks],
  )

  const defaultTaskId = useMemo(() => {
    const paid = availableTasks.find(
      (task) => listRate(lists.find((list) => list.id === task.listId), settings) > 0,
    )
    return paid?.id ?? availableTasks[0]?.id ?? ''
  }, [availableTasks, lists, settings])

  const effectiveTaskId = selectedTaskId || defaultTaskId
  const selectedTask = tasks.find((task) => task.id === effectiveTaskId)
  const activeTask = activeTimer ? tasks.find((task) => task.id === activeTimer.taskId) : undefined
  const activeList = activeTask ? lists.find((list) => list.id === activeTask.listId) : undefined

  const elapsed = activeTimer ? Math.max(0, Math.round((now - activeTimer.startedAt) / 1000)) : 0

  const today = calcSalary(entries, lists, settings, rangeFor('today'))
  const week = calcSalary(entries, lists, settings, rangeFor('week'))
  const month = calcSalary(entries, lists, settings, rangeFor('month'))
  const all = calcSalary(entries, lists, settings, rangeFor('all'))

  const range = period === 'all' ? rangeFor('all') : rangeFor(period)
  const filtered = useMemo(
    () =>
      entries
        .filter((entry) => entry.startedAt >= range.start && entry.startedAt < range.end)
        .sort((a, b) => b.startedAt - a.startedAt),
    [entries, range.start, range.end],
  )

  const groups = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const entry of filtered) {
      const key = formatDateInput(entry.startedAt)
      const list = map.get(key)
      if (list) list.push(entry)
      else map.set(key, [entry])
    }
    return [...map.entries()]
  }, [filtered])

  const periodSalary = calcSalary(entries, lists, settings, range)

  const start = () => {
    if (!effectiveTaskId) return
    startTimer(effectiveTaskId)
    toast('Таймер запущено')
  }

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div className="page-header-main">
            <div className="eyebrow">Час</div>
            <h1 className="page-title">Трекер часу</h1>
            <div className="page-sub">
              Запускайте таймер на задачі або додавайте записи вручну. Час одразу потрапляє в
              розрахунок зарплати.
            </div>
          </div>
          <div className="page-actions">
            <button className="btn btn-soft" onClick={() => setManualOpen(true)}>
              <ListPlus size={15} /> Додати вручну
            </button>
          </div>
        </div>

        {pomodoroPhase !== 'idle' && (
          <div className={cn('pomodoro-card', pomodoroPhase)}>
            <div className="pomodoro-card-head">
              <span className="pomodoro-card-icon">
                <Zap size={15} />
              </span>
              <div>
                <b>{pomodoroPhase === 'break' ? 'Перерва' : 'Pomodoro-фокус'}</b>
                <span>
                  {pomodoroPhase === 'break'
                    ? `${settings.pomodoroBreakMinutes} хв відпочинку`
                    : tasks.find((task) => task.id === pomodoroTaskId)?.title ??
                      `${settings.pomodoroWorkMinutes} хв концентрації`}
                </span>
              </div>
              <span className="spacer" />
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => (pomodoroEndsAt ? pausePomodoro() : resumePomodoro())}
              >
                {pomodoroEndsAt ? 'Пауза' : 'Далі'}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={stopPomodoro}>
                Стоп
              </button>
            </div>
            <div className="pomodoro-card-progress">
              <span
                style={{
                  width: `${
                    100 -
                    Math.min(
                      100,
                      (pomodoroRemaining(pomodoroEndsAt, pomodoroRemainingMs) /
                        pomodoroTotal(pomodoroPhase)) *
                        100,
                    )
                  }%`,
                }}
              />
            </div>
            <div className="pomodoro-card-clock">
              {formatClock(Math.ceil(pomodoroRemaining(pomodoroEndsAt, pomodoroRemainingMs) / 1000))}
            </div>
          </div>
        )}

        <div className="timer-card">
          <div className="tc-main">
            <div className="tc-label">
              {activeTimer ? (
                <>
                  <span className="live-dot" /> Таймер працює
                </>
              ) : (
                <>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--text-3)',
                    }}
                  />
                  Таймер зупинено
                </>
              )}
            </div>
            {activeTimer && activeTask ? (
              <>
                <button
                  className="tc-task"
                  onClick={() => selectTask(activeTask.id)}
                  style={{ textAlign: 'left', color: 'var(--text)' }}
                >
                  {activeTask.title}
                </button>
                <div className="tc-meta">
                  {activeList?.name ?? 'Без списку'} ·{' '}
                  {formatMoney((elapsed / 3600) * listRate(activeList, settings), settings.currency)} за
                  сесію
                </div>
              </>
            ) : (
              <>
                <select
                  className="input"
                  style={{ maxWidth: 420, marginTop: 6 }}
                  value={effectiveTaskId}
                  onChange={(event) => setSelectedTaskId(event.target.value)}
                >
                  {availableTasks.length === 0 && <option value="">Немає активних задач</option>}
                  {availableTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
                <div className="tc-meta">
                  {selectedTask
                    ? `Ставка: ${formatMoney(
                        listRate(
                          lists.find((list) => list.id === selectedTask.listId),
                          settings,
                        ),
                        settings.currency,
                        0,
                      )}/год`
                    : 'Створіть задачу, щоб почати відстеження'}
                </div>
              </>
            )}
          </div>

          <div className={cn('timer-big', !activeTimer && 'idle')}>
            {activeTimer ? formatClock(elapsed) : '00:00:00'}
          </div>

          <div className="tc-actions">
            {activeTimer ? (
              <button
                className="big-play stop"
                onClick={() => {
                  stopTimer()
                  toast(`Записано ${formatDuration(elapsed)}`)
                }}
                aria-label="Зупинити таймер"
                title="Зупинити й зберегти"
              >
                <Square size={19} fill="currentColor" />
              </button>
            ) : (
              <button
                className="big-play"
                onClick={start}
                disabled={!effectiveTaskId}
                aria-label="Запустити таймер"
                title="Запустити таймер"
              >
                <Play size={21} style={{ marginLeft: 2 }} />
              </button>
            )}
            {!activeTimer && effectiveTaskId && pomodoroPhase === 'idle' && (
              <button
                className="big-pomodoro"
                onClick={() => {
                  startPomodoro(effectiveTaskId)
                  toast(`Pomodoro ${settings.pomodoroWorkMinutes} хв`)
                }}
                aria-label="Запустити Pomodoro"
                title={`Pomodoro ${settings.pomodoroWorkMinutes} хв`}
              >
                <Zap size={17} />
              </button>
            )}
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card accent">
            <div className="stat-head">
              <span className="stat-label">Сьогодні</span>
              <Clock size={15} />
            </div>
            <div className="stat-value">{formatDuration(today.seconds)}</div>
            <div className="stat-hint">{formatMoney(today.gross, settings.currency)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-head">
              <span className="stat-label">Цей тиждень</span>
              <CalendarDays size={15} />
            </div>
            <div className="stat-value">
              {formatDuration(week.seconds)}
            </div>
            <div className="stat-hint">{formatMoney(week.gross, settings.currency)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-head">
              <span className="stat-label">Цей місяць</span>
              <Timer size={15} />
            </div>
            <div className="stat-value">{formatDuration(month.seconds)}</div>
            <div className="stat-hint">{formatMoney(month.gross, settings.currency)}</div>
          </div>
          <div className="stat-card money">
            <div className="stat-head">
              <span className="stat-label">Увесь час</span>
              <Wallet size={15} />
            </div>
            <div className="stat-value">
              {formatMoney(all.gross, settings.currency, 0)}
            </div>
            <div className="stat-hint">{formatDuration(all.seconds)} · {all.entries.length} записів</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Записи часу</div>
              <div className="card-sub">
                {periodSalary.entries.length} записів · {formatDuration(periodSalary.seconds)} ·{' '}
                {formatMoney(periodSalary.gross, settings.currency)}
              </div>
            </div>
            <span className="spacer" />
            <Segmented options={PERIODS} value={period} onChange={setPeriod} />
          </div>

          {filtered.length === 0 ? (
            <div className="empty" style={{ padding: '40px 16px' }}>
              <div className="empty-art" style={{ width: 64, height: 64, borderRadius: 18 }}>
                <Clock size={28} />
              </div>
              <div className="empty-title">Записів ще немає</div>
              <div className="empty-text">
                Запустіть таймер на задачі або додайте запис вручну — він з’явиться тут.
              </div>
              <div className="empty-actions">
                <button className="btn btn-primary btn-sm" onClick={() => setManualOpen(true)}>
                  <Plus size={14} /> Додати запис
                </button>
              </div>
            </div>
          ) : (
            groups.map(([day, dayEntries]) => {
              const daySeconds = dayEntries.reduce((sum, entry) => sum + entry.seconds, 0)
              const dayAmount = dayEntries.reduce(
                (sum, entry) => sum + amountForEntry(entry, entries, lists, settings).amount,
                0,
              )
              return (
                <div className="day-group" key={day}>
                  <div className="day-group-head">
                    {formatDayLabel(day)}
                    <span>
                      {new Date(dayEntries[0].startedAt).toLocaleDateString('uk-UA', {
                        weekday: 'long',
                      })}
                    </span>
                    <span className="dg-total">
                      {formatDuration(daySeconds)} · {formatMoney(dayAmount, settings.currency)}
                    </span>
                  </div>
                  <div className="entry-list">
                    {dayEntries.map((entry) => {
                      const task = entry.taskId ? tasks.find((item) => item.id === entry.taskId) : undefined
                      const list = lists.find((item) => item.id === entry.listId)
                      const amount = amountForEntry(entry, entries, lists, settings)
                      return (
                        <div className="entry-row" key={entry.id}>
                          <div className="entry-ico">
                            <Clock size={15} />
                          </div>
                          <div className="entry-main">
                            <div className="entry-title">
                              {task?.title ?? (entry.note.trim() || 'Без задачі')}
                            </div>
                            <div className="entry-sub">
                              {list && (
                                <>
                                  <span className="list-dot" style={{ background: list.color, width: 7, height: 7 }} />
                                  {list.name}
                                  <span className="sep">·</span>
                                </>
                              )}
                              {formatTimeInput(entry.startedAt)}–
                              {formatTimeInput(entry.endedAt)}
                              {entry.manual && (
                                <>
                                  <span className="sep">·</span>
                                  вручну
                                </>
                              )}
                              {entry.note.trim() && task && (
                                <>
                                  <span className="sep">·</span>
                                  {entry.note}
                                </>
                              )}
                              {amount.overtimeSeconds > 0 && (
                                <>
                                  <span className="sep">·</span>
                                  <span style={{ color: 'var(--warning)' }}>
                                    +{formatDuration(amount.overtimeSeconds)} понаднормово
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="entry-dur">{formatDuration(entry.seconds)}</div>
                          <div className="entry-amount">
                            {formatMoney(amount.amount, settings.currency)}
                            <small>{formatMoney(amount.rate, settings.currency, 0)}/год</small>
                          </div>
                          <div className="entry-actions">
                            <button
                              className="btn-icon"
                              onClick={() => {
                                deleteEntry(entry.id)
                                toast('Запис видалено')
                              }}
                              aria-label="Видалити запис"
                              title="Видалити запис"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {availableTasks.length === 0 && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="muted" style={{ marginBottom: 10 }}>
              Немає активних задач для відстеження.
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setView({ kind: 'smart', id: 'all' })}>
              <Plus size={14} /> Створити задачу
            </button>
          </div>
        )}
      </div>

      <ManualEntryDialog open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  )
}
