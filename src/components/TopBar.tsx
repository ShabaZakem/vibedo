import { useMemo } from 'react'
import {
  Bell,
  CalendarDays,
  Clock,
  Cloud,
  CloudOff,
  Menu,
  Moon,
  MoreHorizontal,
  RefreshCw,
  Sun,
  Wallet,
  X,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Plus,
} from 'lucide-react'
import type { View } from '../types'
import { cn, todayKey } from '../lib/utils'
import { useAppStore } from '../store'
import { useUIStore } from '../lib/ui-store'
import { collectNotifications, type AppNotification } from '../lib/notifications'
import { loadSyncConfig, useSyncStatus } from '../lib/sync'
import { isNative } from '../lib/native'

function viewTitle(view: View, listName?: string): { section: string; title: string } {
  if (view.kind === 'smart') {
    const map = {
      myday: 'Мій день',
      important: 'Важливі',
      planned: 'Заплановані',
      all: 'Усі задачі',
    }
    return { section: 'Задачі', title: map[view.id] }
  }
  if (view.kind === 'list') return { section: 'Списки', title: listName ?? 'Список' }
  if (view.kind === 'time') return { section: 'Час', title: 'Трекер часу' }
  if (view.kind === 'salary') return { section: 'Гроші', title: 'Заробіток' }
  if (view.kind === 'calendar') return { section: 'Планування', title: 'Календар' }
  if (view.kind === 'stats') return { section: 'Аналітика', title: 'Статистика' }
  return { section: 'VibeDo', title: 'Налаштування' }
}

export function TopBar() {
  const view = useAppStore((state) => state.view)
  const lists = useAppStore((state) => state.lists)
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const setView = useAppStore((state) => state.setView)
  const toggleNotifications = useUIStore((state) => state.toggleNotifications)
  const setSidebar = useUIStore((state) => state.setSidebar)
  const notificationsOpen = useUIStore((state) => state.notificationsOpen)
  const syncPhase = useSyncStatus((state) => state.phase)
  const syncConfig = loadSyncConfig()

  const list = view.kind === 'list' ? lists.find((item) => item.id === view.id) : undefined
  const { section, title } = viewTitle(view, list?.name)

  const dark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <>
      <header className="topbar">
        <button
          className="btn-icon topbar-menu"
          onClick={() => setSidebar(true)}
          aria-label="Меню"
        >
          <Menu size={19} />
        </button>
        <div className="crumbs">
          <span className="crumb-section">{section}</span>
          <span className="crumb-sep">/</span>
          <span className="crumb-title">{title}</span>
        </div>
        <span className="spacer" />
        <button
          className={cn('sync-pill', isNative && 'mobile-only')}
          onClick={() => setView({ kind: 'settings' })}
          title={syncConfig.host ? `Синхронізація: ${syncConfig.host}` : 'Локальні дані'}
        >
          {syncPhase === 'syncing' ? (
            <RefreshCw size={13} className="spin" />
          ) : syncConfig.host && syncPhase !== 'offline' ? (
            <Cloud size={13} />
          ) : (
            <CloudOff size={13} />
          )}
          <span>
            {syncPhase === 'syncing'
              ? 'Синхронізація'
              : syncConfig.host && syncPhase === 'offline'
                ? 'Немає зв’язку'
                : syncConfig.host
                  ? 'Синхронізовано'
                  : 'Локально'}
          </span>
        </button>
        <button
          className="btn-icon"
          onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}
          aria-label={dark ? 'Світла тема' : 'Темна тема'}
          title={dark ? 'Світла тема' : 'Темна тема'}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          className={cn('btn-icon bell-btn', notificationsOpen && 'active')}
          onClick={toggleNotifications}
          aria-label="Сповіщення"
          title="Сповіщення"
        >
          <Bell size={17} />
          <NotificationBadge />
        </button>
      </header>
      <NotificationCenter />
    </>
  )
}

function NotificationBadge() {
  const tasks = useAppStore((state) => state.tasks)
  const paydays = useAppStore((state) => state.paydays)
  const settings = useAppStore((state) => state.settings)
  const data = useMemo(
    () => ({ tasks, paydays, settings } as Parameters<typeof collectNotifications>[0]),
    [tasks, paydays, settings],
  )
  const count = useMemo(() => collectNotifications(data).length, [data])
  if (count === 0) return null
  return <span className="notif-badge">{count > 9 ? '9+' : count}</span>
}

function iconFor(item: AppNotification) {
  if (item.kind === 'payday') return <Wallet size={15} />
  if (item.kind === 'overdue') return <AlertTriangle size={15} />
  if (item.kind === 'today') return <CalendarDays size={15} />
  if (item.kind === 'reminder') return <Bell size={15} />
  return <Sparkles size={15} />
}

export function NotificationCenter() {
  const open = useUIStore((state) => state.notificationsOpen)
  const setOpen = useUIStore((state) => state.setNotifications)
  const tasks = useAppStore((state) => state.tasks)
  const paydays = useAppStore((state) => state.paydays)
  const settings = useAppStore((state) => state.settings)
  const setView = useAppStore((state) => state.setView)
  const selectTask = useAppStore((state) => state.selectTask)

  const items = useMemo(
    () =>
      collectNotifications({
        tasks,
        paydays,
        settings,
        lists: [],
        entries: [],
        activeTimer: null,
        schemaVersion: 2,
        createdAt: 0,
        updatedAt: 0,
      }).slice(0, 30),
    [tasks, paydays, settings],
  )

  if (!open) return null

  const openItem = (item: AppNotification) => {
    setOpen(false)
    if (item.taskId) {
      selectTask(item.taskId)
    } else if (item.paydayId) {
      setView({ kind: 'calendar' })
    } else {
      setView({ kind: 'settings' })
    }
  }

  return (
    <>
      <div className="notif-backdrop" onClick={() => setOpen(false)} />
      <aside className="notif-panel" aria-label="Сповіщення">
        <div className="notif-head">
          <div>
            <div className="notif-title">Сповіщення</div>
            <div className="notif-sub">
              {items.length > 0 ? `${items.length} подій потребують уваги` : 'Усе під контролем'}
            </div>
          </div>
          <button className="btn-icon" onClick={() => setOpen(false)} aria-label="Закрити">
            <X size={18} />
          </button>
        </div>
        <div className="notif-list">
          {items.length === 0 ? (
            <div className="notif-empty">
              <CheckCircle2 size={30} />
              <b>Немає нових сповіщень</b>
              <span>Нагадування про задачі та зарплатні дні з’являться тут.</span>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                className={cn('notif-item', item.tone)}
                onClick={() => openItem(item)}
              >
                <span className="notif-ico">{iconFor(item)}</span>
                <span className="notif-copy">
                  <b>{item.title}</b>
                  <span>{item.body}</span>
                  {item.kind === 'payday' && item.date && (
                    <small>{paydayDaysLeftLabel(item.date)}</small>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="notif-foot">
          <span>Сповіщення обробляються локально</span>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setOpen(false)
              setView({ kind: 'settings' })
            }}
          >
            Налаштувати
          </button>
        </div>
      </aside>
    </>
  )
}

function paydayDaysLeftLabel(date: string): string {
  const diff = Math.round(
    (new Date(`${date}T00:00:00`).getTime() - new Date(`${todayKey()}T00:00:00`).getTime()) /
      86_400_000,
  )
  if (diff <= 0) return 'Сьогодні'
  if (diff === 1) return 'Завтра'
  return `Через ${diff} дн.`
}

export function BottomNav() {
  const view = useAppStore((state) => state.view)
  const setView = useAppStore((state) => state.setView)
  const setSidebar = useUIStore((state) => state.setSidebar)

  const isSmart = (id: string) => view.kind === 'smart' && view.id === id

  return (
    <nav className="bottom-nav" aria-label="Основна навігація">
      <button
        className={cn('bn-item', isSmart('myday') && 'active')}
        onClick={() => setView({ kind: 'smart', id: 'myday' })}
      >
        <Sun size={20} />
        <span>Мій день</span>
      </button>
      <button
        className={cn('bn-item', (isSmart('all') || view.kind === 'list') && 'active')}
        onClick={() => setView({ kind: 'smart', id: 'all' })}
      >
        <CheckCircle2 size={20} />
        <span>Задачі</span>
      </button>
      <button
        className={cn('bn-add', view.kind === 'calendar' && 'active')}
        onClick={() => setView({ kind: 'calendar' })}
        aria-label="Календар"
      >
        <CalendarDays size={22} />
      </button>
      <button
        className={cn('bn-item', view.kind === 'time' && 'active')}
        onClick={() => setView({ kind: 'time' })}
      >
        <Clock size={20} />
        <span>Час</span>
      </button>
      <button
        className={cn('bn-item', (view.kind === 'salary' || view.kind === 'stats') && 'active')}
        onClick={() => setView({ kind: 'salary' })}
      >
        <Wallet size={20} />
        <span>Гроші</span>
      </button>
      <button className="bn-item" onClick={() => setSidebar(true)} aria-label="Ще">
        <MoreHorizontal size={20} />
        <span>Ще</span>
      </button>
    </nav>
  )
}

export function MobileFab() {
  const view = useAppStore((state) => state.view)
  const setView = useAppStore((state) => state.setView)
  if (view.kind !== 'smart' && view.kind !== 'list') return null
  return (
    <button
      className="mobile-fab"
      aria-label="Додати задачу"
      onClick={() => {
        if (view.kind !== 'smart' && view.kind !== 'list') setView({ kind: 'smart', id: 'myday' })
        window.setTimeout(() => {
          document.querySelector<HTMLInputElement>('[data-quick-add]')?.focus()
        }, 30)
      }}
    >
      <Plus size={24} />
    </button>
  )
}
