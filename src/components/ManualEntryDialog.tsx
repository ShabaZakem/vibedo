import { useEffect, useMemo, useState } from 'react'
import { formatDateInput, formatMoney, listRate, combineDateTime } from '../lib/utils'
import { useAppStore } from '../store'
import { Field, Modal, toast } from './ui'

export function ManualEntryDialog({
  open,
  onClose,
  presetTaskId,
  presetListId,
}: {
  open: boolean
  onClose: () => void
  presetTaskId?: string | null
  presetListId?: string | null
}) {
  const tasks = useAppStore((state) => state.tasks)
  const lists = useAppStore((state) => state.lists)
  const settings = useAppStore((state) => state.settings)
  const addManualEntry = useAppStore((state) => state.addManualEntry)

  const [taskId, setTaskId] = useState('')
  const [listId, setListId] = useState('')
  const [date, setDate] = useState(formatDateInput(Date.now()))
  const [time, setTime] = useState('09:00')
  const [hours, setHours] = useState('1')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    const presetTask = presetTaskId ? tasks.find((task) => task.id === presetTaskId) : undefined
    setTaskId(presetTask?.id ?? '')
    setListId(presetTask?.listId ?? presetListId ?? lists[0]?.id ?? '')
    setDate(formatDateInput(Date.now()))
    setTime('09:00')
    setHours('1')
    setNote('')
  }, [open, presetTaskId, presetListId, tasks, lists])

  const numericHours = Math.max(0, Number(hours.replace(',', '.')) || 0)
  const seconds = Math.round(numericHours * 3600)
  const effectiveListId = taskId ? tasks.find((task) => task.id === taskId)?.listId ?? listId : listId
  const rate = listRate(
    lists.find((list) => list.id === effectiveListId),
    settings,
  )
  const amount = (seconds / 3600) * rate

  const openTasks = useMemo(
    () => [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed) || a.title.localeCompare(b.title)),
    [tasks],
  )

  const submit = () => {
    if (seconds <= 0) {
      toast('Вкажіть тривалість більше нуля')
      return
    }
    addManualEntry({
      taskId: taskId || null,
      listId: effectiveListId,
      startedAt: combineDateTime(date, time),
      seconds,
      note: note.trim(),
    })
    toast('Запис часу додано')
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Новий запис часу"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn btn-soft" onClick={onClose}>
            Скасувати
          </button>
          <button className="btn btn-primary" onClick={submit}>
            Додати запис
          </button>
        </>
      }
    >
      <Field label="Задача">
        <select
          className="input"
          value={taskId}
          onChange={(event) => {
            setTaskId(event.target.value)
            const task = tasks.find((item) => item.id === event.target.value)
            if (task) setListId(task.listId)
          }}
        >
          <option value="">Без задачі (просто час)</option>
          {openTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.completed ? '✓ ' : ''}
              {task.title}
            </option>
          ))}
        </select>
      </Field>

      {!taskId && (
        <Field label="Список">
          <select className="input" value={listId} onChange={(event) => setListId(event.target.value)}>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="meta-grid">
        <Field label="Дата">
          <input
            className="input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Field label="Початок">
          <input
            className="input"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Тривалість, годин" hint={`${Math.round(seconds / 60)} хв · ${formatMoney(amount, settings.currency)}`}>
        <input
          className="input"
          type="number"
          min="0"
          step="0.25"
          value={hours}
          onChange={(event) => setHours(event.target.value)}
        />
      </Field>

      <Field label="Нотатка (необов’язково)">
        <input
          className="input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Що саме робили"
        />
      </Field>
    </Modal>
  )
}
