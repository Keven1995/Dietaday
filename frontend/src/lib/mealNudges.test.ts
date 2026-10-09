import { describe, expect, it } from 'vitest'
import { isMealNudgeMealType, mealApiTypeForLabel, mealLabelForApiType, OFFICIAL_MEAL_TYPE_CATALOG } from './mealNudges'

describe('official meal nudge catalog', () => {
  it('maps every official meal label to its canonical API key', () => {
    for (const [mealType, meal] of Object.entries(OFFICIAL_MEAL_TYPE_CATALOG)) {
      expect(mealLabelForApiType(mealType)).toBe(meal.label)
      expect(mealApiTypeForLabel(meal.label)).toBe(mealType)
      expect(isMealNudgeMealType(mealType)).toBe(true)
    }
    expect(Object.keys(OFFICIAL_MEAL_TYPE_CATALOG)).toHaveLength(6)
    expect(isMealNudgeMealType('UNOFFICIAL_MEAL')).toBe(false)
  })
})
