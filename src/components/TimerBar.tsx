import { useEffect } from 'react'
import { Square } from 'lucide-react'
import { formatClock, formatDuration } from '../lib/utils'
import { useAppStore } from '../store'
import { toast, useTick } from './ui'

export function TimerBar() {
  const activeTimer = useAppStore((state) => state.activeTimer)
  const tasks = useAppStore((state) => state.tasks)
  const lists = useAppStore((state) => state.lists)
  const stopTimer = useAppStore((state) => state.stopTimer)
  const selectTask = useAppStore((state) => state.selectTask)
  const now = useTick(1000)

  if (!activeTimer) return null
  const task = tasks.find((item) => item.id === activeTimer.taskId)
  if (!task) return null
  const list = lists.find((item) => item.id === task.listId)
  const elapsed = Math.max(0, Math.round((now - activeTimer.startedAt) / 1000))

  return (
    <div className="timer-bar">
      <span className="live-dot" />
      <button
        className="tb-task"
        onClick={() => selectTask(task.id)}
        title={`Відкрити: ${task.title}`}
        style={{ color: 'var(--text)' }}
      >
        {task.title}
      </button>
      {list && (
        <span className="badge" style={{ background: 'transparent', padding: 0 }}>
          <span className="list-dot" style={{ background: list.color, width: 7, height: 7 }} />
          {list.name}
        </span>
      )}
      <span className="timer-clock">{formatClock(elapsed)}</span>
      <button
        className="btn-icon tb-stop"
        onClick={() => {
          stopTimer()
          toast(`Записано ${formatDuration(elapsed)}`)
        }}
        aria-label="Зупинити таймер"
        title="Зупинити й зберегти"
      >
        <Square size={13} fill="currentColor" />
      </button>
    </div>
  )
}

export function Reminders() {
  const tasks = useAppStore((state) => state.tasks)
  const settings = useAppStore((state) => state.settings)
  const markNotified = useAppStore((state) => state.markNotified)
  const selectTask = useAppStore((state) => state.selectTask)

  useEffect(() => {
    if (!settings.notifications) return

    const check = () => {
      const now = Date.now()
      for (const task of useAppStore.getState().tasks) {
        if (task.completed || !task.reminderAt || task.notifiedAt) continue
        if (task.reminderAt > now) continue
        if (now - task.reminderAt > 86_400_000) {
          markNotified(task.id)
          continue
        }
        markNotified(task.id)
        const body = [task.notes.trim().slice(0, 120), 'Натисніть, щоб відкрити задачу.']
          .filter(Boolean)
          .join('\n')
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const notification = new Notification('VibeDo · нагадування', {
              body: `${task.title}\n${body}`,
              silent: false,
            })
            notification.onclick = () => {
              selectTask(task.id)
              window.desktop?.focusWindow()
            }
          } else {
            toast(`Нагадування: ${task.title}`)
          }
        } catch {
          toast(`Нагадування: ${task.title}`)
        }
      }
    }

    check()
    const id = window.setInterval(check, 30_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.notifications, markNotified, selectTask, tasks.length])

  return null
}
