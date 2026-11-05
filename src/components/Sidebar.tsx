import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  Clock,
  ListTodo,
  Pencil,
  Plus,
  Settings2,
  Star,
  Sun,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { formatMoney, cn, formatDateInput } from '../lib/utils'
import { getAppInfo, isDesktopApp } from '../lib/storage'
import { saveNow, useSaveStatus } from '../lib/persist'
import { useAppStore } from '../store'
import { useUIStore } from '../lib/ui-store'
import { LIST_COLORS } from '../constants'
import type { TaskList, View } from '../types'
import { ConfirmDialog, LogoMark, Modal, Switch, toast } from './ui'
import { useTick } from './ui'

export function ListDialog({
  open,
  list,
  onClose,
}: {
  open: boolean
  list: TaskList | null
  onClose: () => void
}) {
  const addList = useAppStore((state) => state.addList)
  const updateList = useAppStore((state) => state.updateList)
  const deleteList = useAppStore((state) => state.deleteList)
  const lists = useAppStore((state) => state.lists)
  const tasks = useAppStore((state) => state.tasks)
  const [name, setName] = useState('')
  const [color, setColor] = useState(LIST_COLORS[0])
  const [hasRate, setHasRate] = useState(false)
  const [rate, setRate] = useState('250')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(list?.name ?? '')
    setColor(list?.color ?? LIST_COLORS[lists.length % LIST_COLORS.length])
    setHasRate(list ? list.hourlyRate !== null : false)
    setRate(String(list?.hourlyRate ?? 250))
  }, [open, list, lists.length])

  const count = list ? tasks.filter((task) => task.listId === list.id).length : 0

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const parsedRate = hasRate ? Math.max(0, Number(rate.replace(',', '.')) || 0) : null
    if (list) {
      updateList(list.id, { name: trimmed, color, hourlyRate: parsedRate })
      toast('Список оновлено')
    } else {
      const id = addList(trimmed, color)
      updateList(id, { hourlyRate: parsedRate })
      toast('Список створено')
    }
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        title={list ? 'Редагувати список' : 'Новий список'}
        onClose={onClose}
        footer={
          <>
            {list && lists.length > 1 && (
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> Видалити
              </button>
            )}
            <span className="spacer" />
            <button className="btn btn-soft" onClick={onClose}>
              Скасувати
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={!name.trim()}>
              {list ? 'Зберегти' : 'Створити'}
            </button>
          </>
        }
      >
        <label className="field">
          <span className="field-label">Назва</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Наприклад, Робота"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
        </label>
        <div className="field">
          <span className="field-label">Колір</span>
          <div className="colors-row">
            {LIST_COLORS.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={`Колір ${item}`}
                className={cn('color-chip', color === item && 'active')}
                style={{ background: item, color: item }}
                onClick={() => setColor(item)}
              />
            ))}
          </div>
        </div>
        <div className="setting-row" style={{ borderTop: 'none', padding: 0 }}>
          <div className="sr-main">
            <div className="sr-label">Окрема погодинна ставка</div>
            <div className="sr-desc">
              Для цього списку. Якщо вимкнено — використовується ставка з налаштувань.
            </div>
          </div>
          <Switch checked={hasRate} onChange={setHasRate} label="Окрема ставка" />
        </div>
        {hasRate && (
          <label className="field">
            <span className="field-label">Ставка за годину</span>
            <input
              className="input"
              type="number"
              min="0"
              step="10"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </label>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Видалити список?"
        text={
          <>
            Список «{list?.name}» і {count} задач у ньому буде видалено разом із записами часу. Цю дію
            не можна скасувати.
          </>
        }
        confirmLabel="Видалити список"
        onConfirm={() => {
          if (list) {
            deleteList(list.id)
            toast('Список видалено')
            onClose()
          }
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}

function SaveIndicator() {
  const status = useSaveStatus((state) => state.status)
  const lastSavedAt = useSaveStatus((state) => state.lastSavedAt)
  const error = useSaveStatus((state) => state.error)
  const [busy, setBusy] = useState(false)

  const label =
    status === 'saving'
      ? 'Зберігаємо…'
      : status === 'error'
        ? 'Помилка збереження'
        : lastSavedAt
          ? `Збережено о ${new Date(lastSavedAt).toLocaleTimeString('uk-UA', {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : 'Локальне збереження'

  return (
    <div className={cn('save-status', status === 'saving' && 'saving', status === 'error' && 'error')}>
      <span className="save-dot" />
      <span>{label}</span>
      {status === 'error' && (
        <>
          <button
            type="button"
            onClick={async () => {
              setBusy(true)
              await saveNow()
              setBusy(false)
            }}
            disabled={busy}
          >
            повторити
          </button>
          <span title={error ?? ''} style={{ cursor: 'help' }}>
            ⓘ
          </span>
        </>
      )}
    </div>
  )
}

export function Sidebar() {
  const view = useAppStore((state) => state.view)
  const setView = useAppStore((state) => state.setView)
  const lists = useAppStore((state) => state.lists)
  const tasks = useAppStore((state) => state.tasks)
  const entries = useAppStore((state) => state.entries)
  const settings = useAppStore((state) => state.settings)
  const activeTimer = useAppStore((state) => state.activeTimer)
  const selectTask = useAppStore((state) => state.selectTask)
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  const setSidebar = useUIStore((state) => state.setSidebar)
  const [listDialog, setListDialog] = useState<{ open: boolean; list: TaskList | null }>({
    open: false,
    list: null,
  })
  const [dataPath, setDataPath] = useState('')
  const now = useTick(1000)

  const navigate = (next: View) => {
    setView(next)
    setSidebar(false)
  }

  useEffect(() => {
    if (!isDesktopApp()) return
    void getAppInfo().then((info) => setDataPath(info.dataPath))
  }, [])

  const smartCounts = useMemo(() => {
    const today = formatDateInput(Date.now())
    const active = tasks.filter((task) => !task.completed)
    return {
      myday: active.filter((task) => task.myDayDate === today).length,
      important: active.filter((task) => task.important).length,
      planned: active.filter((task) => Boolean(task.dueDate)).length,
      all: active.length,
    }
  }, [tasks])

  const listCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const task of tasks) {
      if (task.completed) continue
      map.set(task.listId, (map.get(task.listId) ?? 0) + 1)
    }
    return map
  }, [tasks])

  const todaySeconds = useMemo(() => {
    const today = formatDateInput(now)
    const base = entries
      .filter((entry) => formatDateInput(entry.startedAt) === today)
      .reduce((sum, entry) => sum + entry.seconds, 0)
    if (!activeTimer) return base
    const elapsed =
      formatDateInput(activeTimer.startedAt) === today
        ? Math.max(0, Math.round((now - activeTimer.startedAt) / 1000))
        : 0
    return base + elapsed
  }, [entries, activeTimer, now])

  const todayEarnings = useMemo(() => {
    const today = formatDateInput(now)
    let total = 0
    for (const entry of entries) {
      if (formatDateInput(entry.startedAt) !== today) continue
      const rate =
        lists.find((list) => list.id === entry.listId)?.hourlyRate ?? settings.hourlyRate
      total += (entry.seconds / 3600) * rate
    }
    return total
  }, [entries, lists, settings.hourlyRate, now])

  const isActive = (kind: string, id?: string) =>
    view.kind === kind && (id === undefined || (view.kind === 'list' && view.id === id) ||
      (view.kind === 'smart' && view.id === id))

  const openList = (list: TaskList) => {
    navigate({ kind: 'list', id: list.id })
    selectTask(null)
  }

  return (
    <>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebar(false)} />}
      <aside className={cn('sidebar', sidebarOpen && 'open')}>
        <div className="sidebar-scroll">
          <div className="brand">
            <div className="brand-mark">
              <LogoMark size={19} />
            </div>
            <div className="brand-text">
              <div className="brand-name">VibeDo</div>
              <div className="brand-sub">задачі · час · гроші</div>
            </div>
            <button
              className="btn-icon sidebar-close"
              onClick={() => setSidebar(false)}
              aria-label="Закрити меню"
            >
              <X size={18} />
            </button>
          </div>

          <button className="profile" onClick={() => navigate({ kind: 'settings' })}>
            <div className="avatar">{(settings.firstName.trim() || 'V').slice(0, 1)}</div>
            <div style={{ minWidth: 0, textAlign: 'left' }}>
              <div className="profile-name">{settings.firstName.trim() || 'Мій простір'}</div>
              <div className="profile-sub">локально · приватно</div>
            </div>
          </button>

          <nav className="nav">
            <button
              className={cn('nav-item', isActive('smart', 'myday') && 'active')}
              onClick={() => navigate({ kind: 'smart', id: 'myday' })}
            >
              <span className="nav-icon">
                <Sun size={17} />
              </span>
              <span className="nav-label">Мій день</span>
              {smartCounts.myday > 0 && <span className="nav-count">{smartCounts.myday}</span>}
            </button>
            <button
              className={cn('nav-item', isActive('smart', 'important') && 'active')}
              onClick={() => navigate({ kind: 'smart', id: 'important' })}
            >
              <span className="nav-icon">
                <Star size={17} />
              </span>
              <span className="nav-label">Важливі</span>
              {smartCounts.important > 0 && <span className="nav-count">{smartCounts.important}</span>}
            </button>
            <button
              className={cn('nav-item', isActive('smart', 'planned') && 'active')}
              onClick={() => navigate({ kind: 'smart', id: 'planned' })}
            >
              <span className="nav-icon">
                <CalendarDays size={17} />
              </span>
              <span className="nav-label">Заплановані</span>
              {smartCounts.planned > 0 && <span className="nav-count">{smartCounts.planned}</span>}
            </button>
            <button
              className={cn('nav-item', isActive('smart', 'all') && 'active')}
              onClick={() => navigate({ kind: 'smart', id: 'all' })}
            >
              <span className="nav-icon">
                <ListTodo size={17} />
              </span>
              <span className="nav-label">Усі задачі</span>
              {smartCounts.all > 0 && <span className="nav-count">{smartCounts.all}</span>}
            </button>
          </nav>

          <div className="sidebar-section">
            <div className="section-title">
              <span>Списки</span>
              <button
                className="btn-icon"
                style={{ width: 24, height: 24 }}
                onClick={() => setListDialog({ open: true, list: null })}
                aria-label="Новий список"
                title="Новий список"
              >
                <Plus size={15} />
              </button>
            </div>
            <div className="nav">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className={cn('list-item', isActive('list', list.id) && 'active')}
                  role="button"
                  tabIndex={0}
                  onClick={() => openList(list)}
                  onDoubleClick={() => setListDialog({ open: true, list })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') openList(list)
                  }}
                >
                  <span className="list-dot" style={{ background: list.color }} />
                  <span className="list-name" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {list.name}
                  </span>
                  <span className="nav-count list-count">{listCounts.get(list.id) ?? 0}</span>
                  <button
                    className="list-edit"
                    aria-label={`Редагувати список ${list.name}`}
                    title="Редагувати список"
                    onClick={(event) => {
                      event.stopPropagation()
                      setListDialog({ open: true, list })
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              ))}
              <button
                className="list-item"
                onClick={() => setListDialog({ open: true, list: null })}
                style={{ color: 'var(--text-3)' }}
              >
                <span
                  className="list-dot"
                  style={{ background: 'transparent', border: '1.5px dashed var(--border-strong)' }}
                />
                <span className="list-name">Новий список</span>
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-title">
              <span>Час і гроші</span>
            </div>
            <nav className="nav">
              <button
                className={cn('nav-item', view.kind === 'calendar' && 'active')}
                onClick={() => navigate({ kind: 'calendar' })}
              >
                <span className="nav-icon">
                  <CalendarRange size={17} />
                </span>
                <span className="nav-label">Календар</span>
              </button>
              <button
                className={cn('nav-item', view.kind === 'time' && 'active')}
                onClick={() => navigate({ kind: 'time' })}
              >
                <span className="nav-icon">
                  <Clock size={17} />
                </span>
                <span className="nav-label">Трекер часу</span>
              </button>
              <button
                className={cn('nav-item', view.kind === 'salary' && 'active')}
                onClick={() => navigate({ kind: 'salary' })}
              >
                <span className="nav-icon">
                  <Wallet size={17} />
                </span>
                <span className="nav-label">Заробіток</span>
              </button>
              <button
                className={cn('nav-item', view.kind === 'stats' && 'active')}
                onClick={() => navigate({ kind: 'stats' })}
              >
                <span className="nav-icon">
                  <BarChart3 size={17} />
                </span>
                <span className="nav-label">Статистика</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="today-strip" title={dataPath ? `Дані: ${dataPath}` : 'Дані зберігаються локально'}>
            <Clock size={13} />
            <span>Сьогодні</span>
            <b>
              {Math.floor(todaySeconds / 3600)} год{' '}
              {String(Math.floor((todaySeconds % 3600) / 60)).padStart(2, '0')} хв
            </b>
            <span className="earn">{formatMoney(todayEarnings, settings.currency, 0)}</span>
          </div>
          <button
            className={cn('nav-item', view.kind === 'settings' && 'active')}
            onClick={() => navigate({ kind: 'settings' })}
          >
            <span className="nav-icon">
              <Settings2 size={17} />
            </span>
            <span className="nav-label">Налаштування</span>
          </button>
          <SaveIndicator />
        </div>

        <ListDialog
          open={listDialog.open}
          list={listDialog.list}
          onClose={() => setListDialog({ open: false, list: null })}
        />
      </aside>
    </>
  )
}
