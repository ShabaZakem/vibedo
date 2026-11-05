import { useEffect, useState } from 'react'
import {
  Bell,
  Check,
  Coins,
  Copy,
  Database,
  Download,
  FolderOpen,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sun,
  Timer,
  Upload,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { ACCENTS } from '../constants'
import {
  clamp,
  cn,
  formatDateInput,
  formatMoney,
  formatNumber,
} from '../lib/utils'
import {
  exportAppData,
  getAppInfo,
  importAppData,
  isDesktopApp,
  openDataFolder,
} from '../lib/storage'
import { normalizeData, snapshot, useAppStore } from '../store'
import type { AppData, Settings, ThemeMode } from '../types'
import { useSaveStatus } from '../lib/persist'
import { ConfirmDialog, LogoMark, Switch, toast } from '../components/ui'
import {
  DEFAULT_SYNC_PORT,
  getDesktopSyncState,
  isNativeMobile,
  loadSyncConfig,
  makePin,
  saveSyncConfig,
  startDesktopServer,
  stopDesktopServer,
  syncNow,
  useSyncStatus,
  type DesktopSyncState,
  type SyncConfig,
} from '../lib/sync'
import { requestNotificationPermission } from '../lib/native'

function NumberSetting({
  label,
  desc,
  value,
  onChange,
  min = 0,
  max = 1_000_000,
  step = 1,
}: {
  label: string
  desc?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const commit = () => {
    const parsed = Number(text.replace(',', '.'))
    if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max))
    else setText(String(value))
  }

  return (
    <div className="setting-row">
      <div className="sr-main">
        <div className="sr-label">{label}</div>
        {desc && <div className="sr-desc">{desc}</div>}
      </div>
      <input
        className="input narrow"
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit()
            ;(event.target as HTMLInputElement).blur()
          }
        }}
      />
    </div>
  )
}

function CurrencySetting({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const commit = () => {
    const next = text.trim().slice(0, 6) || '₴'
    setText(next)
    onChange(next)
  }
  return (
    <div className="setting-row">
      <div className="sr-main">
        <div className="sr-label">Валюта</div>
        <div className="sr-desc">Символ або код, наприклад ₴, $, €, PLN</div>
      </div>
      <input
        className="input narrow"
        value={text}
        maxLength={6}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit()
            ;(event.target as HTMLInputElement).blur()
          }
        }}
      />
    </div>
  )
}

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Світла', icon: Sun },
  { value: 'dark', label: 'Темна', icon: Moon },
  { value: 'system', label: 'Системна', icon: Monitor },
]

function SyncCard() {
  const isDesktop = isDesktopApp()
  const native = isNativeMobile()
  const [config, setConfig] = useState<SyncConfig>(() => loadSyncConfig())
  const [server, setServer] = useState<DesktopSyncState | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const phase = useSyncStatus((state) => state.phase)
  const message = useSyncStatus((state) => state.message)
  const lastSyncAt = useSyncStatus((state) => state.lastSyncAt)

  useEffect(() => {
    if (!isDesktop) return
    void getDesktopSyncState().then(setServer)
  }, [isDesktop])

  const persist = (patch: Partial<SyncConfig>) => {
    setConfig(saveSyncConfig(patch))
  }

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 1600)
    } catch {
      toast('Не вдалося скопіювати')
    }
  }

  const startServer = async () => {
    setBusy(true)
    const result = await startDesktopServer(config.pin, config.port)
    setServer(result)
    persist({ enabled: result.running })
    setBusy(false)
    if (result.running) toast('Синхронізацію ввімкнено')
    else toast(result.error ?? 'Не вдалося запустити сервер')
  }

  const restartServer = async () => {
    setBusy(true)
    await stopDesktopServer()
    const nextPin = makePin()
    persist({ pin: nextPin })
    const result = await startDesktopServer(nextPin, config.port)
    setServer(result)
    setBusy(false)
    toast('Новий PIN створено')
  }

  const stopServer = async () => {
    setBusy(true)
    await stopDesktopServer()
    const result = await getDesktopSyncState()
    setServer(result)
    persist({ enabled: false })
    setBusy(false)
    toast('Синхронізацію вимкнено')
  }

  const connect = async () => {
    const host = config.host.trim()
    if (!host) {
      toast('Вкажіть IP-адресу комп’ютера')
      return
    }
    const pin = /^\d{4,8}$/.test(config.pin) ? config.pin : makePin()
    persist({ host, pin, enabled: true, token: '' })
    setBusy(true)
    const ok = await syncNow()
    setConfig(loadSyncConfig())
    setBusy(false)
    if (ok) toast('Дані синхронізовано')
  }

  const running = Boolean(server?.running)
  const urls = (server?.addresses ?? []).map((address) => `${address}:${server?.port ?? config.port}`)

  return (
    <section className="settings-card">
      <h3>
        <Wifi size={14} style={{ verticalAlign: -2, marginRight: 5 }} /> Синхронізація по Wi-Fi
      </h3>
      <div className="card-desc">
        Прямий обмін між комп’ютером і телефоном у спільній мережі. Без інтернету, акаунтів і
        хмарних серверів.
      </div>

      {isDesktop ? (
        <>
          <div className="setting-row" style={{ paddingTop: 0 }}>
            <div className="sr-main">
              <div className="sr-label">Сервер на цьому комп’ютері</div>
              <div className="sr-desc">
                {running
                  ? `Працює на порту ${server?.port}. Телефон має бути в тій самій Wi-Fi мережі.`
                  : 'Увімкніть, щоб приймати дані з телефона.'}
              </div>
            </div>
            <Switch
              checked={running}
              onChange={(value) => (value ? void startServer() : void stopServer())}
              label="Сервер синхронізації"
            />
          </div>

          {running && (
            <>
              <div className="sync-address">
                <div>
                  <span>Адреса для телефона</span>
                  {urls.length > 0 ? (
                    urls.map((url) => (
                      <button
                        key={url}
                        className="sync-address-value"
                        onClick={() => void copy(url, url)}
                        title="Скопіювати адресу"
                      >
                        {url}
                        {copied === url ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    ))
                  ) : (
                    <b>Увімкніть Wi-Fi на комп’ютері</b>
                  )}
                </div>
              </div>

              <div className="setting-row">
                <div className="sr-main">
                  <div className="sr-label">PIN для підключення</div>
                  <div className="sr-desc">Введіть цей код на телефоні один раз</div>
                </div>
                <div className="sync-pin">
                  <b>{config.pin}</b>
                  <button
                    className="btn-icon"
                    onClick={() => void copy(config.pin, 'pin')}
                    aria-label="Скопіювати PIN"
                  >
                    {copied === 'pin' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => void restartServer()}
                    aria-label="Новий PIN"
                    title="Новий PIN"
                    disabled={busy}
                  >
                    <RefreshCw size={14} className={busy ? 'spin' : undefined} />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <label className="field" style={{ paddingTop: 0 }}>
            <span className="field-label">IP-адреса комп’ютера</span>
            <input
              className="input"
              value={config.host}
              placeholder="192.168.1.20"
              inputMode="decimal"
              onChange={(event) => persist({ host: event.target.value })}
            />
          </label>
          <div className="meta-grid" style={{ marginTop: 8 }}>
            <label className="field">
              <span className="field-label">PIN з комп’ютера</span>
              <input
                className="input"
                value={config.pin}
                inputMode="numeric"
                maxLength={8}
                onChange={(event) => persist({ pin: event.target.value.replace(/\D/g, '') })}
              />
            </label>
            <label className="field">
              <span className="field-label">Порт</span>
              <input
                className="input"
                type="number"
                value={config.port}
                onChange={(event) =>
                  persist({ port: Number(event.target.value) || DEFAULT_SYNC_PORT })
                }
              />
            </label>
          </div>
          <div className="data-actions" style={{ marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={() => void connect()} disabled={busy}>
              {busy ? <RefreshCw size={13} className="spin" /> : <Wifi size={13} />} Підключитися
            </button>
            <button
              className="btn btn-soft btn-sm"
              onClick={() => persist({ auto: !config.auto })}
            >
              {config.auto ? 'Автосинхронізація: увімк.' : 'Автосинхронізація: вимк.'}
            </button>
          </div>
          {phase !== 'idle' && (
            <div className={cn('sync-status', phase)}>
              {phase === 'ok' ? <Check size={13} /> : <WifiOff size={13} />}
              {message}
            </div>
          )}
          {lastSyncAt && (
            <div className="field-hint" style={{ paddingTop: 5 }}>
              Остання синхронізація:{' '}
              {new Date(lastSyncAt).toLocaleTimeString('uk-UA', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
        </>
      )}

      <div className="sync-note">
        <Smartphone size={15} />
        <div>
          <b>Як це працює</b>
          <span>
            {native
              ? 'Телефон надсилає свої зміни на комп’ютер, отримує об’єднані дані й зберігає їх локально.'
              : 'Відкрийте VibeDo на телефоні, введіть адресу та PIN. Комп’ютер об’єднає задачі, час і зарплатні дні.'}
          </span>
        </div>
      </div>
      <div className="field-hint">
        Обмін працює лише в межах локальної мережі. Видалені записи можуть повернутися з іншого
        пристрою — це особливість злиття без інтернет-сервера.
      </div>
    </section>
  )
}

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const resetAllData = useAppStore((state) => state.resetAllData)
  const replaceData = useAppStore((state) => state.replaceData)
  const tasks = useAppStore((state) => state.tasks)
  const lists = useAppStore((state) => state.lists)
  const entries = useAppStore((state) => state.entries)

  const saveStatus = useSaveStatus((state) => state.status)
  const lastSavedAt = useSaveStatus((state) => state.lastSavedAt)

  const [info, setInfo] = useState<{ version: string; dataPath: string; platform: string }>({
    version: '1.0.2',
    dataPath: '',
    platform: '',
  })
  const [pendingImport, setPendingImport] = useState<AppData | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void getAppInfo().then(setInfo)
  }, [])

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    updateSettings({ [key]: value } as Partial<Settings>)

  const handleExport = async () => {
    setBusy(true)
    const result = await exportAppData(snapshot(useAppStore.getState()))
    setBusy(false)
    if (result.ok) toast(result.path ? `Резервну копію збережено: ${result.path}` : 'Резервну копію збережено')
    else if (!result.canceled) toast('Не вдалося експортувати дані')
  }

  const handleImport = async () => {
    const result = await importAppData()
    if (!result.ok || !result.data) {
      if (!result.canceled) toast('Не вдалося прочитати файл')
      return
    }
    try {
      setPendingImport(normalizeData(result.data))
    } catch {
      toast('Файл не схожий на резервну копію VibeDo')
    }
  }

  const handleOpenFolder = async () => {
    const result = await openDataFolder()
    if (!result.ok) toast(result.error ?? 'Доступно лише в десктопній версії')
  }

  const toggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermission()
      set('notifications', true)
      if (!granted) {
        toast('Сповіщення заблоковані в системі — увімкніть їх у налаштуваннях пристрою')
      }
      return
    }
    set('notifications', false)
  }

  const savedLabel =
    saveStatus === 'saving'
      ? 'Зберігаємо…'
      : saveStatus === 'error'
        ? 'Помилка збереження'
        : lastSavedAt
          ? `Збережено о ${new Date(lastSavedAt).toLocaleTimeString('uk-UA', {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : 'Готово'

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div className="page-header-main">
            <div className="eyebrow">Налаштування</div>
            <h1 className="page-title">Ваш простір</h1>
            <div className="page-sub">Усе зберігається локально. Без акаунтів, серверів і телеметрії.</div>
          </div>
          <span className="badge success">
            <ShieldCheck size={12} /> {savedLabel}
          </span>
        </div>

        <div className="settings-grid">
          <section className="settings-card">
            <h3>
              <User size={14} style={{ verticalAlign: -2, marginRight: 5 }} /> Профіль і вигляд
            </h3>
            <div className="card-desc">Ім’я показується у привітанні на «Мій день».</div>

            <div className="setting-row" style={{ paddingTop: 0 }}>
              <div className="sr-main">
                <div className="sr-label">Ваше ім’я</div>
                <div className="sr-desc">Необов’язково</div>
              </div>
              <input
                className="input wide"
                value={settings.firstName}
                maxLength={40}
                placeholder="Наприклад, Олена"
                onChange={(event) => set('firstName', event.target.value)}
              />
            </div>

            <div className="setting-row">
              <div className="sr-main">
                <div className="sr-label">Тема</div>
                <div className="sr-desc">Світла, темна або як у системі</div>
              </div>
            </div>
            <div className="theme-tiles">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  className={cn('theme-tile', settings.theme === value && 'active')}
                  onClick={() => set('theme', value)}
                >
                  <div
                    className="theme-preview"
                    style={{
                      background:
                        value === 'dark'
                          ? '#1b1c1e'
                          : value === 'light'
                            ? '#f3f4f6'
                            : 'linear-gradient(135deg, #f3f4f6 50%, #1b1c1e 50%)',
                    }}
                  >
                    <div
                      className="tp-side"
                      style={{ background: value === 'dark' ? '#141517' : '#e7e9ec' }}
                    />
                    <div className="tp-main">
                      <div
                        className="tp-line"
                        style={{
                          width: '75%',
                          background: value === 'dark' ? '#3a3d41' : '#d3d6db',
                        }}
                      />
                      <div
                        className="tp-line"
                        style={{
                          width: '50%',
                          background: value === 'dark' ? '#2e3134' : '#e1e3e7',
                        }}
                      />
                    </div>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon size={11} /> {label}
                  </span>
                </button>
              ))}
            </div>

            <div className="setting-row">
              <div className="sr-main">
                <div className="sr-label">
                  <Palette size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> Акцентний колір
                </div>
                <div className="sr-desc">Кнопки, виділення та графіки</div>
              </div>
            </div>
            <div className="swatches">
              {ACCENTS.map((accent) => (
                <button
                  key={accent.id}
                  className={cn('swatch', settings.accent === accent.value && 'active')}
                  style={{ background: accent.value, color: accent.value }}
                  onClick={() => set('accent', accent.value)}
                  aria-label={accent.name}
                  title={accent.name}
                />
              ))}
            </div>

            <div className="setting-row">
              <div className="sr-main">
                <div className="sr-label">Компактний вигляд</div>
                <div className="sr-desc">Менші відступи у списку задач</div>
              </div>
              <Switch
                checked={settings.compactMode}
                onChange={(value) => set('compactMode', value)}
                label="Компактний вигляд"
              />
            </div>
          </section>

          <section className="settings-card">
            <h3>
              <Coins size={14} style={{ verticalAlign: -2, marginRight: 5 }} /> Ставка й норми
            </h3>
            <div className="card-desc">
              Базова ставка для списків без власної ставки. Окрему ставку можна задати в кожному
              списку.
            </div>

            <NumberSetting
              label="Погодинна ставка"
              desc={`Зараз: ${formatMoney(settings.hourlyRate, settings.currency, 0)} за годину`}
              value={settings.hourlyRate}
              min={0}
              step={10}
              onChange={(value) => set('hourlyRate', value)}
            />

            <CurrencySetting value={settings.currency} onChange={(value) => set('currency', value)} />

            <NumberSetting
              label="Податки, %"
              desc="За замовчуванням 19,5% (ПДФО 18% + військовий збір 1,5%)"
              value={settings.taxPercent}
              min={0}
              max={100}
              step={0.5}
              onChange={(value) => set('taxPercent', value)}
            />

            <div className="setting-row">
              <div className="sr-main">
                <div className="sr-label">Понаднормові</div>
                <div className="sr-desc">
                  Години понад денну норму оплачуються з множником ×
                  {formatNumber(settings.overtimeMultiplier, 1)}
                </div>
              </div>
              <Switch
                checked={settings.overtimeEnabled}
                onChange={(value) => set('overtimeEnabled', value)}
                label="Понаднормові"
              />
            </div>

            <NumberSetting
              label="Множник понаднормових"
              value={settings.overtimeMultiplier}
              min={1}
              max={5}
              step={0.1}
              onChange={(value) => set('overtimeMultiplier', value)}
            />

            <NumberSetting
              label="Денна норма, год"
              desc="Після цієї кількості годин починаються понаднормові"
              value={settings.dailyNormHours}
              min={0}
              max={24}
              step={0.5}
              onChange={(value) => set('dailyNormHours', value)}
            />

            <NumberSetting
              label="Тижнева норма, год"
              desc="Довідково для планування"
              value={settings.weeklyNormHours}
              min={0}
              max={168}
              step={1}
              onChange={(value) => set('weeklyNormHours', value)}
            />
          </section>

          <section className="settings-card">
            <h3>
              <Bell size={14} style={{ verticalAlign: -2, marginRight: 5 }} /> Нагадування
            </h3>
            <div className="card-desc">Системні сповіщення для задач із нагадуванням.</div>

            <div className="setting-row" style={{ paddingTop: 0 }}>
              <div className="sr-main">
                <div className="sr-label">Сповіщення</div>
                <div className="sr-desc">
                  {settings.notifications
                    ? 'Увімкнено. Задайте час нагадування у деталях задачі.'
                    : 'Вимкнено — нагадування не показуватимуться.'}
                </div>
              </div>
              <Switch
                checked={settings.notifications}
                onChange={toggleNotifications}
                label="Сповіщення"
              />
            </div>

            <div className="setting-row">
              <div className="sr-main">
                <div className="sr-label">Приватність</div>
                <div className="sr-desc">
                  VibeDo не надсилає дані в мережу. Нагадування обробляються локально.
                </div>
              </div>
              <ShieldCheck size={18} style={{ color: 'var(--success)' }} />
            </div>

            <NumberSetting
              label="Нагадати про зарплату, дн."
              desc="За скільки днів повідомляти про зарплатний день (0 — вимкнути)"
              value={settings.paydayReminderDays}
              min={0}
              max={30}
              step={1}
              onChange={(value) => set('paydayReminderDays', value)}
            />
          </section>

          <SyncCard />

          <section className="settings-card">
            <h3>
              <Timer size={14} style={{ verticalAlign: -2, marginRight: 5 }} /> Pomodoro
            </h3>
            <div className="card-desc">
              Фокус-таймер запускається з деталей задачі та автоматично веде запис часу.
            </div>

            <NumberSetting
              label="Тривалість фокусу, хв"
              value={settings.pomodoroWorkMinutes}
              min={1}
              max={180}
              step={5}
              onChange={(value) => set('pomodoroWorkMinutes', value)}
            />

            <NumberSetting
              label="Тривалість перерви, хв"
              value={settings.pomodoroBreakMinutes}
              min={1}
              max={60}
              step={1}
              onChange={(value) => set('pomodoroBreakMinutes', value)}
            />

            <div className="setting-row">
              <div className="sr-main">
                <div className="sr-label">Автоматична перерва</div>
                <div className="sr-desc">
                  Після завершення фокусу одразу запускати таймер перерви
                </div>
              </div>
              <Switch
                checked={settings.pomodoroAutoBreak}
                onChange={(value) => set('pomodoroAutoBreak', value)}
                label="Автоматична перерва"
              />
            </div>
          </section>

          <section className="settings-card">
            <h3>
              <Database size={14} style={{ verticalAlign: -2, marginRight: 5 }} /> Дані
            </h3>
            <div className="card-desc">
              Задачі, записи часу та налаштування зберігаються у JSON-файлі на цьому комп’ютері.
              Резервні копії створюються автоматично раз на день (останні 14).
            </div>

            <div className="data-actions" style={{ marginBottom: 12 }}>
              <button className="btn btn-soft btn-sm" onClick={handleExport} disabled={busy}>
                <Download size={14} /> Експорт JSON
              </button>
              <button className="btn btn-soft btn-sm" onClick={handleImport} disabled={busy}>
                <Upload size={14} /> Імпорт JSON
              </button>
              {isDesktopApp() && (
                <button className="btn btn-soft btn-sm" onClick={handleOpenFolder}>
                  <FolderOpen size={14} /> Папка з даними
                </button>
              )}
            </div>

            <div className="about-box" style={{ marginBottom: 10 }}>
              <ShieldCheck size={20} style={{ color: 'var(--success)', flex: 'none' }} />
              <div>
                <b style={{ fontSize: 13 }}>Локально та приватно</b>
                <span>
                  {tasks.length} задач · {lists.length} списків · {entries.length} записів часу
                </span>
              </div>
            </div>

            {info.dataPath && (
              <div className="data-path" title={info.dataPath}>
                {info.dataPath}
              </div>
            )}

            <div className="setting-row" style={{ marginTop: 10 }}>
              <div className="sr-main">
                <div className="sr-label">Скинути всі дані</div>
                <div className="sr-desc">Видалити задачі, час і налаштування та почати заново.</div>
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={13} /> Скинути
              </button>
            </div>
          </section>

          <section className="settings-card">
            <h3>Про застосунок</h3>
            <div className="about-box">
              <div className="brand-mark">
                <LogoMark size={22} />
              </div>
              <div>
                <b>VibeDo {info.version}</b>
                <span>Локальний планувальник · Electron · Android</span>
              </div>
            </div>
            <div className="setting-row" style={{ paddingTop: 0 }}>
              <div className="sr-main">
                <div className="sr-label">Відкритий вихідний код</div>
                <div className="sr-desc">
                  Ліцензія MIT: безкоштовно, можна змінювати та розповсюджувати. Без реклами,
                  підписок і телеметрії.
                </div>
              </div>
              <span className="badge accent">MIT</span>
            </div>
            <div className="setting-row">
              <div className="sr-main">
                <div className="sr-label">Де лежать дані</div>
                <div className="sr-desc">
                  {isDesktopApp()
                    ? 'Файл vibedo-data.json у папці застосунку. Автозбереження після кожної зміни.'
                    : 'IndexedDB/localStorage браузера (веб-режим).'}
                </div>
              </div>
            </div>
            <div className="field-hint" style={{ paddingTop: 3 }}>
              Поточна дата: {formatDateInput(Date.now())} · {info.platform || 'web'} · зроблено з
              любов’ю до локальності
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="Імпортувати резервну копію?"
        text={
          pendingImport ? (
            <>
              У файлі: {pendingImport.tasks.length} задач, {pendingImport.lists.length} списків і{' '}
              {pendingImport.entries.length} записів часу. Поточні дані буде замінено. Рекомендуємо
              спершу зробити експорт.
            </>
          ) : null
        }
        confirmLabel="Імпортувати"
        danger={false}
        onConfirm={() => {
          if (pendingImport) {
            replaceData(pendingImport)
            setPendingImport(null)
            toast('Дані імпортовано')
          }
        }}
        onClose={() => setPendingImport(null)}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Скинути всі дані?"
        text="Усі задачі, списки, записи часу й налаштування буде видалено без можливості відновлення. Спершу зробіть експорт, якщо потрібна копія."
        confirmLabel="Видалити все"
        onConfirm={() => {
          resetAllData()
          toast('Дані скинуто до початкового стану')
        }}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  )
}
