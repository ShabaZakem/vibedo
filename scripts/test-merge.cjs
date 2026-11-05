const { mergeData } = require('../electron/sync-server.cjs')

const a = {
  schemaVersion: 2,
  updatedAt: 100,
  settings: { theme: 'light' },
  lists: [{ id: 'l1', name: 'A', order: 0, updatedAt: 10 }],
  tasks: [{ id: 't1', title: 'old', updatedAt: 10 }],
  entries: [{ id: 'e1', endedAt: 10 }],
  paydays: [],
}
const b = {
  schemaVersion: 2,
  updatedAt: 200,
  settings: { theme: 'dark' },
  lists: [
    { id: 'l1', name: 'B', order: 0, updatedAt: 50 },
    { id: 'l2', name: 'New', order: 1, updatedAt: 5 },
  ],
  tasks: [
    { id: 't1', title: 'new', updatedAt: 50 },
    { id: 't2', title: 'two', updatedAt: 5 },
  ],
  entries: [
    { id: 'e1', endedAt: 20 },
    { id: 'e2', endedAt: 5 },
  ],
  paydays: [{ id: 'p1', date: '2026-11-05', updatedAt: 1 }],
}

const merged = mergeData(a, b)
const checks = {
  settingsFromNewer: merged.settings.theme === 'dark',
  listNameLatest: merged.lists.find((l) => l.id === 'l1').name === 'B',
  listAdded: merged.lists.some((l) => l.id === 'l2'),
  taskLatest: merged.tasks.find((t) => t.id === 't1').title === 'new',
  taskAdded: merged.tasks.some((t) => t.id === 't2'),
  entriesUnion: merged.entries.length === 2,
  entryLatest: merged.entries.find((e) => e.id === 'e1').endedAt === 20,
  paydayAdded: merged.paydays.length === 1,
}
console.log(checks)
if (Object.values(checks).some((v) => !v)) process.exit(1)
console.log('merge OK')
