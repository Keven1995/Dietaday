import { describe, expect, it } from 'vitest'
import { halloweenConfig } from './halloween/HalloweenConfig'
import { getHalloweenIntensity, getSeasonalThemeState } from './seasonal.utils'

function localDate(month: number, day: number) {
  return new Date(2026, month - 1, day, 12)
}

describe('seasonal theme dates', () => {
  it.each([
    [9, 1, 'off'],
    [10, 1, 'light'],
    [10, 24, 'light'],
    [10, 25, 'full'],
    [10, 31, 'full'],
    [11, 2, 'full'],
    [11, 3, 'off'],
  ] as const)('%i/%i resolves to %s', (month, day, expected) => {
    expect(getHalloweenIntensity(localDate(month, day), true)).toBe(expected)
  })

  it('keeps the default theme when the feature flag or config is disabled', () => {
    expect(getHalloweenIntensity(localDate(10, 31), false)).toBe('off')
    expect(getHalloweenIntensity(localDate(10, 31), true, { ...halloweenConfig, enabled: false })).toBe('off')
    expect(getSeasonalThemeState(localDate(10, 31), false)).toEqual({ name: 'default', intensity: 'off' })
  })
})
