const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { createDemoData } = require('./demo-data.cjs')

const outDir = path.join(__dirname, '..', 'docs')
fs.mkdirSync(outDir, { recursive: true })

// The screenshots run on a sandboxed demo dataset, never on the real user file.
ipcMain.handle('data:load', async () => createDemoData())
ipcMain.handle('data:save', async () => ({ ok: true, savedAt: Date.now() }))
ipcMain.handle('app:info', async () => ({
  version: '1.0.2',
  dataPath: 'C:\\Users\\demo\\AppData\\Roaming\\vibedo',
  platform: 'win32',
}))
ipcMain.handle('theme:set', async () => ({ ok: true }))
ipcMain.handle('window:focus', async () => ({ ok: true }))
ipcMain.handle('app:openDataFolder', async () => ({ ok: true }))
ipcMain.handle('file:saveText', async () => ({ ok: false, canceled: true }))
ipcMain.handle('data:export', async () => ({ ok: false, canceled: true }))
ipcMain.handle('data:import', async () => ({ ok: false, canceled: true }))

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    show: false,
    backgroundColor: '#fbfbfa',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#fbfbfa', symbolColor: '#37352f', height: 40 },
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, '..', 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.webContents.setFrameRate(30)

  let latest = null
  win.webContents.on('paint', (_event, _dirty, image) => {
    latest = image
  })

  const capture = async (name) => {
    await win.webContents.executeJavaScript(
      `document.querySelector('.main')?.scrollTo({ top: 0, behavior: 'instant' });
       document.querySelector('.page')?.scrollTo({ top: 0, behavior: 'instant' }); true`,
    )
    await wait(700)
    win.webContents.invalidate()
    await wait(350)
    if (!latest) throw new Error(`No frame painted for ${name}`)
    fs.writeFileSync(path.join(outDir, name), latest.toPNG())
    const size = latest.getSize()
    console.log('saved', name, `${size.width}x${size.height}`)
  }

  const selectView = async (label) => {
    await win.webContents.executeJavaScript(`
      [...document.querySelectorAll('.nav-item')].find(
        (button) => button.textContent.includes(${JSON.stringify(label)}),
      )?.click()
    `)
    await wait(800)
  }

  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  await wait(2600)
  await win.webContents.insertCSS(`
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
  `)

  await capture('myday.png')

  await selectView('Календар')
  await capture('calendar.png')

  await selectView('Статистика')
  await capture('stats.png')

  await selectView('Заробіток')
  await win.webContents.executeJavaScript(`
    [...document.querySelectorAll('.segmented button')].find(
      (button) => button.textContent.trim() === 'Увесь час',
    )?.click()
  `)
  await wait(900)
  await capture('salary.png')

  await selectView('Трекер часу')
  await capture('time.png')

  await selectView('Налаштування')
  await capture('settings.png')

  await selectView('Мій день')
  const state = await win.webContents.executeJavaScript(`
    (() => {
      const rows = [...document.querySelectorAll('.task-row')];
      const row = rows.find((item) => item.textContent.includes('Підготувати тижневий звіт')) ?? rows[0];
      row?.click();
      return { rows: rows.length, clicked: Boolean(row) };
    })()
  `)
  await wait(900)
  const drawer = await win.webContents.executeJavaScript(`
    ({
      open: Boolean(document.querySelector('.drawer')),
      selected: document.querySelectorAll('.task-row.is-selected').length,
      title: document.querySelector('.drawer .detail-title')?.value ?? null,
    })
  `)
  console.log('task rows:', state.rows, 'drawer:', JSON.stringify(drawer))
  await capture('drawer.png')

  app.quit()
})

app.on('window-all-closed', () => app.quit())
