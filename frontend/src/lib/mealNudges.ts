import type { MealNudgeMealType } from '../types'

export const OFFICIAL_MEAL_TYPE_CATALOG: Record<MealNudgeMealType, { label: string; buttonLabel: string }> = {
  BREAKFAST: { label: 'Café da manhã', buttonLabel: '👀 Cadê o café da manhã?' },
  MORNING_SNACK: { label: 'Lanche da manhã', buttonLabel: '👀 Cadê o lanche da manhã?' },
  LUNCH: { label: 'Almoço', buttonLabel: '👀 Cadê o almoço?' },
  AFTERNOON_SNACK: { label: 'Lanche da tarde', buttonLabel: '👀 Cadê o lanche da tarde?' },
  DINNER: { label: 'Jantar', buttonLabel: '👀 Cadê o jantar?' },
  SUPPER: { label: 'Ceia', buttonLabel: '👀 Cadê a ceia?' },
}

const MEAL_TYPES_BY_LABEL = new Map(
  Object.entries(OFFICIAL_MEAL_TYPE_CATALOG).map(([mealType, meal]) => [meal.label, mealType as MealNudgeMealType]),
)

export function mealLabelForApiType(mealType: string) {
  return OFFICIAL_MEAL_TYPE_CATALOG[mealType as MealNudgeMealType]?.label ?? ''
}

export function mealApiTypeForLabel(label: string) {
  return MEAL_TYPES_BY_LABEL.get(label) ?? null
}

export function isMealNudgeMealType(value: string): value is MealNudgeMealType {
  return Object.hasOwn(OFFICIAL_MEAL_TYPE_CATALOG, value)
}
