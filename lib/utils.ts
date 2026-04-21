import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CuisineTag } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const CUISINE_LABELS: Record<CuisineTag, string> = {
  taiwanese:  '🇹🇼 Taiwanese',
  japanese:   '🇯🇵 Japanese',
  korean:     '🇰🇷 Korean',
  chinese:    '🇨🇳 Chinese',
  thai:       '🇹🇭 Thai',
  vietnamese: '🇻🇳 Vietnamese',
  italian:    '🇮🇹 Italian',
  american:   '🇺🇸 American',
  mexican:    '🇲🇽 Mexican',
  french:     '🇫🇷 French',
  indian:     '🇮🇳 Indian',
  dessert:    '🍰 Dessert',
  breakfast:  '🥞 Breakfast',
  other:      '🍽️ Other',
}

export const ALL_CUISINE_TAGS: CuisineTag[] = Object.keys(CUISINE_LABELS) as CuisineTag[]

export const MEAL_TYPE_LABELS = {
  breakfast: '☀️ Breakfast',
  lunch:     '🌤️ Lunch',
  dinner:    '🌙 Dinner',
  snack:     '🫙 Snack',
}

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Returns the Monday of the week containing `date` */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
