const { mergeData } = require('../electron/sync-server.cjs')

const a = {
  schemaVersion: 3,
  updatedAt: 100,
  settings: { theme: 'light' },
  lists: [{ id: 'l1', name: 'A', order: 0, updatedAt: 10 }],
  tasks: [{ id: 't1', title: 'old', updatedAt: 10 }],
  entries: [{ id: 'e1', endedAt: 10 }],
  paydays: [],
  categories: [{ id: 'c1', name: 'Old', updatedAt: 10 }],
  transactions: [{ id: 'm1', amount: 10, updatedAt: 10 }],
  recurring: [{ id: 'r1', amount: 10, updatedAt: 10 }],
  budgets: [{ id: 'b1', amount: 100, updatedAt: 10 }],
}
const b = {
  schemaVersion: 3,
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
  categories: [
    { id: 'c1', name: 'New', updatedAt: 50 },
    { id: 'c2', name: 'Added', updatedAt: 5 },
  ],
  transactions: [
    { id: 'm1', amount: 20, updatedAt: 50 },
    { id: 'm2', amount: 30, updatedAt: 5 },
  ],
  recurring: [{ id: 'r2', amount: 40, updatedAt: 5 }],
  budgets: [{ id: 'b2', amount: 500, updatedAt: 5 }],
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
  schemaVersionLatest: merged.schemaVersion === 3,
  categoryLatest: merged.categories.find((c) => c.id === 'c1').name === 'New',
  categoryAdded: merged.categories.some((c) => c.id === 'c2'),
  transactionLatest: merged.transactions.find((m) => m.id === 'm1').amount === 20,
  transactionAdded: merged.transactions.some((m) => m.id === 'm2'),
  recurringUnion: merged.recurring.length === 2,
  budgetUnion: merged.budgets.length === 2,
}
console.log(checks)
if (Object.values(checks).some((v) => !v)) process.exit(1)
console.log('merge OK')
