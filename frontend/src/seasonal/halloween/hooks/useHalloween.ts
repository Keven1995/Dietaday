import { useContext } from 'react'
import { SeasonalThemeContext } from '../../SeasonalTheme'
import { useReducedMotionPreference } from '../../../hooks/useReducedMotionPreference'

export function useHalloween() {
  const seasonalTheme = useContext(SeasonalThemeContext)
  const reducedMotion = useReducedMotionPreference()
  const intensity = seasonalTheme?.intensity ?? 'off'
  const isHalloween = seasonalTheme?.name === 'halloween'

  return {
    enabled: isHalloween,
    intensity,
    isHalloween,
    reducedMotion,
  }
}
