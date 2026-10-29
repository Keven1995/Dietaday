export const DIET_MEAL_TYPES = [
  'Café da manhã',
  'Lanche da manhã',
  'Almoço',
  'Lanche da tarde',
  'Jantar',
  'Ceia',
] as const

export type DietMealType = (typeof DIET_MEAL_TYPES)[number]

export type DietMealTypeScheduleEntry = {
  effectiveFrom: string
  mealTypes: DietMealType[]
}

export function dietMealTypesForDate(schedule: DietMealTypeScheduleEntry[] | undefined, date: string): DietMealType[] {
  if (!schedule?.length) return [...DIET_MEAL_TYPES]
  const ordered = [...schedule].sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
  const active = ordered.filter((entry) => entry.effectiveFrom <= date).at(-1) ?? ordered[0]
  return active?.mealTypes?.length ? [...active.mealTypes] : [...DIET_MEAL_TYPES]
}
