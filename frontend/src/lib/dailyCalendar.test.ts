import { describe, expect, it } from 'vitest'
import type { Meal } from '../types'
import { getCalendarMealStatus } from './dailyCalendar'

describe('getCalendarMealStatus', () => {
  it('returns empty without meals', () => {
    expect(getCalendarMealStatus([])).toBe('empty')
  })

  it('returns partial for an incomplete set of official meals', () => {
    expect(getCalendarMealStatus([{ mealType: 'Almoço' } as Pick<Meal, 'mealType'>])).toBe('partial')
  })

  it('returns completed when all official meal types are present', () => {
    const mealTypes = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia']
    expect(getCalendarMealStatus(mealTypes.map((mealType) => ({ mealType }) as Pick<Meal, 'mealType'>))).toBe('completed')
  })
})
