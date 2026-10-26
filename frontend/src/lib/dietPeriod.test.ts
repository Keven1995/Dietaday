import { describe, expect, it } from 'vitest'
import { isDietPeriodEnded } from './dietPeriod'

describe('isDietPeriodEnded', () => {
  it('keeps the diet available through its final date', () => {
    expect(isDietPeriodEnded('2026-10-25', '2026-10-25')).toBe(false)
  })

  it('marks the diet ended starting on the following date', () => {
    expect(isDietPeriodEnded('2026-10-25', '2026-10-26')).toBe(true)
  })
})
