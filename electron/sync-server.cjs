'use strict'

const http = require('node:http')
const os = require('node:os')
const crypto = require('node:crypto')

const MAX_BODY = 25 * 1024 * 1024
const TOKEN_TTL = 1000 * 60 * 60 * 24 * 30

let server = null
let port = 0
let pin = ''
let startedAt = null
let lastSyncAt = null
let clients = new Set()
let lastError = ''

const tokens = new Map()

function lanAddresses() {
  const result = []
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const item of interfaces[name] || []) {
      if (item.family === 'IPv4' && !item.internal) result.push(item.address)
    }
  }
  return result
}

function mergeById(left, right) {
  const map = new Map()
  for (const item of left || []) if (item && item.id) map.set(item.id, item)
  for (const item of right || []) {
    if (!item || !item.id) continue
    const existing = map.get(item.id)
    if (!existing) {
      map.set(item.id, item)
      continue
    }
    map.set(item.id, (item.updatedAt || 0) > (existing.updatedAt || 0) ? item : existing)
  }
  return [...map.values()]
}

function mergeData(local, remote) {
  if (!local || typeof local !== 'object') return remote
  if (!remote || typeof remote !== 'object') return local
  const remoteWins = (remote.updatedAt || 0) > (local.updatedAt || 0)

  const entries = new Map()
  for (const entry of [...(local.entries || []), ...(remote.entries || [])]) {
    if (!entry || !entry.id) continue
    const existing = entries.get(entry.id)
    if (!existing || (entry.endedAt || 0) > (existing.endedAt || 0)) entries.set(entry.id, entry)
  }

  const timerCandidates = [local.activeTimer, remote.activeTimer].filter(Boolean)
  const activeTimer = timerCandidates.length
    ? timerCandidates.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0]
    : null

  return {
    ...local,
    schemaVersion: Math.max(local.schemaVersion || 1, remote.schemaVersion || 1),
    settings: remoteWins ? remote.settings : local.settings,
    lists: mergeById(local.lists, remote.lists).sort((a, b) => (a.order || 0) - (b.order || 0)),
    tasks: mergeById(local.tasks, remote.tasks),
    entries: [...entries.values()].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0)),
    paydays: mergeById(local.paydays, remote.paydays),
    activeTimer,
    createdAt: Math.min(local.createdAt || Date.now(), remote.createdAt || Date.now()),
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now()),
  }
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '600')
}

function send(res, status, body) {
  cors(res)
  const raw = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(raw),
    'Cache-Control': 'no-store',
  })
  res.end(raw)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('Занадто великий запит'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve(null)
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Некоректний JSON'))
      }
    })
    req.on('error', reject)
  })
}

function issueToken() {
  const token = crypto.randomBytes(24).toString('hex')
  tokens.set(token, Date.now() + TOKEN_TTL)
  return token
}

function validToken(header) {
  const match = /^Bearer\s+(.+)$/i.exec(header || '')
  if (!match) return null
  const token = match[1].trim()
  const expires = tokens.get(token)
  if (!expires) return null
  if (expires < Date.now()) {
    tokens.delete(token)
    return null
  }
  return token
}

function status() {
  return {
    running: Boolean(server),
    port,
    addresses: server ? lanAddresses() : [],
    clients: clients.size,
    lastSyncAt,
    error: lastError || undefined,
  }
}

/**
 * Starts the LAN sync server.
 * @param {{ pin: string, port: number, getData: () => Promise<object|null>, saveData: (data: object) => Promise<void>, notify: (data: object) => void }} options
 */
function start(options) {
  const requestedPin = String(options.pin || '')
  if (!/^\d{4,8}$/.test(requestedPin)) {
    return Promise.resolve({ ...status(), running: false, error: 'PIN має містити 4–8 цифр' })
  }
  if (server) {
    pin = requestedPin
    return Promise.resolve(status())
  }

  pin = requestedPin
  port = Number(options.port) || 47823
  lastError = ''
  clients = new Set()

  return new Promise((resolve) => {
    const instance = http.createServer(async (req, res) => {
      cors(res)
      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

      try {
        if (req.method === 'GET' && url.pathname === '/api/health') {
          send(res, 200, {
            ok: true,
            app: 'VibeDo',
            version: options.version || '1.0.2',
            clients: clients.size,
          })
          return
        }

        if (req.method === 'POST' && url.pathname === '/api/pair') {
          const body = await readBody(req)
          if (!body || String(body.pin || '') !== pin) {
            send(res, 401, { ok: false, error: 'Невірний PIN' })
            return
          }
          send(res, 200, { ok: true, token: issueToken(), name: os.hostname() })
          return
        }

        if (req.method === 'POST' && url.pathname === '/api/sync') {
          const token = validToken(req.headers.authorization)
          if (!token) {
            send(res, 401, { ok: false, error: 'Сесія застаріла — введіть PIN ще раз' })
            return
          }
          const remote = await readBody(req)
          if (!remote || typeof remote !== 'object' || !Array.isArray(remote.tasks)) {
            send(res, 400, { ok: false, error: 'Некоректні дані' })
            return
          }
          const local = await options.getData()
          const merged = mergeData(local, remote)
          await options.saveData(merged)
          lastSyncAt = Date.now()
          options.notify(merged)
          send(res, 200, merged)
          return
        }

        send(res, 404, { ok: false, error: 'Невідомий маршрут' })
      } catch (error) {
        send(res, 500, { ok: false, error: String(error && error.message ? error.message : error) })
      }
    })

    instance.on('connection', (socket) => {
      clients.add(socket)
      socket.on('close', () => clients.delete(socket))
    })

    instance.on('error', (error) => {
      lastError =
        error && error.code === 'EADDRINUSE'
          ? `Порт ${port} уже зайнятий`
          : String(error && error.message ? error.message : error)
      server = null
      resolve({ ...status(), running: false })
    })

    instance.listen(port, '0.0.0.0', () => {
      server = instance
      startedAt = Date.now()
      resolve(status())
    })
  })
}

function stop() {
  return new Promise((resolve) => {
    if (!server) {
      resolve(status())
      return
    }
    const instance = server
    server = null
    clients = new Set()
    instance.close(() => {
      clients = new Set()
      resolve(status())
    })
    setTimeout(() => resolve(status()), 1500)
  })
}

module.exports = { start, stop, status, mergeData, lanAddresses, startedAt: () => startedAt }
