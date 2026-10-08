import { describe, expect, it } from 'vitest'
import { brazilDateKey, localDateKey, mealDateKey, mealTime, parseLocalDate } from './date'

describe('date utilities', () => {
  it('formats a local calendar date without converting time zones', () => {
    expect(localDateKey(new Date(2026, 8, 4))).toBe('2026-09-04')
    expect(parseLocalDate('2026-09-04').getDate()).toBe(4)
  })

  it('uses the Sao Paulo calendar date for birth-date limits', () => {
    expect(brazilDateKey(new Date('2026-10-08T02:30:00Z'))).toBe('2026-10-07')
  })

  it('extracts the calendar day from a meal value', () => {
    expect(mealDateKey('2026-09-04')).toBe('2026-09-04')
    expect(mealDateKey('2026-09-04T12:30:00Z')).toBe('2026-09-04')
  })

  it('formats valid times and safely handles invalid values', () => {
    expect(mealTime('2026-09-04T07:40:00')).toBe('07:40')
    expect(mealTime('invalid')).toBe('')
  })
})
