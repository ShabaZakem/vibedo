const server = require('../electron/sync-server.cjs')

let stored = {
  schemaVersion: 2,
  updatedAt: 100,
  settings: { theme: 'light' },
  lists: [{ id: 'l1', name: 'Desktop', order: 0, updatedAt: 1 }],
  tasks: [{ id: 't1', title: 'Desktop task', updatedAt: 1 }],
  entries: [],
  paydays: [],
}

async function main() {
  const status = await server.start({
    pin: '4821',
    port: 47899,
    version: '1.0.2',
    getData: async () => stored,
    saveData: async (data) => {
      stored = data
    },
    notify: () => {},
  })
  if (!status.running) throw new Error(`server failed: ${status.error}`)

  const base = 'http://127.0.0.1:47899'
  const health = await (await fetch(`${base}/api/health`)).json()
  const bad = await fetch(`${base}/api/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '0000' }),
  })
  const pair = await (
    await fetch(`${base}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '4821' }),
    })
  ).json()
  if (!pair.token) throw new Error('no token')
  const remote = {
    schemaVersion: 2,
    updatedAt: 300,
    settings: { theme: 'dark' },
    lists: [{ id: 'l2', name: 'Phone', order: 1, updatedAt: 2 }],
    tasks: [{ id: 't2', title: 'Phone task', updatedAt: 2 }],
    entries: [],
    paydays: [],
  }
  const merged = await (
    await fetch(`${base}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pair.token}` },
      body: JSON.stringify(remote),
    })
  ).json()

  const unauthorized = await fetch(`${base}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(remote),
  })

  const checks = {
    health: health.ok === true && health.app === 'VibeDo',
    badPinRejected: bad.status === 401,
    tokenIssued: typeof pair.token === 'string' && pair.token.length > 20,
    mergedTasks: merged.tasks.length === 2,
    mergedLists: merged.lists.length === 2,
    newerSettings: merged.settings.theme === 'dark',
    persisted: stored.tasks.length === 2,
    unauthorizedRejected: unauthorized.status === 401,
  }
  console.log(checks)
  await server.stop()
  if (Object.values(checks).some((v) => !v)) process.exit(1)
  console.log('sync server OK')
}

main().catch(async (error) => {
  console.error(error)
  await server.stop()
  process.exit(1)
})
