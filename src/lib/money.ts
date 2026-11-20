import type { AppData, MoneyBudget, MoneyCategory, MoneyTransaction } from '../types'
import { addDaysKey, dateKey, keyToDate, todayKey } from './utils'

export type MoneyPeriod = 'week' | 'month' | 'year' | 'all'

export interface DateRange {
  from: string
  to: string
}

export function moneyPeriodRange(period: MoneyPeriod, today = todayKey()): DateRange {
  if (period === 'all') return { from: '0000-01-01', to: '9999-12-31' }
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today }
  if (period === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: today }
  const day = keyToDate(today).getDay()
  const mondayOffset = (day + 6) % 7
  return { from: addDaysKey(today, -mondayOffset), to: today }
}

export function inDateRange(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to
}

export interface MoneySummary {
  income: number
  expense: number
  balance: number
  count: number
  byCategory: Array<{ categoryId: string; income: number; expense: number }>
  byDay: Array<{ date: string; income: number; expense: number }>
}

export function computeMoneySummary(
  transactions: MoneyTransaction[],
  range: DateRange,
): MoneySummary {
  const categoryMap = new Map<string, { categoryId: string; income: number; expense: number }>()
  const dayMap = new Map<string, { date: string; income: number; expense: number }>()
  let income = 0
  let expense = 0
  let count = 0

  for (const item of transactions) {
    if (!inDateRange(item.date, range)) continue
    count += 1
    const amount = Math.round(item.amount * 100) / 100
    if (item.kind === 'income') income += amount
    else expense += amount

    const category = categoryMap.get(item.categoryId || '') ?? {
      categoryId: item.categoryId || '',
      income: 0,
      expense: 0,
    }
    category[item.kind] += amount
    categoryMap.set(category.categoryId, category)

    const day = dayMap.get(item.date) ?? { date: item.date, income: 0, expense: 0 }
    day[item.kind] += amount
    dayMap.set(item.date, day)
  }

  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    balance: Math.round((income - expense) * 100) / 100,
    count,
    byCategory: [...categoryMap.values()],
    byDay: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export interface BudgetProgress {
  budget: MoneyBudget
  spent: number
  percent: number
  label: string
}

export function computeBudgetProgress(
  data: AppData,
  today = todayKey(),
): BudgetProgress[] {
  return data.budgets.map((budget) => {
    const range = budget.period === 'month'
      ? moneyPeriodRange('month', today)
      : moneyPeriodRange('year', today)
    const spent = data.transactions
      .filter((item) => item.kind === 'expense' && item.categoryId === budget.categoryId && inDateRange(item.date, range))
      .reduce((sum, item) => sum + item.amount, 0)
    const category = data.categories.find((item) => item.id === budget.categoryId)
    return {
      budget,
      spent: Math.round(spent * 100) / 100,
      percent: budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0,
      label: budget.categoryId === 'all' ? 'Усі категорії' : category?.name ?? 'Без категорії',
    }
  })
}

export function categoryLabel(id: string, categories: MoneyCategory[]): string {
  if (!id) return 'Без категорії'
  return categories.find((item) => item.id === id)?.name ?? 'Без категорії'
}

export function transactionsToCsv(
  transactions: MoneyTransaction[],
  categories: MoneyCategory[],
): string {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
  const rows = [['Дата', 'Тип', 'Сума', 'Категорія', 'Нотатка']]
  for (const item of [...transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([
      item.date,
      item.kind === 'income' ? 'Дохід' : 'Витрата',
      item.amount.toFixed(2),
      categoryLabel(item.categoryId, categories),
      item.note,
    ])
  }
  return `\uFEFF${rows.map((row) => row.map(escape).join(';')).join('\r\n')}`
}

export function monthLabel(key: string): string {
  const date = keyToDate(`${key}-01`)
  return dateKey(date).slice(0, 7)
}
