import type { Meal } from '../types'

export const OFFICIAL_MEAL_TYPES = [
  'Café da manhã',
  'Lanche da manhã',
  'Almoço',
  'Lanche da tarde',
  'Jantar',
  'Ceia',
] as const

export type CalendarMealStatus = 'completed' | 'partial' | 'empty'

export function getCalendarMealStatus(meals: Pick<Meal, 'mealType'>[]): CalendarMealStatus {
  const mealTypes = new Set(meals.map((meal) => meal.mealType))
  if (OFFICIAL_MEAL_TYPES.every((mealType) => mealTypes.has(mealType))) return 'completed'
  return mealTypes.size ? 'partial' : 'empty'
}
