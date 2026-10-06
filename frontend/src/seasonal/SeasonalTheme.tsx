import { Component, createContext, lazy, Suspense, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'
import type { SeasonalThemeState } from './seasonal.types'
import { getLocalDayKey, getSeasonalThemeState } from './seasonal.utils'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'

const HalloweenTheme = lazy(() => import('./halloween/HalloweenTheme'))

export const SeasonalThemeContext = createContext<SeasonalThemeState | null>(null)

class SeasonalThemeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Não foi possível carregar o tema sazonal.', error, info)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function millisecondsUntilNextLocalDay() {
  const nextDay = new Date()
  nextDay.setHours(24, 0, 0, 50)
  return Math.max(1_000, nextDay.getTime() - Date.now())
}

export function SeasonalTheme({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotionPreference()
  const featureFlagEnabled = import.meta.env.VITE_HALLOWEEN_ENABLED === 'true'
  const [todayKey, setTodayKey] = useState(() => getLocalDayKey(new Date()))
  const state = useMemo(
    () => getSeasonalThemeState(new Date(`${todayKey}T12:00:00`), featureFlagEnabled),
    [featureFlagEnabled, todayKey],
  )

  useEffect(() => {
    if (!featureFlagEnabled) return
    const timer = window.setTimeout(() => setTodayKey(getLocalDayKey(new Date())), millisecondsUntilNextLocalDay())
    return () => window.clearTimeout(timer)
  }, [featureFlagEnabled, todayKey])

  return <SeasonalThemeContext.Provider value={state}>
    <div className="seasonal-root" data-seasonal-theme={state.name} data-seasonal-intensity={state.intensity}>
      {state.name === 'halloween' && state.intensity !== 'off' && <SeasonalThemeBoundary>
        <Suspense fallback={null}>
          <HalloweenTheme intensity={state.intensity} reducedMotion={reducedMotion} />
        </Suspense>
      </SeasonalThemeBoundary>}
      {children}
    </div>
  </SeasonalThemeContext.Provider>
}
