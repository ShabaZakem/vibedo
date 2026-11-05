export const SCHEMA_VERSION = 2

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

export const REPEAT_LABELS: Record<string, string> = {
  daily: 'Щодня',
  weekdays: 'По буднях',
  weekly: 'Щотижня',
  monthly: 'Щомісяця',
  yearly: 'Щороку',
}

export const WEEKDAYS_UK = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
