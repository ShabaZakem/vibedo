import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Calculator,
  CalendarDays,
  Clock,
  Download,
  Receipt,
  Settings2,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  amountForEntry,
  calcSalary,
  formatDateInput,
  formatDuration,
  formatLongDate,
  formatMoney,
  formatMonth,
  formatNumber,
  formatWeekRange,
  rangeFor,
} from '../lib/utils'
import { useAppStore } from '../store'
import type { Period } from '../lib/utils'
import { saveTextFile } from '../lib/storage'
import { BarChart, Field, Segmented, toast, type ChartPoint } from '../components/ui'

type SalaryPeriod = Exclude<Period, 'custom'>

const PERIODS: { value: SalaryPeriod; label: string }[] = [
  { value: 'today', label: 'Сьогодні' },
  { value: 'week', label: 'Тиждень' },
  { value: 'month', label: 'Місяць' },
  { value: 'all', label: 'Увесь час' },
]

function periodLabel(period: SalaryPeriod): string {
  if (period === 'today') return formatLongDate(new Date())
  if (period === 'week') return formatWeekRange()
  if (period === 'month') return formatMonth(new Date())
  return 'За весь час роботи'
}

export function SalaryPage() {
  const entries = useAppStore((state) => state.entries)
  const lists = useAppStore((state) => state.lists)
  const tasks = useAppStore((state) => state.tasks)
  const settings = useAppStore((state) => state.settings)
  const activeTimer = useAppStore((state) => state.activeTimer)
  const paydays = useAppStore((state) => state.paydays)
  const setView = useAppStore((state) => state.setView)

  const [period, setPeriod] = useState<SalaryPeriod>('month')
  const [rate, setRate] = useState(String(settings.hourlyRate))
  const [hoursPerDay, setHoursPerDay] = useState(String(settings.dailyNormHours))
  const [daysPerMonth, setDaysPerMonth] = useState('21')
  const [overtimeHours, setOvertimeHours] = useState('0')
  const [taxPercent, setTaxPercent] = useState(String(settings.taxPercent))

  useEffect(() => {
    setRate(String(settings.hourlyRate))
    setHoursPerDay(String(settings.dailyNormHours))
    setTaxPercent(String(settings.taxPercent))
  }, [settings.hourlyRate, settings.dailyNormHours, settings.taxPercent])

  const range = useMemo(
    () => rangeFor(period === 'all' ? 'all' : period),
    [period],
  )
  const summary = useMemo(
    () => calcSalary(entries, lists, settings, range),
    [entries, lists, settings, range],
  )

  const chartPoints = useMemo<ChartPoint[]>(() => {
    const money = (value: number) => formatMoney(value, settings.currency, 0)
    if (period === 'all' || summary.byDay.length > 45) {
      const months = new Map<string, { amount: number; seconds: number }>()
      for (const entry of summary.entries) {
        const date = new Date(entry.startedAt)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const amount = amountForEntry(entry, entries, lists, settings).amount
        const bucket = months.get(key) ?? { amount: 0, seconds: 0 }
        bucket.amount += amount
        bucket.seconds += entry.seconds
        months.set(key, bucket)
      }
      return [...months.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => {
          const [year, month] = key.split('-').map(Number)
          const date = new Date(year, month - 1, 1)
          return {
            key,
            label: date.toLocaleDateString('uk-UA', { month: 'short' }),
            value: value.amount,
            tooltip: `${formatMonth(date)} · ${formatDuration(value.seconds)} · ${money(value.amount)}`,
          }
        })
    }

    const byDay = new Map(summary.byDay.map((bucket) => [bucket.key, bucket]))
    const start = new Date(range.start)
    const end = new Date(range.end - 1)
    const points: ChartPoint[] = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    let guard = 0
    while (cursor <= end && guard < 120) {
      const key = formatDateInput(cursor.getTime())
      const bucket = byDay.get(key)
      points.push({
        key,
        label: String(cursor.getDate()),
        value: bucket?.amount ?? 0,
        tooltip: `${cursor.toLocaleDateString('uk-UA', {
          day: 'numeric',
          month: 'long',
        })} · ${formatDuration(bucket?.seconds ?? 0)} · ${money(bucket?.amount ?? 0)}`,
      })
      cursor.setDate(cursor.getDate() + 1)
      guard += 1
    }
    return points
  }, [period, summary, range, entries, lists, settings])

  const numericRate = Math.max(0, Number(rate.replace(',', '.')) || 0)
  const numericHours = Math.max(0, Number(hoursPerDay.replace(',', '.')) || 0)
  const numericDays = Math.max(0, Number(daysPerMonth.replace(',', '.')) || 0)
  const numericOvertime = Math.max(0, Number(overtimeHours.replace(',', '.')) || 0)
  const numericTax = Math.max(0, Math.min(100, Number(taxPercent.replace(',', '.')) || 0))

  const basePay = numericRate * numericHours * numericDays
  const overtimePay = numericRate * numericOvertime * Math.max(1, settings.overtimeMultiplier)
  const calcGross = basePay + overtimePay
  const calcTax = (calcGross * numericTax) / 100
  const calcNet = calcGross - calcTax
  const calcYear = calcNet * 12

  const exportCsv = async () => {
    const header = ['Дата', 'Початок', 'Кінець', 'Задача', 'Список', 'Години', 'Ставка', 'Сума', 'Нотатка']
    const rows = summary.entries.map((entry) => {
      const task = tasks.find((item) => item.id === entry.taskId)
      const list = lists.find((item) => item.id === entry.listId)
      const amount = amountForEntry(entry, entries, lists, settings)
      const start = new Date(entry.startedAt)
      const end = new Date(entry.endedAt)
      return [
        formatDateInput(entry.startedAt),
        start.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
        end.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
        task?.title ?? entry.note ?? 'Без задачі',
        list?.name ?? '',
        (entry.seconds / 3600).toFixed(2),
        formatNumber(amount.rate, 2),
        formatNumber(amount.amount, 2),
        entry.note,
      ]
    })
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')}`
    const result = await saveTextFile(
      `vibedo-${period}-${formatDateInput(Date.now())}.csv`,
      csv,
      [{ name: 'CSV', extensions: ['csv'] }],
    )
    if (result.ok) toast(result.path ? `Збережено: ${result.path}` : 'CSV збережено')
    else if (!result.canceled) toast('Не вдалося зберегти файл')
  }

  const useSettingsValues = () => {
    setRate(String(settings.hourlyRate))
    setHoursPerDay(String(settings.dailyNormHours))
    setTaxPercent(String(settings.taxPercent))
    toast('Значення взято з налаштувань')
  }

  const maxListAmount = Math.max(0, ...summary.byList.map((bucket) => bucket.amount))

  const upcomingPayday = useMemo(() => {
    const today = formatDateInput(Date.now())
    return (
      [...paydays]
        .filter((payday) => payday.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
    )
  }, [paydays])

  const paydayDays = upcomingPayday
    ? Math.round(
        (new Date(`${upcomingPayday.date}T00:00:00`).getTime() -
          new Date(`${formatDateInput(Date.now())}T00:00:00`).getTime()) /
          86_400_000,
      )
    : 0

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div className="page-header-main">
            <div className="eyebrow">Гроші</div>
            <h1 className="page-title">Заробіток</h1>
            <div className="page-sub">
              {periodLabel(period)} · розрахунок за фактично відстеженими годинами
            </div>
          </div>
          <div className="page-actions">
            <Segmented options={PERIODS} value={period} onChange={setPeriod} />
            <button className="btn btn-soft" onClick={exportCsv} disabled={summary.entries.length === 0}>
              <Download size={15} /> CSV
            </button>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card accent">
            <div className="stat-head">
              <span className="stat-label">Нараховано</span>
              <Wallet size={15} />
            </div>
            <div className="stat-value">{formatMoney(summary.gross, settings.currency, 0)}</div>
            <div className="stat-hint">
              {formatDuration(summary.seconds)} · {summary.entries.length} записів
            </div>
          </div>
          <div className="stat-card money">
            <div className="stat-head">
              <span className="stat-label">На руки</span>
              <TrendingUp size={15} />
            </div>
            <div className="stat-value">{formatMoney(summary.net, settings.currency, 0)}</div>
            <div className="stat-hint">після податку {formatNumber(settings.taxPercent, 1)}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-head">
              <span className="stat-label">Податки</span>
              <Receipt size={15} />
            </div>
            <div className="stat-value">{formatMoney(summary.taxes, settings.currency, 0)}</div>
            <div className="stat-hint">
              {formatNumber(settings.taxPercent, 1)}% від нарахованого
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-head">
              <span className="stat-label">Понаднормові</span>
              <Clock size={15} />
            </div>
            <div className="stat-value">
              {formatDuration(summary.overtimeSeconds)}
              <span className="unit"> </span>
            </div>
            <div className="stat-hint">
              {settings.overtimeEnabled
                ? `множник ×${formatNumber(settings.overtimeMultiplier, 1)} понад ${settings.dailyNormHours} год/день`
                : 'вимкнено в налаштуваннях'}
            </div>
          </div>
        </div>

        {upcomingPayday && (
          <div className="payday-strip">
            <span className="payday-strip-icon">
              <Wallet size={15} />
            </span>
            <div>
              <b>
                {upcomingPayday.note || 'Зарплата'}
                {upcomingPayday.amount !== null
                  ? ` · ${formatMoney(upcomingPayday.amount, settings.currency, 0)}`
                  : ''}
              </b>
              <span>
                {paydayDays <= 0
                  ? 'Сьогодні зарплатний день'
                  : paydayDays === 1
                    ? 'Завтра'
                    : `Через ${paydayDays} дн.`}{' '}
                · {formatLongDate(new Date(`${upcomingPayday.date}T00:00:00`))}
              </span>
            </div>
            <span className="spacer" />
            <button className="btn btn-sm btn-ghost" onClick={() => setView({ kind: 'calendar' })}>
              <CalendarDays size={13} /> Календар
            </button>
          </div>
        )}

        {activeTimer && (
          <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="live-dot" />
            <span className="muted" style={{ fontSize: 12 }}>
              Таймер ще працює — поточна сесія потрапить у розрахунок після зупинки.
            </span>
            <span className="spacer" />
            <button className="btn btn-sm btn-ghost" onClick={() => setView({ kind: 'time' })}>
              До трекера <ArrowRight size={13} />
            </button>
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Динаміка заробітку</div>
              <div className="card-sub">
                {period === 'all' ? 'за місяцями' : 'за днями'} ·{' '}
                {formatMoney(summary.gross, settings.currency, 0)}
              </div>
            </div>
          </div>
          <BarChart
            points={chartPoints}
            formatValue={(value) => formatMoney(value, settings.currency, 0)}
          />
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Розподіл по списках</div>
              <div className="card-sub">Скільки приніс кожен проєкт</div>
            </div>
          </div>
          {summary.byList.length === 0 ? (
            <div className="dim" style={{ fontSize: 12.5, padding: '10px 0' }}>
              Ще немає записів часу за цей період.
            </div>
          ) : (
            <div className="breakdown">
              {summary.byList.map((bucket) => {
                const list = lists.find((item) => item.id === bucket.key)
                const percent = maxListAmount > 0 ? (bucket.amount / maxListAmount) * 100 : 0
                return (
                  <div className="breakdown-row" key={bucket.key}>
                    <div className="breakdown-head">
                      <span
                        className="list-dot"
                        style={{ background: list?.color ?? 'var(--accent)', width: 8, height: 8 }}
                      />
                      {list?.name ?? 'Без списку'}
                      <span>{formatDuration(bucket.seconds)}</span>
                      <b>{formatMoney(bucket.amount, settings.currency)}</b>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${percent}%`,
                          background: list?.color ?? 'var(--accent)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                <Calculator size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
                Калькулятор зарплати
              </div>
              <div className="card-sub">Попередній розрахунок на місяць</div>
            </div>
            <span className="spacer" />
            <button
              className="btn btn-sm btn-ghost"
              onClick={useSettingsValues}
              title="Взяти ставку, норму й податок з налаштувань"
            >
              <Settings2 size={13} /> З налаштувань
            </button>
          </div>
          <div className="calc-grid">
            <div className="calc-form">
              <Field label="Ставка, ₴/год">
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="10"
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                />
              </Field>
              <Field label="Годин на день">
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.5"
                  value={hoursPerDay}
                  onChange={(event) => setHoursPerDay(event.target.value)}
                />
              </Field>
              <Field label="Днів на місяць">
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  value={daysPerMonth}
                  onChange={(event) => setDaysPerMonth(event.target.value)}
                />
              </Field>
              <Field label="Понаднормові, год">
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  value={overtimeHours}
                  onChange={(event) => setOvertimeHours(event.target.value)}
                />
              </Field>
              <Field label="Податки, %">
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={taxPercent}
                  onChange={(event) => setTaxPercent(event.target.value)}
                />
              </Field>
            </div>
            <div className="calc-out">
              <div className="calc-line">
                <span>
                  Базова оплата ({formatNumber(numericHours, 1)} × {formatNumber(numericDays, 0)} год ·{' '}
                  {settings.currency} {formatNumber(numericRate, 0)})
                </span>
                <b>{formatMoney(basePay, settings.currency, 0)}</b>
              </div>
              <div className="calc-line">
                <span>
                  Понаднормові ({formatNumber(numericOvertime, 1)} год ×{' '}
                  {formatNumber(settings.overtimeMultiplier, 1)})
                </span>
                <b>{formatMoney(overtimePay, settings.currency, 0)}</b>
              </div>
              <div className="calc-line">
                <span>Податки ({formatNumber(numericTax, 1)}%)</span>
                <b>−{formatMoney(calcTax, settings.currency, 0)}</b>
              </div>
              <div className="calc-line total">
                <span>На руки / місяць</span>
                <b>{formatMoney(calcNet, settings.currency, 0)}</b>
              </div>
              <div className="calc-line">
                <span>На руки / рік</span>
                <b>{formatMoney(calcYear, settings.currency, 0)}</b>
              </div>
              <div className="calc-note">
                Формула: ставка × години × дні + понаднормові × ставка × множник, мінус податок.
                Фактичні суми за період рахуються з трекера окремо.
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Записи за період</div>
              <div className="card-sub">
                {summary.entries.length} · {formatDuration(summary.seconds)}
              </div>
            </div>
            <span className="spacer" />
            <button className="btn btn-sm btn-ghost" onClick={() => setView({ kind: 'time' })}>
              Усі записи <ArrowRight size={13} />
            </button>
          </div>
          {summary.entries.length === 0 ? (
            <div className="dim" style={{ fontSize: 12.5, padding: '8px 0' }}>
              Немає даних за цей період. Запустіть таймер у трекері.
            </div>
          ) : (
            <div className="entry-list">
              {[...summary.entries]
                .sort((a, b) => b.startedAt - a.startedAt)
                .slice(0, 12)
                .map((entry) => {
                  const task = tasks.find((item) => item.id === entry.taskId)
                  const list = lists.find((item) => item.id === entry.listId)
                  const amount = amountForEntry(entry, entries, lists, settings)
                  return (
                    <div className="entry-row" key={entry.id}>
                      <div className="entry-ico">
                        <Clock size={15} />
                      </div>
                      <div className="entry-main">
                        <div className="entry-title">
                          {task?.title ?? (entry.note.trim() || 'Без задачі')}
                        </div>
                        <div className="entry-sub">
                          {new Date(entry.startedAt).toLocaleDateString('uk-UA', {
                            day: 'numeric',
                            month: 'short',
                          })}
                          , {new Date(entry.startedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                          {list && (
                            <>
                              <span className="sep">·</span>
                              <span className="list-dot" style={{ background: list.color, width: 6, height: 6 }} />
                              {list.name}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="entry-dur">{formatDuration(entry.seconds)}</div>
                      <div className="entry-amount">{formatMoney(amount.amount, settings.currency)}</div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        <div className="field-hint" style={{ textAlign: 'center', paddingBottom: 8 }}>
          Погодинна ставка за замовчуванням:{' '}
          {formatMoney(settings.hourlyRate, settings.currency, 0)} ·{' '}
          <button
            style={{ color: 'var(--accent-strong)', textDecoration: 'underline', fontSize: 11 }}
            onClick={() => setView({ kind: 'settings' })}
          >
            змінити в налаштуваннях
          </button>{' '}
          · ставка списку має пріоритет · локальний розрахунок, без серверів
        </div>
      </div>
    </div>
  )
}

