import { useEffect } from 'react'
import { create } from 'zustand'
import { useAppStore } from '../store'
import { notifyNow } from './native'
import { toast } from '../components/ui'

export type PomodoroPhase = 'idle' | 'work' | 'break'

interface PomodoroStore {
  phase: PomodoroPhase
  endsAt: number | null
  remainingMs: number
  taskId: string | null
  cycle: number
  startWork: (taskId: string) => void
  startBreak: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  skip: () => void
}

const KEY = 'vibedo-pomodoro-v1'

interface Persisted {
  phase: PomodoroPhase
  endsAt: number | null
  remainingMs: number
  taskId: string | null
  cycle: number
}

function readPersisted(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<Persisted>
  } catch {
    return {}
  }
}

const saved = readPersisted()

export const usePomodoro = create<PomodoroStore>((set, get) => ({
  phase: saved.phase === 'work' || saved.phase === 'break' ? saved.phase : 'idle',
  endsAt: typeof saved.endsAt === 'number' ? saved.endsAt : null,
  remainingMs: typeof saved.remainingMs === 'number' ? saved.remainingMs : 0,
  taskId: typeof saved.taskId === 'string' ? saved.taskId : null,
  cycle: typeof saved.cycle === 'number' ? saved.cycle : 0,

  startWork: (taskId) => {
    const settings = useAppStore.getState().settings
    useAppStore.getState().startTimer(taskId)
    set({
      phase: 'work',
      taskId,
      endsAt: Date.now() + settings.pomodoroWorkMinutes * 60_000,
      remainingMs: 0,
    })
  },

  startBreak: () => {
    const settings = useAppStore.getState().settings
    set({
      phase: 'break',
      endsAt: Date.now() + settings.pomodoroBreakMinutes * 60_000,
      remainingMs: 0,
    })
  },

  pause: () => {
    const state = get()
    if (!state.endsAt) return
    if (state.phase === 'work') useAppStore.getState().stopTimer()
    set({ remainingMs: Math.max(0, state.endsAt - Date.now()), endsAt: null })
  },

  resume: () => {
    const state = get()
    if (state.phase === 'idle' || state.remainingMs <= 0) return
    if (state.phase === 'work' && state.taskId) {
      const task = useAppStore.getState().tasks.find((item) => item.id === state.taskId)
      if (task && !task.completed) useAppStore.getState().startTimer(task.id)
    }
    set({ endsAt: Date.now() + state.remainingMs, remainingMs: 0 })
  },

  stop: () => {
    if (get().phase === 'work') useAppStore.getState().stopTimer()
    set({ phase: 'idle', endsAt: null, remainingMs: 0 })
  },

  skip: () => {
    const state = get()
    if (state.phase === 'work') {
      useAppStore.getState().stopTimer()
      state.startBreak()
      return
    }
    set({ phase: 'idle', endsAt: null, remainingMs: 0 })
  },
}))

usePomodoro.subscribe((state) => {
  const payload: Persisted = {
    phase: state.phase,
    endsAt: state.endsAt,
    remainingMs: state.remainingMs,
    taskId: state.taskId,
    cycle: state.cycle,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
})

export function pomodoroRemaining(endsAt: number | null, remainingMs: number): number {
  if (endsAt) return Math.max(0, endsAt - Date.now())
  return Math.max(0, remainingMs)
}

export function pomodoroTotal(phase: PomodoroPhase): number {
  const settings = useAppStore.getState().settings
  if (phase === 'break') return settings.pomodoroBreakMinutes * 60_000
  return settings.pomodoroWorkMinutes * 60_000
}

async function finishPhase(): Promise<void> {
  const state = usePomodoro.getState()
  if (!state.endsAt || Date.now() < state.endsAt) return
  if (state.phase === 'work') {
    useAppStore.getState().stopTimer()
    const completedCycles = state.cycle + 1
    usePomodoro.setState({
      cycle: completedCycles,
      endsAt: null,
      remainingMs: 0,
    })
    toast('Pomodoro: час перерви')
    await notifyNow('VibeDo · фокус завершено', 'Зробіть коротку перерву — ви це заслужили.')
    if (useAppStore.getState().settings.pomodoroAutoBreak) {
      state.startBreak()
    } else {
      usePomodoro.setState({ phase: 'idle' })
    }
    return
  }
  if (state.phase === 'break') {
    usePomodoro.setState({ phase: 'idle', endsAt: null, remainingMs: 0 })
    toast('Перерва завершена')
    await notifyNow('VibeDo · перерва завершена', 'Повертайтеся до задач, коли будете готові.')
  }
}

export function usePomodoroRunner(): void {
  const endsAt = usePomodoro((state) => state.endsAt)
  const phase = usePomodoro((state) => state.phase)
  const activeTimer = useAppStore((state) => state.activeTimer)

  useEffect(() => {
    if (!endsAt) return
    const check = () => {
      void finishPhase()
    }
    check()
    const timer = window.setInterval(check, 500)
    return () => window.clearInterval(timer)
  }, [endsAt])

  useEffect(() => {
    if (phase === 'work' && endsAt && !activeTimer) {
      usePomodoro.getState().stop()
    }
  }, [phase, endsAt, activeTimer])
}
