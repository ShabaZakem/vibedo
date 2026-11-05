import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  ListTodo,
  Pencil,
  Play,
  Plus,
  Repeat2,
  Search,
  Square,
  Star,
  Sun,
  Trash2,
} from 'lucide-react'
import {
  dueLabelTone,
  formatClock,
  formatDateInput,
  formatDueLabel,
  formatDuration,
  formatLongDate,
  formatMoney,
  isOverdue,
  parseQuickAdd,
  pluralizeUk,
  rangeFor,
  calcSalary,
  cn,
  repeatLabel,
  todayKey,
} from '../lib/utils'
import { useAppStore } from '../store'
import type { SortMode, Task, TaskList } from '../types'
import { ConfirmDialog, LogoMark, RoundCheck, toast, useTick } from './ui'
import { ListDialog } from './Sidebar'
import { tagColor } from '../constants'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Доброї ночі'
  if (hour < 12) return 'Доброго ранку'
  if (hour < 18) return 'Доброго дня'
  return 'Доброго вечора'
}

function TaskRow({
  task,
  list,
  showList,
  now,
  active,
}: {
  task: Task
  list?: TaskList
  showList: boolean
  now: number
  active: boolean
}) {
  const selectTask = useAppStore((state) => state.selectTask)
  const toggleTask = useAppStore((state) => state.toggleTask)
  const toggleImportant = useAppStore((state) => state.toggleImportant)
  const startTimer = useAppStore((state) => state.startTimer)
  const stopTimer = useAppStore((state) => state.stopTimer)
  const activeTimer = useAppStore((state) => state.activeTimer)
  const selectedTaskId = useAppStore((state) => state.selectedTaskId)

  const doneSteps = task.steps.filter((step) => step.done).length
  const tone = dueLabelTone(task)
  const elapsed = active && activeTimer ? Math.max(0, Math.round((now - activeTimer.startedAt) / 1000)) : 0

  return (
    <div
      className={cn(
        'task-row',
        task.completed && 'is-done',
        selectedTaskId === task.id && 'is-selected',
      )}
      onClick={() => selectTask(task.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') selectTask(task.id)
        if (event.key === ' ') {
          event.preventDefault()
          toggleTask(task.id)
        }
      }}
    >
      <RoundCheck checked={task.completed} onClick={() => toggleTask(task.id)} label="Виконано" />
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        {task.notes.trim() && <div className="task-note-preview">{task.notes}</div>}
        <div className="task-meta">
          {showList && list && (
            <span className="chip">
              <span className="dot" style={{ background: list.color }} />
              {list.name}
            </span>
          )}
          {task.dueDate && (
            <span className={cn('chip', tone)}>
              <CalendarDays size={11} />
              {isOverdue(task) ? 'Прострочено · ' : ''}
              {formatDueLabel(task.dueDate, task.dueTime)}
            </span>
          )}
          {task.repeat && (
            <span className="chip repeat-chip">
              <Repeat2 size={11} /> {repeatLabel(task.repeat)}
            </span>
          )}
          {task.tags.slice(0, 3).map((tag) => (
            <span
              className="tag-chip"
              key={tag}
              style={{ color: tagColor(tag), background: `${tagColor(tag)}14` }}
            >
              #{tag}
            </span>
          ))}
          {task.tags.length > 3 && <span className="tag-chip more">+{task.tags.length - 3}</span>}
          {task.steps.length > 0 && (
            <span className="steps-progress">
              <span className="steps-track">
                <span
                  className="steps-fill"
                  style={{ width: `${(doneSteps / task.steps.length) * 100}%` }}
                />
              </span>
              {doneSteps}/{task.steps.length}
            </span>
          )}
          {task.estimateMinutes ? (
            <span className="chip">
              <Clock size={11} /> {task.estimateMinutes} хв
            </span>
          ) : null}
          {active && (
            <span className="chip timer-chip">
              <span className="live-dot" style={{ width: 5, height: 5 }} />
              {formatClock(elapsed)}
            </span>
          )}
        </div>
      </div>
      <div className="task-actions">
        <button
          className={cn('btn-icon', task.important && 'starred')}
          onClick={(event) => {
            event.stopPropagation()
            toggleImportant(task.id)
          }}
          aria-label="Важливо"
          title="Позначити важливою"
        >
          <Star size={15} fill={task.important ? 'currentColor' : 'none'} />
        </button>
        <button
          className={cn('btn-icon', active && 'timer-on')}
          onClick={(event) => {
            event.stopPropagation()
            if (active) stopTimer()
            else startTimer(task.id)
          }}
          aria-label={active ? 'Зупинити таймер' : 'Запустити таймер'}
          title={active ? 'Зупинити таймер' : 'Запустити таймер'}
          disabled={task.completed}
        >
          {active ? <Square size={13} fill="currentColor" /> : <Play size={15} />}
        </button>
      </div>
    </div>
  )
}

const SORT_LABELS: Record<SortMode, string> = {
  created: 'Спочатку нові',
  due: 'За датою',
  important: 'За важливістю',
  alpha: 'За назвою',
}

function sortTasks(tasks: Task[], sort: SortMode): Task[] {
  const copy = [...tasks]
  if (sort === 'due') {
    copy.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? '').localeCompare(b.dueTime ?? '')
    })
  } else if (sort === 'important') {
    copy.sort((a, b) => Number(b.important) - Number(a.important) || b.createdAt - a.createdAt)
  } else if (sort === 'alpha') {
    copy.sort((a, b) => a.title.localeCompare(b.title, 'uk'))
  } else {
    copy.sort((a, b) => b.createdAt - a.createdAt)
  }
  return copy
}

export function TaskView() {
  const view = useAppStore((state) => state.view)
  const tasks = useAppStore((state) => state.tasks)
  const lists = useAppStore((state) => state.lists)
  const entries = useAppStore((state) => state.entries)
  const settings = useAppStore((state) => state.settings)
  const activeTimer = useAppStore((state) => state.activeTimer)
  const search = useAppStore((state) => state.search)
  const setSearch = useAppStore((state) => state.setSearch)
  const sort = useAppStore((state) => state.sort)
  const setSort = useAppStore((state) => state.setSort)
  const addTask = useAppStore((state) => state.addTask)
  const clearCompleted = useAppStore((state) => state.clearCompleted)

  const [draft, setDraft] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [editList, setEditList] = useState<TaskList | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const now = useTick(1000)

  useEffect(() => {
    setTagFilter(null)
  }, [view])

  const allTags = useMemo(() => {
    const tags = new Map<string, number>()
    for (const task of tasks) {
      for (const tag of task.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1)
    }
    return [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  }, [tasks])

  const list = view.kind === 'list' ? lists.find((item) => item.id === view.id) : undefined
  const today = todayKey()
  const smartId = view.kind === 'smart' ? view.id : null

  const scope = useMemo(() => {
    let scoped = tasks
    if (view.kind === 'list') scoped = tasks.filter((task) => task.listId === view.id)
    else if (smartId === 'myday') scoped = tasks.filter((task) => task.myDayDate === today)
    else if (smartId === 'important') scoped = tasks.filter((task) => task.important)
    else if (smartId === 'planned') scoped = tasks.filter((task) => Boolean(task.dueDate))
    return scoped
  }, [tasks, view, smartId, today])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return scope.filter((task) => {
      if (tagFilter && !task.tags.some((tag) => tag.toLowerCase() === tagFilter.toLowerCase())) {
        return false
      }
      if (!query) return true
      const haystack = [
        task.title,
        task.notes,
        ...task.tags,
        ...task.steps.map((step) => step.title),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [scope, search, tagFilter])

  const activeTasks = sortTasks(
    filtered.filter((task) => !task.completed),
    sort,
  )
  const completedTasks = sortTasks(
    filtered.filter((task) => task.completed),
    'created',
  )

  const title =
    view.kind === 'list'
      ? list?.name ?? 'Список'
      : smartId === 'myday'
        ? 'Мій день'
        : smartId === 'important'
          ? 'Важливі'
          : smartId === 'planned'
            ? 'Заплановані'
            : 'Усі задачі'

  const subtitle =
    view.kind === 'list'
      ? `${activeTasks.length} ${pluralizeUk(activeTasks.length, ['активна задача', 'активні задачі', 'активних задач'])}`
      : smartId === 'myday'
        ? formatLongDate(new Date())
        : smartId === 'important'
          ? 'Задачі, які ви позначили важливими'
          : smartId === 'planned'
            ? 'Усі задачі з датою виконання'
            : 'Все, що є у вашому просторі'

  const todayEntries = useMemo(
    () => entries.filter((entry) => formatDateInput(entry.startedAt) === today),
    [entries, today],
  )
  const todaySeconds =
    todayEntries.reduce((sum, entry) => sum + entry.seconds, 0) +
    (activeTimer && formatDateInput(activeTimer.startedAt) === today
      ? Math.max(0, Math.round((now - activeTimer.startedAt) / 1000))
      : 0)
  const todaySalary = calcSalary(entries, lists, settings, rangeFor('today'))
  const myDayTotal = scope.length
  const myDayDone = scope.filter((task) => task.completed).length

  const submit = () => {
    const value = draft.trim()
    if (!value) return
    const parsed = parseQuickAdd(value)
    addTask({
      title: parsed.title || value,
      listId: view.kind === 'list' ? view.id : undefined,
      myDay: smartId === 'myday',
      important: smartId === 'important',
      dueDate: parsed.dueDate ?? (smartId === 'planned' ? today : null),
      dueTime: parsed.dueTime,
      tags: parsed.tags,
      repeat: parsed.repeat,
    })
    setDraft('')
    inputRef.current?.focus()
  }

  const draftPreview = draft.trim() ? parseQuickAdd(draft) : null

  return (
    <div className="view">
      <header className="view-header">
        <div className="view-heading">
          <div className="eyebrow">VibeDo</div>
          <h1 className="title">
            {list && <span className="title-dot" style={{ background: list.color }} />}
            {title}
            {list && (
              <button
                className="btn-icon"
                style={{ width: 30, height: 30 }}
                onClick={() => setEditList(list)}
                aria-label="Редагувати список"
                title="Редагувати список"
              >
                <Pencil size={15} />
              </button>
            )}
          </h1>
          <div className="subtitle">
            {subtitle}
            {smartId === 'myday' && (
              <>
                <span className="dim">·</span>
                <span>
                  {myDayDone} з {myDayTotal} виконано
                </span>
              </>
            )}
          </div>
        </div>
        <div className="header-tools">
          <div className="search">
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Пошук задач"
              aria-label="Пошук задач"
            />
          </div>
          <select
            className="sort-select"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
            aria-label="Сортування"
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {SORT_LABELS[mode]}
              </option>
            ))}
          </select>
        </div>
      </header>

      {allTags.length > 0 && (
        <div className="tag-filter-row">
          <button
            className={cn('tag-filter', !tagFilter && 'active')}
            onClick={() => setTagFilter(null)}
          >
            Усі
          </button>
          {allTags.map(([tag, count]) => (
            <button
              key={tag}
              className={cn('tag-filter', tagFilter === tag && 'active')}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              style={tagFilter === tag ? { background: `${tagColor(tag)}18`, color: tagColor(tag) } : undefined}
            >
              #{tag}
              <span>{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="view-body">
        <div className="view-inner">
          {smartId === 'myday' && (
            <section className="hero">
              <div>
                <div className="hero-greeting">
                  {greeting()}
                  {settings.firstName.trim() ? `, ${settings.firstName.trim()}` : ''}
                </div>
                <div className="hero-date">{formatLongDate(new Date())}</div>
                <div className="hero-stats">
                  <div className="hero-stat">
                    <span>Задачі</span>
                    <b>
                      {myDayDone} / {myDayTotal}
                    </b>
                    <small>{myDayTotal - myDayDone > 0 ? 'ще є час' : 'усе під контролем'}</small>
                  </div>
                  <div className="hero-stat">
                    <span>Час сьогодні</span>
                    <b>{formatDuration(todaySeconds)}</b>
                    <small>норма {settings.dailyNormHours} год</small>
                  </div>
                  <div className="hero-stat">
                    <span>Заробіток</span>
                    <b style={{ color: 'var(--success)' }}>
                      {formatMoney(todaySalary.gross, settings.currency, 0)}
                    </b>
                    <small>{formatMoney(todaySalary.net, settings.currency, 0)} на руки</small>
                  </div>
                </div>
              </div>
              <div className="hero-ring">
                <div className="ring-wrap">
                  <svg width="92" height="92">
                    <circle
                      cx="46"
                      cy="46"
                      r="39"
                      fill="none"
                      stroke="var(--surface-3)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="46"
                      cy="46"
                      r="39"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 39}
                      strokeDashoffset={
                        2 *
                        Math.PI *
                        39 *
                        (1 -
                          Math.min(
                            1,
                            todaySeconds / Math.max(1, settings.dailyNormHours * 3600),
                          ))
                      }
                      transform="rotate(-90 46 46)"
                      style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                  </svg>
                  <div className="ring-center">
                    <b>{Math.floor(todaySeconds / 3600)}</b>
                    <span>годин</span>
                  </div>
                </div>
                <div className="hero-money">
                  <span>Сьогодні зароблено</span>
                  <b>{formatMoney(todaySalary.gross, settings.currency, 0)}</b>
                  <small>
                    {Math.floor(todaySeconds / 60)} хв ·{' '}
                    {formatMoney(todaySalary.net, settings.currency, 0)} після податків
                  </small>
                </div>
              </div>
            </section>
          )}

          <div className="quick-add">
            <span className="qa-plus">
              <Plus size={19} />
            </span>
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
                if (event.key === 'Escape') setDraft('')
              }}
              placeholder={
                smartId === 'myday'
                  ? 'Додати задачу в Мій день…'
                  : smartId === 'important'
                    ? 'Додати важливу задачу…'
                    : smartId === 'planned'
                      ? 'Додати задачу на сьогодні…'
                      : `Додати задачу${list ? ` у «${list.name}»` : ''}…`
              }
              aria-label="Нова задача"
              data-quick-add
            />
            <span className="qa-hint">Enter</span>
            <button
              className="btn btn-primary btn-sm qa-submit"
              onClick={submit}
              disabled={!draft.trim()}
            >
              Додати
            </button>
          </div>
          {draftPreview && (draftPreview.dueDate || draftPreview.tags.length > 0 || draftPreview.repeat) && (
            <div className="qa-preview">
              {draftPreview.dueDate && (
                <span>
                  <CalendarDays size={11} /> {formatDueLabel(draftPreview.dueDate, draftPreview.dueTime)}
                </span>
              )}
              {draftPreview.repeat && (
                <span>
                  <Repeat2 size={11} /> {repeatLabel(draftPreview.repeat)}
                </span>
              )}
              {draftPreview.tags.map((tag) => (
                <span key={tag} style={{ color: tagColor(tag) }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {activeTasks.length === 0 && completedTasks.length === 0 ? (
            <div className="empty">
              <div className="empty-art">
                {smartId === 'myday' ? (
                  <Sun size={38} />
                ) : smartId === 'planned' ? (
                  <CalendarDays size={38} />
                ) : smartId === 'important' ? (
                  <Star size={38} />
                ) : smartId === 'all' ? (
                  <ListTodo size={38} />
                ) : (
                  <LogoMark size={38} />
                )}
              </div>
              <div className="empty-title">
                {search.trim() ? 'Нічого не знайдено' : 'Тут поки що порожньо'}
              </div>
              <div className="empty-text">
                {search.trim()
                  ? 'Спробуйте інший запит або очистіть пошук.'
                  : smartId === 'myday'
                    ? 'Додайте задачі на сьогодні — і почніть фокусуватися. Нові задачі з’являться тут, якщо додати їх у Мій день.'
                    : 'Створіть першу задачу у полі вище. Усе зберігається локально на вашому комп’ютері.'}
              </div>
              {smartId === 'all' && !search.trim() && (
                <div className="empty-actions">
                  <button
                    className="btn btn-soft btn-sm"
                    onClick={() =>
                      addTask({ title: 'Моя перша задача', myDay: true, important: true })
                    }
                  >
                    <Plus size={14} /> Створити приклад
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {activeTasks.length > 0 && (
                <div className="task-group">
                  <div className="group-head">
                    Активні <span className="count">{activeTasks.length}</span>
                  </div>
                  <div className="task-list">
                    {activeTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        list={lists.find((item) => item.id === task.listId)}
                        showList={view.kind !== 'list'}
                        now={now}
                        active={activeTimer?.taskId === task.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {completedTasks.length > 0 && (
                <div className="task-group">
                  <div className="group-head">
                    <button className="group-toggle" onClick={() => setShowCompleted((value) => !value)}>
                      {showCompleted ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      Виконано <span className="count">{completedTasks.length}</span>
                    </button>
                    {showCompleted && (
                      <button onClick={() => setConfirmClear(true)}>
                        <Trash2 size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
                        Очистити
                      </button>
                    )}
                  </div>
                  {showCompleted && (
                    <div className="task-list">
                      {completedTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          list={lists.find((item) => item.id === task.listId)}
                          showList={view.kind !== 'list'}
                          now={now}
                          active={false}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Очистити виконані?"
        text={`Буде назавжди видалено ${completedTasks.length} ${pluralizeUk(completedTasks.length, [
          'виконану задачу',
          'виконані задачі',
          'виконаних задач',
        ])} разом із записами часу.`}
        confirmLabel="Очистити"
        onConfirm={() => {
          clearCompleted(view.kind === 'list' ? view.id : undefined)
          toast('Виконані задачі очищено')
        }}
        onClose={() => setConfirmClear(false)}
      />

      <ListDialog
        open={Boolean(editList)}
        list={editList}
        onClose={() => setEditList(null)}
      />
    </div>
  )
}
