import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  Clock,
  ListChecks,
  Play,
  Plus,
  Repeat2,
  Square,
  Star,
  Sun,
  Tag,
  Timer,
  Trash2,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import {
  amountForEntry,
  cn,
  formatClock,
  formatDateInput,
  formatDuration,
  formatMoney,
  formatTimeInput,
  repeatLabel,
  todayKey,
} from '../lib/utils'
import { useAppStore } from '../store'
import { usePomodoro, pomodoroRemaining } from '../lib/pomodoro'
import { ConfirmDialog, RoundCheck, useTick, toast } from './ui'
import { ManualEntryDialog } from './ManualEntryDialog'
import { tagColor } from '../constants'
import type { RepeatFreq } from '../types'

function toLocalDateTime(ms: number | null): string {
  if (!ms) return ''
  const date = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export function TaskDetails() {
  const selectedTaskId = useAppStore((state) => state.selectedTaskId)
  const selectTask = useAppStore((state) => state.selectTask)
  const tasks = useAppStore((state) => state.tasks)
  const lists = useAppStore((state) => state.lists)
  const entries = useAppStore((state) => state.entries)
  const settings = useAppStore((state) => state.settings)
  const activeTimer = useAppStore((state) => state.activeTimer)
  const updateTask = useAppStore((state) => state.updateTask)
  const toggleTask = useAppStore((state) => state.toggleTask)
  const toggleImportant = useAppStore((state) => state.toggleImportant)
  const toggleMyDay = useAppStore((state) => state.toggleMyDay)
  const deleteTask = useAppStore((state) => state.deleteTask)
  const addStep = useAppStore((state) => state.addStep)
  const toggleStep = useAppStore((state) => state.toggleStep)
  const deleteStep = useAppStore((state) => state.deleteStep)
  const startTimer = useAppStore((state) => state.startTimer)
  const stopTimer = useAppStore((state) => state.stopTimer)
  const deleteEntry = useAppStore((state) => state.deleteEntry)

  const task = tasks.find((item) => item.id === selectedTaskId)
  const [stepTitle, setStepTitle] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const startPomodoro = usePomodoro((state) => state.startWork)
  const pomodoroPhase = usePomodoro((state) => state.phase)
  const pomodoroTaskId = usePomodoro((state) => state.taskId)
  const pomodoroEndsAt = usePomodoro((state) => state.endsAt)
  const pomodoroRemainingMs = usePomodoro((state) => state.remainingMs)
  const pausePomodoro = usePomodoro((state) => state.pause)
  const resumePomodoro = usePomodoro((state) => state.resume)
  const stopPomodoro = usePomodoro((state) => state.stop)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const now = useTick(1000)

  const title = task?.title ?? ''
  const notes = task?.notes ?? ''

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 30)}px`
  }, [title, selectedTaskId])

  const taskEntries = useMemo(
    () =>
      task
        ? entries
            .filter((entry) => entry.taskId === task.id)
            .sort((a, b) => b.startedAt - a.startedAt)
        : [],
    [entries, task],
  )

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const item of tasks) {
      for (const tag of item.tags) tags.add(tag)
    }
    return [...tags].sort((a, b) => a.localeCompare(b, 'uk')).slice(0, 16)
  }, [tasks])

  if (!task) return null

  const list = lists.find((item) => item.id === task.listId)
  const isRunning = activeTimer !== null && activeTimer.taskId === task.id
  const elapsed =
    isRunning && activeTimer ? Math.max(0, Math.round((now - activeTimer.startedAt) / 1000)) : 0
  const totalSeconds = taskEntries.reduce((sum, entry) => sum + entry.seconds, 0)
  const todaySeconds = taskEntries
    .filter((entry) => formatDateInput(entry.startedAt) === todayKey())
    .reduce((sum, entry) => sum + entry.seconds, 0)
  const totalAmount = taskEntries.reduce(
    (sum, entry) => sum + amountForEntry(entry, entries, lists, settings).amount,
    0,
  )
  const doneSteps = task.steps.filter((step) => step.done).length
  const isMyDay = task.myDayDate === todayKey()
  const pomodoroActive = pomodoroPhase === 'work' && pomodoroTaskId === task.id
  const pomodoroLeft = pomodoroActive
    ? pomodoroRemaining(pomodoroEndsAt, pomodoroRemainingMs)
    : 0
  const pomodoroPaused = pomodoroActive && !pomodoroEndsAt

  const submitStep = () => {
    const value = stepTitle.trim()
    if (!value) return
    addStep(task.id, value)
    setStepTitle('')
  }

  const addTag = (raw: string) => {
    const value = raw
      .trim()
      .replace(/^#/, '')
      .replace(/\s+/g, '-')
      .slice(0, 30)
    if (!value) return
    if (task.tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setTagDraft('')
      return
    }
    updateTask(task.id, { tags: [...task.tags, value] })
    setTagDraft('')
  }

  const removeTag = (tag: string) => {
    updateTask(task.id, { tags: task.tags.filter((item) => item !== tag) })
  }

  const setRepeat = (freq: RepeatFreq | 'none') => {
    if (freq === 'none') {
      updateTask(task.id, { repeat: null })
      return
    }
    updateTask(task.id, {
      repeat: { freq, interval: task.repeat?.interval ?? 1 },
      dueDate: task.dueDate ?? todayKey(),
    })
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={() => selectTask(null)} />
      <aside className="drawer" aria-label="Деталі задачі">
        <div className="drawer-head">
          <span className="drawer-head-title">Задача</span>
          <button className="btn-icon" onClick={() => selectTask(null)} aria-label="Закрити">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-task-head">
            <RoundCheck
              checked={task.completed}
              onClick={() => toggleTask(task.id)}
              label="Позначити виконаною"
            />
            <textarea
              ref={titleRef}
              className="detail-title"
              value={task.title}
              rows={1}
              onChange={(event) => updateTask(task.id, { title: event.target.value })}
              placeholder="Назва задачі"
            />
          </div>

          <div className="detail-list-row">
            <span className="list-dot" style={{ background: list?.color ?? 'var(--accent)' }} />
            <select
              value={task.listId}
              onChange={(event) => updateTask(task.id, { listId: event.target.value })}
              aria-label="Список"
            >
              {lists.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span className="spacer" />
            <button
              className={cn('btn-icon', task.important && 'starred')}
              style={{ width: 30, height: 30, color: task.important ? '#d99a00' : undefined }}
              onClick={() => toggleImportant(task.id)}
              title={task.important ? 'Прибрати з важливих' : 'Позначити важливою'}
              aria-label="Важливість"
            >
              <Star size={16} fill={task.important ? 'currentColor' : 'none'} />
            </button>
            <button
              className="btn-icon"
              style={{ width: 30, height: 30, color: isMyDay ? 'var(--accent-strong)' : undefined }}
              onClick={() => toggleMyDay(task.id)}
              title={isMyDay ? 'Прибрати з Мого дня' : 'Додати в Мій день'}
              aria-label="Мій день"
            >
              <Sun size={16} />
            </button>
          </div>

          <div className="detail-section">
            <div className="detail-label">
              <ListChecks size={13} /> Кроки
              {task.steps.length > 0 && (
                <span className="dim" style={{ letterSpacing: 0, textTransform: 'none' }}>
                  {doneSteps}/{task.steps.length}
                </span>
              )}
            </div>
            <div className="step-list">
              {task.steps.map((step) => (
                <div key={step.id} className={cn('step-row', step.done && 'done')}>
                  <button
                    className={cn('step-check', step.done && 'done')}
                    onClick={() => toggleStep(task.id, step.id)}
                    aria-label="Позначити крок"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12l5 5L20 7"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <span className="step-title">{step.title}</span>
                  <button
                    className="step-del"
                    onClick={() => deleteStep(task.id, step.id)}
                    aria-label="Видалити крок"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <div className="step-add">
                <Plus size={14} />
                <input
                  value={stepTitle}
                  onChange={(event) => setStepTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submitStep()
                  }}
                  placeholder="Додати крок"
                />
                {stepTitle.trim() && (
                  <button className="btn btn-sm btn-ghost" onClick={submitStep}>
                    Додати
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-label">
              <Tag size={13} /> Теги
              {task.tags.length > 0 && (
                <span className="dim" style={{ letterSpacing: 0, textTransform: 'none' }}>
                  {task.tags.length}
                </span>
              )}
            </div>
            {task.tags.length > 0 && (
              <div className="tag-editor">
                {task.tags.map((tag) => (
                  <span
                    className="tag-chip editable"
                    key={tag}
                    style={{ color: tagColor(tag), background: `${tagColor(tag)}16` }}
                  >
                    #{tag}
                    <button onClick={() => removeTag(tag)} aria-label={`Прибрати тег ${tag}`}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="tag-add">
              <Tag size={13} />
              <input
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault()
                    addTag(tagDraft)
                  }
                  if (event.key === 'Backspace' && !tagDraft && task.tags.length > 0) {
                    removeTag(task.tags[task.tags.length - 1])
                  }
                }}
                placeholder="Додати тег і Enter"
                aria-label="Новий тег"
              />
              {tagDraft.trim() && (
                <button className="btn btn-sm btn-ghost" onClick={() => addTag(tagDraft)}>
                  Додати
                </button>
              )}
            </div>
            {allTags.filter(
              (tag) =>
                !task.tags.some((item) => item.toLowerCase() === tag.toLowerCase()) &&
                (!tagDraft.trim() || tag.toLowerCase().includes(tagDraft.trim().toLowerCase())),
            ).length > 0 && (
              <div className="tag-suggest">
                {allTags
                  .filter(
                    (tag) =>
                      !task.tags.some((item) => item.toLowerCase() === tag.toLowerCase()) &&
                      (!tagDraft.trim() ||
                        tag.toLowerCase().includes(tagDraft.trim().toLowerCase())),
                  )
                  .slice(0, 8)
                  .map((tag) => (
                    <button
                      key={tag}
                      className="tag-suggest-item"
                      onClick={() => addTag(tag)}
                      style={{ color: tagColor(tag) }}
                    >
                      #{tag}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="detail-section">
            <div className="detail-label">Нотатки</div>
            <textarea
              className="detail-note"
              value={notes}
              onChange={(event) => updateTask(task.id, { notes: event.target.value })}
              placeholder="Додайте деталі, посилання або коментар…"
            />
          </div>

          <div className="detail-section">
            <div className="detail-label">
              <CalendarDays size={13} /> Планування
            </div>
            <div className="meta-grid">
              <label className="field">
                <span className="field-label">Дата</span>
                <input
                  className="input"
                  type="date"
                  value={task.dueDate ?? ''}
                  onChange={(event) =>
                    updateTask(task.id, {
                      dueDate: event.target.value || null,
                      dueTime: event.target.value ? task.dueTime : null,
                    })
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Час</span>
                <input
                  className="input"
                  type="time"
                  value={task.dueTime ?? ''}
                  onChange={(event) =>
                    updateTask(task.id, {
                      dueTime: event.target.value || null,
                      dueDate: task.dueDate ?? (event.target.value ? todayKey() : null),
                    })
                  }
                  disabled={!task.dueDate}
                />
              </label>
            </div>
            <div className="meta-grid" style={{ marginTop: 10 }}>
              <label className="field">
                <span className="field-label">Нагадування</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={toLocalDateTime(task.reminderAt)}
                  onChange={(event) =>
                    updateTask(task.id, {
                      reminderAt: event.target.value ? new Date(event.target.value).getTime() : null,
                      notifiedAt: null,
                    })
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Оцінка, хв</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="5"
                  placeholder="—"
                  value={task.estimateMinutes ?? ''}
                  onChange={(event) =>
                    updateTask(task.id, {
                      estimateMinutes: event.target.value
                        ? Math.max(0, Number(event.target.value))
                        : null,
                    })
                  }
                />
              </label>
            </div>
            <div className="repeat-row">
              <span className="field-label">
                <Repeat2 size={12} /> Повторення
              </span>
              <div className="repeat-controls">
                <select
                  className="input"
                  value={task.repeat?.freq ?? 'none'}
                  onChange={(event) => setRepeat(event.target.value as RepeatFreq | 'none')}
                  aria-label="Частота повторення"
                >
                  <option value="none">Не повторювати</option>
                  <option value="daily">Щодня</option>
                  <option value="weekdays">По буднях</option>
                  <option value="weekly">Щотижня</option>
                  <option value="monthly">Щомісяця</option>
                  <option value="yearly">Щороку</option>
                </select>
                {task.repeat && task.repeat.freq !== 'weekdays' && (
                  <label className="repeat-interval">
                    <span>кожні</span>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max="365"
                      value={task.repeat.interval}
                      onChange={(event) =>
                        updateTask(task.id, {
                          repeat: {
                            freq: task.repeat!.freq,
                            interval: Math.max(1, Math.min(365, Number(event.target.value) || 1)),
                          },
                        })
                      }
                    />
                  </label>
                )}
              </div>
              {task.repeat && (
                <div className="repeat-hint">
                  {repeatLabel(task.repeat)} · наступна копія створиться після виконання
                </div>
              )}
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-label">
              <Timer size={13} /> Час
              <span className="spacer" />
              <button className="btn btn-sm btn-ghost" onClick={() => setManualOpen(true)}>
                <Plus size={13} /> Вручну
              </button>
            </div>
            <div className="detail-stats">
              <div className="detail-stat">
                <span>Усього</span>
                <b>{formatDuration(totalSeconds)}</b>
              </div>
              <div className="detail-stat">
                <span>Сьогодні</span>
                <b>{formatDuration(todaySeconds)}</b>
              </div>
              <div className="detail-stat" style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <span>Вартість</span>
                <b>{formatMoney(totalAmount, settings.currency)}</b>
              </div>
            </div>

            {isRunning ? (
              <div className="detail-timer-bar">
                <span className="live-dot" />
                <span className="muted" style={{ fontSize: 12 }}>
                  Іде запис
                </span>
                <span className="timer-clock" style={{ marginLeft: 'auto' }}>
                  {formatClock(elapsed)}
                </span>
                <button className="btn btn-sm btn-danger" onClick={stopTimer}>
                  <Square size={12} fill="currentColor" /> Стоп
                </button>
              </div>
            ) : (
              <div className="timer-actions">
                <button
                  className="btn btn-soft"
                  onClick={() => startTimer(task.id)}
                  disabled={task.completed}
                >
                  <Play size={14} /> Запустити таймер
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => startPomodoro(task.id)}
                  disabled={task.completed}
                  title={`Фокус ${settings.pomodoroWorkMinutes} хв`}
                >
                  <Zap size={14} /> Pomodoro {settings.pomodoroWorkMinutes} хв
                </button>
              </div>
            )}

            {pomodoroActive && (
              <div className="pomodoro-strip">
                <span className="pomodoro-strip-icon">
                  <Zap size={13} />
                </span>
                <span className="pomodoro-strip-label">
                  {pomodoroPaused ? 'Пауза' : 'Фокус'}
                </span>
                <b>{formatClock(Math.ceil(pomodoroLeft / 1000))}</b>
                <span className="spacer" />
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => (pomodoroPaused ? resumePomodoro() : pausePomodoro())}
                >
                  {pomodoroPaused ? 'Далі' : 'Пауза'}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={stopPomodoro}>
                  Стоп
                </button>
              </div>
            )}

            {taskEntries.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {taskEntries.slice(0, 6).map((entry) => {
                  const amount = amountForEntry(entry, entries, lists, settings)
                  return (
                    <div className="entry-mini" key={entry.id}>
                      <Clock size={12} className="dim" />
                      <time>
                        {formatDateInput(entry.startedAt) === todayKey()
                          ? 'Сьогодні'
                          : new Date(entry.startedAt).toLocaleDateString('uk-UA', {
                              day: 'numeric',
                              month: 'short',
                            })}
                        , {formatTimeInput(entry.startedAt)}
                      </time>
                      <span>{formatDuration(entry.seconds)}</span>
                      {amount.overtimeSeconds > 0 && <span className="badge accent">+понад</span>}
                      <b>{formatMoney(amount.amount, settings.currency)}</b>
                      <button
                        className="btn-icon"
                        style={{ width: 24, height: 24 }}
                        onClick={() => deleteEntry(entry.id)}
                        aria-label="Видалити запис"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )
                })}
                {taskEntries.length > 6 && (
                  <div className="field-hint" style={{ paddingTop: 6 }}>
                    Ще {taskEntries.length - 6} записів — у розділі «Трекер часу»
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="detail-section">
            <div className="detail-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
              <span className="field-hint">
                Створено{' '}
                {new Date(task.createdAt).toLocaleDateString('uk-UA', {
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
              <span className="spacer" />
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={13} /> Видалити
              </button>
            </div>
          </div>

          <div className="field-hint" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Wallet size={12} />
            Ставка списку: {formatMoney(list && list.hourlyRate !== null ? list.hourlyRate : settings.hourlyRate, settings.currency, 0)}/год
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmDelete}
        title="Видалити задачу?"
        text={
          <>
            «{task.title}» буде видалено разом із {taskEntries.length} записами часу. Цю дію не можна
            скасувати.
          </>
        }
        confirmLabel="Видалити задачу"
        onConfirm={() => {
          deleteTask(task.id)
          selectTask(null)
          toast('Задачу видалено')
        }}
        onClose={() => setConfirmDelete(false)}
      />

      <ManualEntryDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        presetTaskId={task.id}
        presetListId={task.listId}
      />
    </>
  )
}
