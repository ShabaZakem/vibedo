const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const syncServer = require('./sync-server.cjs')

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
const DATA_FILE = 'vibedo-data.json'
const BACKUP_DIR = 'backups'
const MAX_BACKUPS = 14

let mainWindow = null
let dataPath = ''
let backupPath = ''
let snapshotResolver = null

function todayStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

async function ensurePaths() {
  const dir = app.getPath('userData')
  dataPath = path.join(dir, DATA_FILE)
  backupPath = path.join(dir, BACKUP_DIR)
  await fsp.mkdir(backupPath, { recursive: true })
}

async function makeDailyBackup() {
  try {
    const raw = await fsp.readFile(dataPath, 'utf8')
    if (!raw.trim()) return
    const file = path.join(backupPath, `${todayStamp()}.json`)
    await fsp.access(file).catch(async () => {
      await fsp.writeFile(file, raw, 'utf8')
    })
  } catch {
    /* no data file yet */
  }
}

async function pruneBackups() {
  try {
    const files = (await fsp.readdir(backupPath))
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
    for (const stale of files.slice(MAX_BACKUPS)) {
      await fsp.unlink(path.join(backupPath, stale)).catch(() => {})
    }
  } catch {
    /* ignore */
  }
}

async function loadData() {
  try {
    const raw = await fsp.readFile(dataPath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Asks the renderer for its in-memory snapshot so a sync never merges against
 * stale on-disk data while the debounced save is still pending.
 */
function requestRendererSnapshot() {
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
      resolve(null)
      return
    }
    let settled = false
    const finish = (data) => {
      if (settled) return
      settled = true
      snapshotResolver = null
      resolve(data)
    }
    snapshotResolver = finish
    mainWindow.webContents.send('sync:request-snapshot')
    setTimeout(() => finish(null), 1200)
  })
}

function notifySyncUpdated(data) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('sync:updated', data)
}

async function saveData(payload) {
  const tmp = `${dataPath}.tmp`
  const raw = JSON.stringify(payload, null, 2)
  await fsp.writeFile(tmp, raw, 'utf8')
  await makeDailyBackup()
  await fsp.rename(tmp, dataPath)
  await pruneBackups()
  return { ok: true, path: dataPath, savedAt: Date.now() }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c1c' : '#f3f3f3',
    title: 'VibeDo',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: nativeTheme.shouldUseDarkColors ? '#1c1c1c' : '#f3f3f3',
      symbolColor: nativeTheme.shouldUseDarkColors ? '#f5f5f5' : '#1b1b1b',
      height: 40,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDev && url.startsWith(process.env.VITE_DEV_SERVER_URL)) return
    if (!isDev && url.startsWith('file://')) return
    event.preventDefault()
  })

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

function buildMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Відкрити папку з даними',
          click: () => shell.openPath(app.getPath('userData')),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Вихід' },
      ],
    },
    {
      label: 'Вигляд',
      submenu: [
        { role: 'reload', label: 'Оновити' },
        { role: 'toggleDevTools', label: 'Інструменти розробника' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Скинути масштаб' },
        { role: 'zoomIn', label: 'Збільшити' },
        { role: 'zoomOut', label: 'Зменшити' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'На весь екран' },
      ],
    },
    {
      label: 'Довідка',
      submenu: [
        {
          label: 'Про VibeDo',
          click: () => {
            if (!mainWindow) return
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'VibeDo',
              message: `VibeDo ${app.getVersion()}`,
              detail:
                'Локальний планувальник задач, трекер часу та калькулятор зарплати.\n\n' +
                'Усі дані зберігаються лише на цьому комп’ютері.\n' +
                'Ліцензія MIT · відкритий вихідний код.\n\n' +
                `Дані: ${app.getPath('userData')}`,
              buttons: ['Гаразд'],
            })
          },
        },
        { type: 'separator' },
        { role: 'about', label: 'Про Electron' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.vibedo.app')
  await ensurePaths()
  buildMenu()
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

ipcMain.handle('data:load', async () => loadData())

ipcMain.handle('data:save', async (_event, payload) => {
  try {
    return await saveData(payload)
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('data:export', async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Експорт даних VibeDo',
    defaultPath: `vibedo-backup-${todayStamp()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (result.canceled || !result.filePath) return { ok: false, canceled: true }
  try {
    await fsp.writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8')
    return { ok: true, path: result.filePath }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('data:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Імпорт даних VibeDo',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }
  try {
    const raw = await fsp.readFile(result.filePaths[0], 'utf8')
    return { ok: true, data: JSON.parse(raw), path: result.filePaths[0] }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('file:saveText', async (_event, { defaultName, content, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Зберегти файл',
    defaultPath: defaultName,
    filters: filters || [{ name: 'Усі файли', extensions: ['*'] }],
  })
  if (result.canceled || !result.filePath) return { ok: false, canceled: true }
  try {
    await fsp.writeFile(result.filePath, content, 'utf8')
    return { ok: true, path: result.filePath }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('app:info', async () => ({
  version: app.getVersion(),
  dataPath: app.getPath('userData'),
  platform: process.platform,
}))

ipcMain.handle('app:openDataFolder', async () => {
  const err = await shell.openPath(app.getPath('userData'))
  return { ok: !err, error: err || undefined }
})

ipcMain.handle('theme:set', async (_event, theme) => {
  if (!mainWindow) return { ok: false }
  const dark = theme === 'dark'
  mainWindow.setTitleBarOverlay?.({
    color: dark ? '#1c1c1c' : '#f3f3f3',
    symbolColor: dark ? '#f5f5f5' : '#1b1b1b',
    height: 40,
  })
  return { ok: true }
})

ipcMain.handle('window:focus', async () => {
  mainWindow?.focus()
  return { ok: true }
})

/* ---------------- local Wi-Fi sync ---------------- */

ipcMain.on('sync:snapshot', (_event, data) => {
  if (snapshotResolver) snapshotResolver(data)
})

ipcMain.handle('sync:start', async (_event, payload) => {
  const requestedPin = String(payload?.pin || '')
  const requestedPort = Number(payload?.port) || 47823
  return syncServer.start({
    pin: requestedPin,
    port: requestedPort,
    version: app.getVersion(),
    getData: async () => (await requestRendererSnapshot()) || (await loadData()),
    saveData: async (data) => {
      await saveData(data)
    },
    notify: notifySyncUpdated,
  })
})

ipcMain.handle('sync:stop', async () => syncServer.stop())

ipcMain.handle('sync:status', async () => syncServer.status())

app.on('before-quit', () => {
  void syncServer.stop()
})
