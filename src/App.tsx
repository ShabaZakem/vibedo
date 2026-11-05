import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { TaskView } from './components/TaskView'
import { TaskDetails } from './components/TaskDetails'
import { TimerBar, Reminders } from './components/TimerBar'
import { BottomNav, MobileFab, TopBar } from './components/TopBar'
import { ToastHost, LogoMark, toast } from './components/ui'
import { CalendarPage } from './pages/CalendarPage'
import { SalaryPage } from './pages/SalaryPage'
import { SettingsPage } from './pages/SettingsPage'
import { StatsPage } from './pages/StatsPage'
import { TimePage } from './pages/TimePage'
import { setupPersistence } from './lib/persist'
import { cn } from './lib/utils'
import { snapshot, useAppStore } from './store'
import { useUIStore } from './lib/ui-store'
import { usePomodoroRunner } from './lib/pomodoro'
import {
  applyIncomingSync,
  loadSyncConfig,
  startAutoSync,
  startDesktopServer,
  subscribeDesktopSync,
} from './lib/sync'
import {
  initNativeUI,
  isNative,
  scheduleNativeNotifications,
  setNativeTheme,
} from './lib/native'

export default function App() {
  const hydrated = useAppStore((state) => state.hydrated)
  const init = useAppStore((state) => state.init)
  const view = useAppStore((state) => state.view)
  const tasks = useAppStore((state) => state.tasks)
  const paydays = useAppStore((state) => state.paydays)
  const settings = useAppStore((state) => state.settings)
  const isDesktop = Boolean(window.desktop?.isDesktop)

  usePomodoroRunner()

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    if (hydrated) setupPersistence()
  }, [hydrated])

  useEffect(() => {
    if (isDesktop) {
      document.documentElement.style.setProperty('--titlebar-height', '40px')
    }
  }, [isDesktop])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document.documentElement.style.setProperty('--accent', settings.accent)
      void window.desktop?.setTheme(dark ? 'dark' : 'light')
      void setNativeTheme(dark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings.theme, settings.accent])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (!mod) return
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('[data-quick-add]')?.focus()
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('[aria-label="Пошук задач"]')?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Local Wi-Fi sync: desktop hosts an authenticated server, mobile pulls.
  useEffect(() => {
    if (!hydrated) return
    const config = loadSyncConfig()
    if (isDesktop) {
      if (config.enabled) void startDesktopServer(config.pin, config.port)
      const offRequest = window.desktop?.onSyncRequest?.(() => {
        window.desktop?.sendSnapshot?.(snapshot(useAppStore.getState()))
      })
      const offUpdated = subscribeDesktopSync((data) => {
        applyIncomingSync(data)
        toast('Дані синхронізовано з пристроєм')
      })
      return () => {
        offUpdated()
        offRequest?.()
      }
    }
    if (config.enabled && config.host) return startAutoSync()
    return undefined
  }, [hydrated, isDesktop])

  // Native Android integration: back button, taps and notification scheduling.
  useEffect(() => {
    if (!hydrated || !isNative) return
    let dispose: (() => void) | undefined
    const ui = useUIStore.getState()
    void initNativeUI(
      () => {
        const state = useAppStore.getState()
        const panel = useUIStore.getState()
        if (panel.notificationsOpen) {
          panel.setNotifications(false)
          return true
        }
        if (panel.sidebarOpen) {
          panel.setSidebar(false)
          return true
        }
        if (state.selectedTaskId) {
          state.selectTask(null)
          return true
        }
        if (state.view.kind !== 'smart' || state.view.id !== 'myday') {
          state.setView({ kind: 'smart', id: 'myday' })
          return true
        }
        return false
      },
      (extra) => {
        if (extra.taskId) {
          useAppStore.getState().selectTask(extra.taskId)
        } else if (extra.paydayId) {
          useAppStore.getState().setView({ kind: 'calendar' })
        }
        ui.setNotifications(true)
      },
    ).then((cleanup) => {
      dispose = cleanup
    })
    return () => dispose?.()
  }, [hydrated])

  useEffect(() => {
    if (!hydrated || !isNative) return
    const timer = window.setTimeout(() => {
      const state = useAppStore.getState()
      void scheduleNativeNotifications({
        schemaVersion: state.schemaVersion,
        settings: state.settings,
        lists: state.lists,
        tasks: state.tasks,
        entries: state.entries,
        paydays: state.paydays,
        activeTimer: state.activeTimer,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
      })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [hydrated, tasks, paydays, settings])

  if (!hydrated) {
    return (
      <div className="splash">
        <div className="brand-mark">
          <LogoMark size={28} />
        </div>
        <div>VibeDo · завантажуємо локальні дані…</div>
      </div>
    )
  }

  return (
    <>
      {isDesktop && (
        <div className="titlebar">
          <span className="tb-brand">
            <LogoMark size={13} />
            VibeDo
          </span>
          <span className="tb-sep">·</span>
          <span>локальний планувальник</span>
          <span className="tb-sep">·</span>
          <span>дані лише на цьому ПК</span>
          <span className="spacer" />
          <span className="tb-dot" />
          <span>приватно</span>
        </div>
      )}
      <div
        className={cn(
          'app',
          isDesktop && 'is-desktop',
          isNative && 'is-native',
          settings.compactMode && 'compact',
        )}
      >
        <Sidebar />
        <main className="main">
          <TopBar />
          {(view.kind === 'smart' || view.kind === 'list') && <TaskView />}
          {view.kind === 'time' && <TimePage />}
          {view.kind === 'salary' && <SalaryPage />}
          {view.kind === 'calendar' && <CalendarPage />}
          {view.kind === 'stats' && <StatsPage />}
          {view.kind === 'settings' && <SettingsPage />}
        </main>
        <TaskDetails />
        <TimerBar />
        <MobileFab />
        <BottomNav />
      </div>
      <Reminders />
      <ToastHost />
    </>
  )
}
