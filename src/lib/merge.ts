import type { AppData, Payday, Task, TaskList, TimeEntry } from '../types'
import { normalizeData } from '../store'

function newer<T extends { updatedAt?: number }>(a: T, b: T): T {
  return (b.updatedAt ?? 0) > (a.updatedAt ?? 0) ? b : a
}

function mergeById<T extends { id: string; updatedAt?: number }>(left: T[], right: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of left) map.set(item.id, item)
  for (const item of right) {
    const existing = map.get(item.id)
    map.set(item.id, existing ? newer(existing, item) : item)
  }
  return [...map.values()]
}

/**
 * Merges two local-first snapshots. Records are reconciled by id and updatedAt,
 * time entries are treated as immutable and united by id. Deletions are not
 * propagated (there are no tombstones), so a record deleted on one device can
 * come back from the other one. This is intentional and documented.
 */
export function mergeAppData(localRaw: AppData, remoteRaw: AppData): AppData {
  const local = normalizeData(localRaw)
  const remote = normalizeData(remoteRaw)
  const remoteWins = remote.updatedAt > local.updatedAt

  const lists = mergeById<TaskList>(local.lists, remote.lists).sort((a, b) => a.order - b.order)
  const tasks = mergeById<Task>(local.tasks, remote.tasks)
  const entries = new Map<string, TimeEntry>()
  for (const entry of [...local.entries, ...remote.entries]) {
    const existing = entries.get(entry.id)
    if (!existing || entry.endedAt > existing.endedAt) entries.set(entry.id, entry)
  }
  const paydays = mergeById<Payday>(local.paydays, remote.paydays)

  const activeCandidates = [local.activeTimer, remote.activeTimer].filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  )
  const activeTimer = activeCandidates.length
    ? activeCandidates.sort((a, b) => b.startedAt - a.startedAt)[0]
    : null

  return normalizeData({
    schemaVersion: Math.max(local.schemaVersion, remote.schemaVersion),
    settings: remoteWins ? remote.settings : local.settings,
    lists,
    tasks,
    entries: [...entries.values()].sort((a, b) => a.startedAt - b.startedAt),
    paydays,
    activeTimer,
    createdAt: Math.min(local.createdAt, remote.createdAt),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt, Date.now()),
  })
}
