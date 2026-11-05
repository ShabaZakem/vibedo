import { useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  Clock,
  Flame,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type { AppData } from '../types'
import { useAppStore } from '../store'
import { computeStats } from '../lib/stats'
import {
  formatDateInput,
  formatDuration,
  formatMoney,
  formatNumber,
  keyToDate,
  pluralizeUk,
  todayKey,
} from '../lib/utils'
import { BarChart, Segmented, type ChartPoint } from '../components/ui'
import { tagColor } from '../constants'

const RANGES = [
  { value: '7', label: '7 днів' },
  { value: '30', label: '30 днів' },
  { value: '90', label: '90 днів' },
] as const

type RangeValue = (typeof RANGES)[number]['value']

export function StatsPage() {
  const tasks = useAppStore((state) => state.tasks)
  const entries = useAppStore((state) => state.entries)
  const lists = useAppStore((state) => state.lists)
  const settings = useAppStore((state) => state.settings)
  const [range, setRange] = useState<RangeValue>('30')

  const data = useMemo(
    () => ({ tasks, entries, lists, settings } as AppData),
    [tasks, entries, lists, settings],
  )
  const stats = useMemo(() => computeStats(data, Number(range)), [data, range])

  const chart = useMemo<ChartPoint[]>(() => {
    return stats.days.slice(-14).map((day) => ({
      key: day.key,
      label: keyToDate(day.key).getDate().toString(),
      value: day.seconds / 3600,
      tooltip: `${keyToDate(day.key).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })} · ${formatDuration(day.seconds)} · ${day.completed} виконано · ${formatMoney(day.earnings, settings.currency, 0)}`,
    }))
  }, [stats.days, settings.currency])

  const heatmap = useMemo(() => {
    const map = new Map<string, { seconds: number; completed: number }>()
    for (const entry of entries) {
      const key = formatDateInput(entry.startedAt)
      const item = map.get(key) ?? { seconds: 0, completed: 0 }
      item.seconds += entry.seconds
      map.set(key, item)
    }
    for (const task of tasks) {
      if (!task.completedAt) continue
      const key = formatDateInput(task.completedAt)
      const item = map.get(key) ?? { seconds: 0, completed: 0 }
      item.completed += 1
      map.set(key, item)
    }
    const today = keyToDate(todayKey())
    const days: { key: string; seconds: number; completed: number; date: Date }[] = []
    for (let index = 83; index >= 0; index -= 1) {
      const date = new Date(today)
      date.setDate(today.getDate() - index)
      const key = formatDateInput(date.getTime())
      const item = map.get(key) ?? { seconds: 0, completed: 0 }
      days.push({ key, ...item, date })
    }
    const weeks: (typeof days)[] = []
    for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7))
    return weeks
  }, [entries, tasks])

  const maxTag = Math.max(1, ...stats.topTags.map((tag) => tag.count))
  const avgPerActiveDay = stats.activeDays > 0 ? stats.seconds / stats.activeDays : 0
  const todayCount = tasks.filter(
    (task) => task.myDayDate === todayKey() && !task.completed,
  ).length

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-header">
          <div className="page-header-main">
            <div className="eyebrow">Аналітика</div>
            <h1 className="page-title">Статистика</h1>
            <div className="page-sub">
              Продуктивність, фокус і заробіток за останні {range} днів.
            </div>
          </div>
          <div className="page-actions">
            <Segmented options={[...RANGES]} value={range} onChange={setRange} />
          </div>
        </div>

        <div className="stats-grid">
          <div className="stats-card highlight">
            <span className="stats-label">
              <Flame size={15} /> Серія
            </span>
            <b className="stats-value">{stats.streak}</b>
            <span className="stats-hint">
              {pluralizeUk(stats.streak, ['день поспіль', 'дні поспіль', 'днів поспіль'])} · рекорд{' '}
              {stats.bestStreak}
            </span>
          </div>
          <div className="stats-card">
            <span className="stats-label">
              <Clock size={15} /> Час у фокусі
            </span>
            <b className="stats-value">{formatNumber(stats.seconds / 3600, 1)} год</b>
            <span className="stats-hint">
              {stats.activeDays} {pluralizeUk(stats.activeDays, ['активний день', 'активні дні', 'активних днів'])}
            </span>
          </div>
          <div className="stats-card">
            <span className="stats-label">
              <Sparkles size={15} /> Виконано
            </span>
            <b className="stats-value">{stats.completed}</b>
            <span className="stats-hint">
              {pluralizeUk(stats.completed, ['задача', 'задачі', 'задач'])} · у Мому дні зараз {todayCount}
            </span>
          </div>
          <div className="stats-card">
            <span className="stats-label">
              <Wallet size={15} /> На руки
            </span>
            <b className="stats-value">{formatMoney(stats.net, settings.currency, 0)}</b>
            <span className="stats-hint">
              {formatMoney(stats.gross, settings.currency, 0)} до податків
            </span>
          </div>
        </div>

        <div className="stats-two">
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Фокус за 14 днів</div>
                <div className="card-sub">Години роботи з таймера</div>
              </div>
              <span className="spacer" />
              <span className="badge accent">
                <TrendingUp size={11} /> {formatNumber(avgPerActiveDay / 3600, 1)} год/день
              </span>
            </div>
            <BarChart
              points={chart}
              formatValue={(value) => `${formatNumber(value, 1)} год`}
            />
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Активність</div>
                <div className="card-sub">Останні 12 тижнів</div>
              </div>
            </div>
            <div className="heatmap-wrap">
              <div className="heatmap">
                {heatmap.map((week) => (
                  <div className="heatmap-week" key={week[0]?.key}>
                    {week.map((day) => {
                      const level =
                        day.seconds >= 4 * 3600
                          ? 4
                          : day.seconds >= 2 * 3600
                            ? 3
                            : day.seconds >= 3600
                              ? 2
                              : day.seconds > 0 || day.completed > 0
                                ? 1
                                : 0
                      return (
                        <span
                          key={day.key}
                          className={`heat-cell level-${level}`}
                          title={`${day.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}: ${formatDuration(day.seconds)}, ${day.completed} виконано`}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="heatmap-legend">
                <span>Менше</span>
                {[0, 1, 2, 3, 4].map((level) => (
                  <i key={level} className={`heat-cell level-${level}`} />
                ))}
                <span>Більше</span>
              </div>
            </div>
          </div>
        </div>

        <div className="stats-two">
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Теги</div>
                <div className="card-sub">За виконаними задачами</div>
              </div>
            </div>
            {stats.topTags.length === 0 ? (
              <div className="dim" style={{ fontSize: 12.5, padding: '10px 0' }}>
                Додавайте теги до задач — тут з’явиться розподіл.
              </div>
            ) : (
              <div className="tag-stats">
                {stats.topTags.map((tag) => (
                  <div className="tag-stat-row" key={tag.tag}>
                    <span className="tag-chip small" style={{ color: tagColor(tag.tag) }}>
                      #{tag.tag}
                    </span>
                    <div className="tag-stat-track">
                      <span
                        style={{
                          width: `${(tag.count / maxTag) * 100}%`,
                          background: tagColor(tag.tag),
                        }}
                      />
                    </div>
                    <b>{tag.count}</b>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Підсумок</div>
                <div className="card-sub">За обраний період</div>
              </div>
            </div>
            <div className="stats-list">
              <div>
                <span>
                  <CalendarDays size={13} /> Активних днів
                </span>
                <b>
                  {stats.activeDays} / {range}
                </b>
              </div>
              <div>
                <span>
                  <Clock size={13} /> Середній фокус
                </span>
                <b>{formatDuration(avgPerActiveDay)}</b>
              </div>
              <div>
                <span>
                  <BarChart3 size={13} /> Заробіток за годину
                </span>
                <b>
                  {stats.seconds > 0
                    ? formatMoney(stats.gross / (stats.seconds / 3600), settings.currency, 0)
                    : '—'}
                </b>
              </div>
              <div>
                <span>
                  <Wallet size={13} /> Податки
                </span>
                <b>{formatMoney(stats.gross - stats.net, settings.currency, 0)}</b>
              </div>
            </div>
            <div className="stats-quote">
              «Маленькі кроки щодня — це і є великий результат.»
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
