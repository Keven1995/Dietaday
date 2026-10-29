import type { Meal } from '../types'
import { DIET_MEAL_TYPES, type DietMealType } from './dietMealTypes'

export const OFFICIAL_MEAL_TYPES = DIET_MEAL_TYPES

export type CalendarMealStatus = 'completed' | 'partial' | 'empty'

export function getCalendarMealStatus(meals: Pick<Meal, 'mealType'>[], configuredTypes: readonly DietMealType[] = OFFICIAL_MEAL_TYPES): CalendarMealStatus {
  const mealTypes = new Set(meals.map((meal) => meal.mealType))
  if (configuredTypes.every((mealType) => mealTypes.has(mealType))) return 'completed'
  return mealTypes.size ? 'partial' : 'empty'
}
