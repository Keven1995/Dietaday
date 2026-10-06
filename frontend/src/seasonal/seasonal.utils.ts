import { seasonalThemes } from './seasonal.config'
import type { HalloweenIntensity, SeasonalThemeState } from './seasonal.types'

const halloweenConfig = seasonalThemes.halloween

type DatePeriod = { start: string; end: string }
type HalloweenConfig = {
  enabled: boolean
  normalPeriod: DatePeriod
  intensePeriod: DatePeriod
}

function monthAndDay(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isWithinPeriod(date: Date, period: DatePeriod) {
  const value = monthAndDay(date)
  return value >= period.start && value <= period.end
}

export function getHalloweenIntensity(
  date: Date,
  featureFlagEnabled: boolean,
  config: HalloweenConfig = halloweenConfig,
): HalloweenIntensity {
  if (!featureFlagEnabled || !config.enabled) return 'off'
  if (isWithinPeriod(date, config.intensePeriod)) return 'full'
  if (isWithinPeriod(date, config.normalPeriod)) return 'light'
  return 'off'
}

export function getSeasonalThemeState(date: Date, featureFlagEnabled: boolean): SeasonalThemeState {
  const intensity = getHalloweenIntensity(date, featureFlagEnabled)
  return intensity === 'off'
    ? { name: 'default', intensity }
    : { name: 'halloween', intensity }
}

export function getLocalDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
