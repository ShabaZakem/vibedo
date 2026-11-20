export const SCHEMA_VERSION = 3

export const ACCENTS = [
  { id: 'blue', name: 'Синій', value: '#2383e2' },
  { id: 'teal', name: 'Бірюзовий', value: '#0f7b6c' },
  { id: 'violet', name: 'Фіолетовий', value: '#6940a5' },
  { id: 'berry', name: 'Ягідний', value: '#ad1a72' },
  { id: 'orange', name: 'Помаранчевий', value: '#d9730d' },
  { id: 'red', name: 'Червоний', value: '#e03e3e' },
]

export const LIST_COLORS = [
  '#2383e2',
  '#0f7b6c',
  '#6940a5',
  '#ad1a72',
  '#d9730d',
  '#e03e3e',
  '#5b7c0f',
  '#8a6a00',
]

export const TAG_COLORS = [
  '#2383e2',
  '#0f7b6c',
  '#6940a5',
  '#ad1a72',
  '#d9730d',
  '#e03e3e',
  '#5b7c0f',
  '#8a6a00',
]

export function tagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i += 1) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_COLORS[hash % TAG_COLORS.length]
}

export const MONEY_CATEGORY_PRESETS: Array<{
  id: string
  name: string
  color: string
  icon: string
  kind: 'income' | 'expense' | 'both'
}> = [
  { id: 'cat_salary', name: 'Зарплата', color: '#0f7b6c', icon: '💼', kind: 'income' },
  { id: 'cat_freelance', name: 'Фріланс', color: '#2383e2', icon: '💻', kind: 'income' },
  { id: 'cat_gift', name: 'Подарунок', color: '#6940a5', icon: '🎁', kind: 'income' },
  { id: 'cat_other_in', name: 'Інший дохід', color: '#8a6a00', icon: '➕', kind: 'income' },
  { id: 'cat_home', name: 'Житло', color: '#d9730d', icon: '🏠', kind: 'expense' },
  { id: 'cat_food', name: 'Їжа', color: '#e03e3e', icon: '🛒', kind: 'expense' },
  { id: 'cat_transport', name: 'Транспорт', color: '#2383e2', icon: '🚌', kind: 'expense' },
  { id: 'cat_fun', name: 'Розваги', color: '#ad1a72', icon: '🎬', kind: 'expense' },
  { id: 'cat_health', name: "Здоров'я", color: '#0f7b6c', icon: '💊', kind: 'expense' },
  { id: 'cat_education', name: 'Навчання', color: '#6940a5', icon: '📚', kind: 'expense' },
  { id: 'cat_subs', name: 'Підписки', color: '#8a6a00', icon: '🔁', kind: 'expense' },
  { id: 'cat_other_out', name: 'Інша витрата', color: '#6f6e69', icon: '➖', kind: 'expense' },
]

export const MONEY_KIND_LABELS: Record<string, string> = {
  income: 'Дохід',
  expense: 'Витрата',
}

export const REPEAT_LABELS: Record<string, string> = {
  daily: 'Щодня',
  weekdays: 'По буднях',
  weekly: 'Щотижня',
  monthly: 'Щомісяця',
  yearly: 'Щороку',
}

export const WEEKDAYS_UK = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
