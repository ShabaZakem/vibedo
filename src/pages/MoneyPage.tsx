import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Pencil,
  Plus,
  Repeat2,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react'
import type {
  ID,
  MoneyCategory,
  MoneyKind,
  MoneyRecurring,
  MoneyTransaction,
  RepeatFreq,
} from '../types'
import { MONEY_CATEGORY_PRESETS, REPEAT_LABELS } from '../constants'
import {
  computeBudgetProgress,
  computeMoneySummary,
  categoryLabel,
  moneyPeriodRange,
  transactionsToCsv,
  type MoneyPeriod,
} from '../lib/money'
import { saveTextFile } from '../lib/storage'
import { cn, formatDateInput, formatDayLabel, formatMoney } from '../lib/utils'
import { useAppStore } from '../store'
import { ConfirmDialog, Modal, Segmented, toast } from '../components/ui'

type Tab = 'overview' | 'transactions' | 'recurring' | 'budgets' | 'categories'

const PERIODS: Array<{ value: MoneyPeriod; label: string }> = [
  { value: 'week', label: 'Тиждень' },
  { value: 'month', label: 'Місяць' },
  { value: 'year', label: 'Рік' },
  { value: 'all', label: 'Усе' },
]

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'overview', label: 'Огляд' },
  { value: 'transactions', label: 'Транзакції' },
  { value: 'recurring', label: 'Повторювані' },
  { value: 'budgets', label: 'Бюджети' },
  { value: 'categories', label: 'Категорії' },
]

const FREQS: Array<{ value: RepeatFreq; label: string }> = [
  { value: 'daily', label: 'Щодня' },
  { value: 'weekly', label: 'Щотижня' },
  { value: 'monthly', label: 'Щомісяця' },
  { value: 'yearly', label: 'Щороку' },
]

function CategoryDot({ category }: { category?: MoneyCategory }) {
  return (
    <span className="money-dot" style={{ background: category?.color ?? '#9b9a97' }}>
      {category?.icon ?? '•'}
    </span>
  )
}

/* ---------------- transaction dialog ---------------- */

function TransactionDialog({
  open,
  item,
  defaultKind,
  onClose,
}: {
  open: boolean
  item: MoneyTransaction | null
  defaultKind: MoneyKind
  onClose: () => void
}) {
  const categories = useAppStore((state) => state.categories)
  const addTransaction = useAppStore((state) => state.addTransaction)
  const updateTransaction = useAppStore((state) => state.updateTransaction)

  const [kind, setKind] = useState<MoneyKind>(defaultKind)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(formatDateInput(Date.now()))
  const [categoryId, setCategoryId] = useState<ID | ''>('')
  const [note, setNote] = useState('')

  const visibleCategories = categories.filter(
    (category) => category.kind === 'both' || category.kind === kind,
  )

  const submit = () => {
    const value = Number(amount.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) return
    const payload = {
      kind,
      amount: value,
      date,
      categoryId: visibleCategories.some((item) => item.id === categoryId) ? categoryId : '',
      note,
    }
    if (item) {
      updateTransaction(item.id, payload)
      toast('Транзакцію оновлено')
    } else {
      addTransaction(payload)
      toast('Транзакцію додано')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      title={item ? 'Редагувати транзакцію' : 'Нова транзакція'}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn btn-soft" onClick={onClose}>
            Скасувати
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!amount.trim()}>
            {item ? 'Зберегти' : 'Додати'}
          </button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">Тип</span>
        <Segmented
          options={[
            { value: 'expense' as const, label: 'Витрата' },
            { value: 'income' as const, label: 'Дохід' },
          ]}
          value={kind}
          onChange={(value) => {
            setKind(value)
            setCategoryId('')
          }}
        />
      </div>
      <div className="money-form-grid">
        <label className="field">
          <span className="field-label">Сума</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </label>
        <label className="field">
          <span className="field-label">Дата</span>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Категорія</span>
        <select
          className="input"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Без категорії</option>
          {visibleCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon} {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Нотатка</span>
        <input
          className="input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Наприклад, тиждень продуктів"
        />
      </label>
    </Modal>
  )
}

/* ---------------- recurring dialog ---------------- */

function RecurringDialog({
  open,
  item,
  onClose,
}: {
  open: boolean
  item: MoneyRecurring | null
  onClose: () => void
}) {
  const categories = useAppStore((state) => state.categories)
  const addRecurring = useAppStore((state) => state.addRecurring)
  const updateRecurring = useAppStore((state) => state.updateRecurring)

  const [kind, setKind] = useState<MoneyKind>(item?.kind ?? 'expense')
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [categoryId, setCategoryId] = useState<ID | ''>(item?.categoryId ?? '')
  const [note, setNote] = useState(item?.note ?? '')
  const [freq, setFreq] = useState<RepeatFreq>(item?.freq ?? 'monthly')
  const [interval, setInterval] = useState(String(item?.interval ?? 1))
  const [nextDate, setNextDate] = useState(item?.nextDate ?? formatDateInput(Date.now()))

  const visibleCategories = categories.filter(
    (category) => category.kind === 'both' || category.kind === kind,
  )

  const submit = () => {
    const value = Number(amount.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) return
    const payload = {
      kind,
      amount: value,
      categoryId: visibleCategories.some((category) => category.id === categoryId) ? categoryId : '',
      note,
      freq,
      interval: Number(interval) || 1,
      nextDate,
    }
    if (item) {
      updateRecurring(item.id, payload)
      toast('Повторювану операцію оновлено')
    } else {
      addRecurring(payload)
      toast('Повторювану операцію додано')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      title={item ? 'Редагувати повторення' : 'Нове повторення'}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn btn-soft" onClick={onClose}>
            Скасувати
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!amount.trim()}>
            {item ? 'Зберегти' : 'Додати'}
          </button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">Тип</span>
        <Segmented
          options={[
            { value: 'expense' as const, label: 'Витрата' },
            { value: 'income' as const, label: 'Дохід' },
          ]}
          value={kind}
          onChange={(value) => {
            setKind(value)
            setCategoryId('')
          }}
        />
      </div>
      <div className="money-form-grid">
        <label className="field">
          <span className="field-label">Сума</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
          />
        </label>
        <label className="field">
          <span className="field-label">Наступна дата</span>
          <input
            className="input"
            type="date"
            value={nextDate}
            onChange={(event) => setNextDate(event.target.value)}
          />
        </label>
      </div>
      <div className="money-form-grid">
        <label className="field">
          <span className="field-label">Періодичність</span>
          <select
            className="input"
            value={freq}
            onChange={(event) => setFreq(event.target.value as RepeatFreq)}
          >
            {FREQS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Кожні</span>
          <input
            className="input"
            type="number"
            min="1"
            max="365"
            value={interval}
            onChange={(event) => setInterval(event.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Категорія</span>
        <select
          className="input"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Без категорії</option>
          {visibleCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon} {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Нотатка</span>
        <input
          className="input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Наприклад, оренда квартири"
        />
      </label>
    </Modal>
  )
}

/* ---------------- budget dialog ---------------- */

function BudgetDialog({
  open,
  item,
  onClose,
}: {
  open: boolean
  item: { id: ID; categoryId: ID | 'all'; amount: number; period: 'month' | 'year' } | null
  onClose: () => void
}) {
  const categories = useAppStore((state) => state.categories)
  const addBudget = useAppStore((state) => state.addBudget)
  const updateBudget = useAppStore((state) => state.updateBudget)
  const [categoryId, setCategoryId] = useState<ID | 'all'>(item?.categoryId ?? 'all')
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [period, setPeriod] = useState<'month' | 'year'>(item?.period ?? 'month')

  const submit = () => {
    const value = Number(amount.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) return
    if (item) {
      updateBudget(item.id, { categoryId, amount: value, period })
      toast('Бюджет оновлено')
    } else {
      addBudget({ categoryId, amount: value, period })
      toast('Бюджет додано')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      title={item ? 'Редагувати бюджет' : 'Новий бюджет'}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn btn-soft" onClick={onClose}>
            Скасувати
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!amount.trim()}>
            {item ? 'Зберегти' : 'Додати'}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Категорія</span>
        <select
          className="input"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value as ID | 'all')}
        >
          <option value="all">Усі категорії</option>
          {categories
            .filter((category) => category.kind === 'expense' || category.kind === 'both')
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
        </select>
      </label>
      <div className="money-form-grid">
        <label className="field">
          <span className="field-label">Ліміт</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
          />
        </label>
        <label className="field">
          <span className="field-label">Період</span>
          <select
            className="input"
            value={period}
            onChange={(event) => setPeriod(event.target.value as 'month' | 'year')}
          >
            <option value="month">Місяць</option>
            <option value="year">Рік</option>
          </select>
        </label>
      </div>
    </Modal>
  )
}

/* ---------------- category dialog ---------------- */

function CategoryDialog({
  open,
  item,
  onClose,
}: {
  open: boolean
  item: MoneyCategory | null
  onClose: () => void
}) {
  const addCategory = useAppStore((state) => state.addCategory)
  const updateCategory = useAppStore((state) => state.updateCategory)
  const [name, setName] = useState(item?.name ?? '')
  const [icon, setIcon] = useState(item?.icon ?? '')
  const [color, setColor] = useState(item?.color ?? MONEY_CATEGORY_PRESETS[0].color)
  const [kind, setKind] = useState<MoneyKind | 'both'>(item?.kind ?? 'expense')

  const submit = () => {
    if (!name.trim()) return
    if (item) {
      updateCategory(item.id, { name: name.trim(), icon, color, kind })
      toast('Категорію оновлено')
    } else {
      addCategory({ name: name.trim(), icon, color, kind })
      toast('Категорію додано')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      title={item ? 'Редагувати категорію' : 'Нова категорія'}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn btn-soft" onClick={onClose}>
            Скасувати
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!name.trim()}>
            {item ? 'Зберегти' : 'Додати'}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Назва</span>
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Наприклад, Кава"
          autoFocus
        />
      </label>
      <div className="money-form-grid">
        <label className="field">
          <span className="field-label">Іконка (emoji)</span>
          <input
            className="input"
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
            placeholder="☕"
            maxLength={8}
          />
        </label>
        <label className="field">
          <span className="field-label">Призначення</span>
          <select
            className="input"
            value={kind}
            onChange={(event) => setKind(event.target.value as MoneyKind | 'both')}
          >
            <option value="expense">Витрата</option>
            <option value="income">Дохід</option>
            <option value="both">Обидва</option>
          </select>
        </label>
      </div>
      <div className="field">
        <span className="field-label">Колір</span>
        <div className="colors-row">
          {MONEY_CATEGORY_PRESETS.map((preset) => (
            <button
              key={preset.color}
              type="button"
              aria-label={`Колір ${preset.color}`}
              className={cn('color-chip', color === preset.color && 'active')}
              style={{ background: preset.color, color: preset.color }}
              onClick={() => setColor(preset.color)}
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- page ---------------- */

export function MoneyPage() {
  const data = useAppStore()
  const {
    settings,
    categories,
    transactions,
    recurring,
    budgets,
  } = data

  const [period, setPeriod] = useState<MoneyPeriod>('month')
  const [tab, setTab] = useState<Tab>('overview')
  const [kindFilter, setKindFilter] = useState<'all' | MoneyKind>('all')
  const [categoryFilter, setCategoryFilter] = useState<ID | ''>('')

  const [txDialog, setTxDialog] = useState<MoneyTransaction | 'new' | null>(null)
  const [recDialog, setRecDialog] = useState<MoneyRecurring | 'new' | null>(null)
  const [budgetDialog, setBudgetDialog] = useState<{ id: ID; categoryId: ID | 'all'; amount: number; period: 'month' | 'year' } | 'new' | null>(null)
  const [catDialog, setCatDialog] = useState<MoneyCategory | 'new' | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; text: string; action: () => void } | null>(null)

  const range = useMemo(() => moneyPeriodRange(period), [period])
  const summary = useMemo(
    () => computeMoneySummary(transactions, range),
    [transactions, range.from, range.to],
  )
  const budgetProgress = useMemo(
    () => computeBudgetProgress(data),
    [budgets, transactions, categories],
  )

  const filteredTransactions = useMemo(
    () =>
      transactions
        .filter((item) => kindFilter === 'all' || item.kind === kindFilter)
        .filter((item) => !categoryFilter || item.categoryId === categoryFilter)
        .filter((item) => item.date >= range.from && item.date <= range.to)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [transactions, kindFilter, categoryFilter, range.from, range.to],
  )

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, MoneyTransaction[]>()
    for (const item of filteredTransactions) {
      const list = groups.get(item.date) ?? []
      list.push(item)
      groups.set(item.date, list)
    }
    return [...groups.entries()]
  }, [filteredTransactions])

  const maxDayAmount = Math.max(1, ...summary.byDay.flatMap((day) => [day.income, day.expense]))

  const exportCsv = () => {
    if (transactions.length === 0) return
    void saveTextFile(
      `vibedo-money-${formatDateInput(Date.now())}.csv`,
      transactionsToCsv(transactions, categories),
      [{ name: 'CSV (Excel)', extensions: ['csv'] }],
    )
  }

  const deleteTx = (item: MoneyTransaction) =>
    setConfirm({
      title: 'Видалити транзакцію?',
      text: `${categoryLabel(item.categoryId, categories)} · ${formatMoney(item.amount, settings.currency)}`,
      action: () => data.deleteTransaction(item.id),
    })

  const deleteRec = (item: MoneyRecurring) =>
    setConfirm({
      title: 'Видалити повторення?',
      text: item.note || `${REPEAT_LABELS[item.freq]} · ${formatMoney(item.amount, settings.currency)}`,
      action: () => data.deleteRecurring(item.id),
    })

  const deleteBudget = (id: ID) =>
    setConfirm({
      title: 'Видалити бюджет?',
      text: 'Ліміт буде прибрано зі списку.',
      action: () => data.deleteBudget(id),
    })

  const deleteCategory = (item: MoneyCategory) =>
    setConfirm({
      title: 'Видалити категорію?',
      text: 'Транзакції залишаться, але стануть «Без категорії».',
      action: () => data.deleteCategory(item.id),
    })

  return (
    <div className="page money-page">
      <div className="page-inner">
        <div className="page-header">
          <div className="page-header-main">
            <div className="eyebrow">Гроші</div>
            <h1 className="page-title">Облік доходів і витрат</h1>
            <div className="page-sub">
              {summary.count} операцій у періоді · дані зберігаються лише на цьому пристрої
            </div>
          </div>
          <div className="page-actions">
            <button className="btn btn-soft" onClick={exportCsv} disabled={transactions.length === 0}>
              <Download size={15} /> CSV
            </button>
            <button className="btn btn-primary" onClick={() => setTxDialog('new')}>
              <Plus size={15} /> Додати
            </button>
          </div>
        </div>

        <div className="stat-grid money-stat-grid">
          <div className="stat-card accent">
            <div className="stat-head">
              <span className="stat-label">Баланс періоду</span>
              <Wallet size={15} />
            </div>
            <div className={cn('stat-value', summary.balance < 0 && 'negative')}>
              {formatMoney(summary.balance, settings.currency)}
            </div>
            <div className="stat-hint">дохід мінус витрати</div>
          </div>
          <div className="stat-card money">
            <div className="stat-head">
              <span className="stat-label">Надходження</span>
              <ArrowDownLeft size={15} />
            </div>
            <div className="stat-value">{formatMoney(summary.income, settings.currency)}</div>
            <div className="stat-hint">включно із зарплатою</div>
          </div>
          <div className="stat-card">
            <div className="stat-head">
              <span className="stat-label">Розходи</span>
              <ArrowUpRight size={15} />
            </div>
            <div className="stat-value">{formatMoney(summary.expense, settings.currency)}</div>
            <div className="stat-hint">{summary.byCategory.length} категорій</div>
          </div>
          <div className="stat-card">
            <div className="stat-head">
              <span className="stat-label">Повторення</span>
              <Repeat2 size={15} />
            </div>
            <div className="stat-value">{recurring.filter((item) => item.active).length}</div>
            <div className="stat-hint">активних правил</div>
          </div>
        </div>

        <div className="money-toolbar">
          <Segmented options={PERIODS} value={period} onChange={setPeriod} />
          <Segmented options={TABS} value={tab} onChange={setTab} />
        </div>

        {tab === 'overview' && (
          <div className="money-overview">
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Динаміка</div>
                  <div className="card-sub">доходи та витрати за дні</div>
                </div>
              </div>
              <div className="money-chart">
                {summary.byDay.length === 0 && <div className="empty-hint">Немає операцій у цьому періоді</div>}
                {summary.byDay.map((day) => (
                  <div className="money-chart-col" key={day.date} title={formatDayLabel(day.date)}>
                    <div className="money-chart-bars">
                      <div
                        className="money-chart-bar income"
                        style={{ height: `${Math.max(2, (day.income / maxDayAmount) * 100)}%` }}
                      />
                      <div
                        className="money-chart-bar expense"
                        style={{ height: `${Math.max(2, (day.expense / maxDayAmount) * 100)}%` }}
                      />
                    </div>
                    <span className="money-chart-label">{day.date.slice(8)}</span>
                  </div>
                ))}
              </div>
              <div className="money-legend">
                <span><i className="income" /> Дохід</span>
                <span><i className="expense" /> Витрата</span>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Бюджети</div>
                  <div className="card-sub">ліміти на категорії</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setBudgetDialog('new')}>
                  <Plus size={14} /> Додати
                </button>
              </div>
              {budgetProgress.length === 0 && (
                <div className="empty-hint">Ще немає бюджетів</div>
              )}
              <div className="money-budget-list">
                {budgetProgress.map((item) => (
                  <div className="money-progress-row" key={item.budget.id}>
                    <div className="money-progress-head">
                      <span>{item.label}</span>
                      <span className={cn(item.percent >= 100 && 'negative')}>
                        {formatMoney(item.spent, settings.currency)} / {formatMoney(item.budget.amount, settings.currency)} · {item.percent}%
                      </span>
                    </div>
                    <div className="money-progress">
                      <div
                        className={cn('money-progress-fill', item.percent >= 100 && 'over')}
                        style={{ width: `${Math.min(100, item.percent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Останні операції</div>
                  <div className="card-sub">останні 6 у періоді</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setTab('transactions')}>
                  Усі →
                </button>
              </div>
              <div className="money-list">
                {filteredTransactions.slice(0, 6).map((item) => (
                  <MoneyRow
                    key={item.id}
                    item={item}
                    category={categories.find((category) => category.id === item.categoryId)}
                    categoryName={categoryLabel(item.categoryId, categories)}
                    currency={settings.currency}
                    onEdit={() => setTxDialog(item)}
                    onDelete={() => deleteTx(item)}
                  />
                ))}
                {filteredTransactions.length === 0 && <div className="empty-hint">Немає операцій</div>}
              </div>
            </div>
          </div>
        )}

        {tab === 'transactions' && (
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Транзакції</div>
                <div className="card-sub">{filteredTransactions.length} у періоді</div>
              </div>
              <div className="money-filters">
                <select
                  className="input input-sm"
                  value={kindFilter}
                  onChange={(event) => setKindFilter(event.target.value as 'all' | MoneyKind)}
                >
                  <option value="all">Усі типи</option>
                  <option value="income">Дходи</option>
                  <option value="expense">Витрати</option>
                </select>
                <select
                  className="input input-sm"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="">Усі категорії</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="money-list">
              {groupedTransactions.map(([date, items]) => (
                <div className="money-group" key={date}>
                  <div className="money-group-date">{formatDayLabel(date)}</div>
                  {items.map((item) => (
                    <MoneyRow
                      key={item.id}
                      item={item}
                      category={categories.find((category) => category.id === item.categoryId)}
                      categoryName={categoryLabel(item.categoryId, categories)}
                      currency={settings.currency}
                      onEdit={() => setTxDialog(item)}
                      onDelete={() => deleteTx(item)}
                    />
                  ))}
                </div>
              ))}
              {filteredTransactions.length === 0 && <div className="empty-hint">Немає транзакцій за ці фільтри</div>}
            </div>
          </div>
        )}

        {tab === 'recurring' && (
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Повторювані операції</div>
                <div className="card-sub">створюються автоматично при запуску застосунку</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setRecDialog('new')}>
                <Plus size={14} /> Додати
              </button>
            </div>
            <div className="money-list">
              {recurring.map((item) => (
                <div className="money-row" key={item.id}>
                  <CategoryDot category={categories.find((category) => category.id === item.categoryId)} />
                  <div className="money-row-main">
                    <div className={cn('money-row-title', !item.active && 'muted')}>
                      {item.note || categoryLabel(item.categoryId, categories)}
                    </div>
                    <div className="money-row-sub">
                      {REPEAT_LABELS[item.freq]} · наступна {formatDayLabel(item.nextDate)}
                      {!item.active && ' · вимкнено'}
                    </div>
                  </div>
                  <span className={cn('money-row-amount', item.kind === 'income' && 'positive')}>
                    {item.kind === 'income' ? '+' : '−'}
                    {formatMoney(item.amount, settings.currency)}
                  </span>
                  <button
                    className="btn-icon"
                    title={item.active ? 'Вимкнути' : 'Увімкнути'}
                    onClick={() => data.updateRecurring(item.id, { active: !item.active })}
                  >
                    <Repeat2 size={14} />
                  </button>
                  <button className="btn-icon" title="Редагувати" onClick={() => setRecDialog(item)}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn-icon" title="Видалити" onClick={() => deleteRec(item)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {recurring.length === 0 && <div className="empty-hint">Немає повторюваних операцій</div>}
            </div>
          </div>
        )}

        {tab === 'budgets' && (
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Бюджети та ліміти</div>
                <div className="card-sub">витрати поточного місяця або року</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setBudgetDialog('new')}>
                <Plus size={14} /> Додати
              </button>
            </div>
            <div className="money-budget-list wide">
              {budgetProgress.map((item) => (
                <div className="money-progress-row" key={item.budget.id}>
                  <div className="money-progress-head">
                    <span>{item.label} · {item.budget.period === 'month' ? 'місяць' : 'рік'}</span>
                    <span className={cn(item.percent >= 100 && 'negative')}>
                      {formatMoney(item.spent, settings.currency)} / {formatMoney(item.budget.amount, settings.currency)} · {item.percent}%
                    </span>
                  </div>
                  <div className="money-progress">
                    <div
                      className={cn('money-progress-fill', item.percent >= 100 && 'over')}
                      style={{ width: `${Math.min(100, item.percent)}%` }}
                    />
                  </div>
                  <div className="money-row-actions">
                    <button
                      className="btn-icon"
                      title="Редагувати"
                      onClick={() => setBudgetDialog(item.budget)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button className="btn-icon" title="Видалити" onClick={() => deleteBudget(item.budget.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {budgetProgress.length === 0 && <div className="empty-hint">Ще немає бюджетів</div>}
            </div>
          </div>
        )}

        {tab === 'categories' && (
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Категорії</div>
                <div className="card-sub">готові та власні категорії</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setCatDialog('new')}>
                <Plus size={14} /> Додати
              </button>
            </div>
            <div className="money-categories">
              {categories.map((category) => (
                <div className="money-category-row" key={category.id}>
                  <CategoryDot category={category} />
                  <div className="money-row-main">
                    <div className="money-row-title">{category.name}</div>
                    <div className="money-row-sub">
                      {category.kind === 'income' ? 'Дохід' : category.kind === 'expense' ? 'Витрата' : 'Обидва'}
                    </div>
                  </div>
                  <button className="btn-icon" title="Редагувати" onClick={() => setCatDialog(category)}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn-icon" title="Видалити" onClick={() => deleteCategory(category)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="money-salary-note">
          <Target size={14} />
          <span>
            Зарплатні дні з календаря автоматично потрапляють у доходи, якщо ввімкнено відповідне налаштування.
          </span>
        </div>
      </div>

      {txDialog && (
        <TransactionDialog
          open
          item={txDialog === 'new' ? null : txDialog}
          defaultKind={kindFilter === 'income' ? 'income' : 'expense'}
          onClose={() => setTxDialog(null)}
        />
      )}
      {recDialog && (
        <RecurringDialog
          open
          item={recDialog === 'new' ? null : recDialog}
          onClose={() => setRecDialog(null)}
        />
      )}
      {budgetDialog && (
        <BudgetDialog
          open
          item={budgetDialog === 'new' ? null : budgetDialog}
          onClose={() => setBudgetDialog(null)}
        />
      )}
      {catDialog && (
        <CategoryDialog
          open
          item={catDialog === 'new' ? null : catDialog}
          onClose={() => setCatDialog(null)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          open
          title={confirm.title}
          text={confirm.text}
          confirmLabel="Видалити"
          onConfirm={confirm.action}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

function MoneyRow({
  item,
  category,
  categoryName,
  currency,
  onEdit,
  onDelete,
}: {
  item: MoneyTransaction
  category?: MoneyCategory
  categoryName: string
  currency: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="money-row">
      <CategoryDot category={category} />
      <div className="money-row-main">
        <div className="money-row-title">{item.note || categoryName}</div>
        <div className="money-row-sub">
          {item.kind === 'income' ? 'Дохід' : 'Витрата'} · {categoryName}
          {item.recurringId && ' · повторюване'}
        </div>
      </div>
      <span className={cn('money-row-amount', item.kind === 'income' && 'positive')}>
        {item.kind === 'income' ? '+' : '−'}
        {formatMoney(item.amount, currency)}
      </span>
      <button className="btn-icon" title="Редагувати" onClick={onEdit}>
        <Pencil size={14} />
      </button>
      <button className="btn-icon" title="Видалити" onClick={onDelete}>
        <Trash2 size={14} />
      </button>
    </div>
  )
}
