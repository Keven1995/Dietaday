import { useEffect, useEffectEvent, useMemo } from 'react'
import { useDietResource } from './useDietResource'
import { DAILY_PROGRESS_INVALIDATED_EVENT } from '../lib/dailyProgress'
import { brazilDateKey } from '../lib/date'
import { dietMealTypesForDate } from '../lib/dietMealTypes'
import { useDiets } from '../state/DietContext'
import type { DailyProgress } from '../types'

const EMPTY_PROGRESS: DailyProgress = {
  dietId: '',
  date: '',
  dailyGoal: 6,
  completedMeals: 0,
  completedMealTypes: [],
  dailyGoalCompleted: false,
  streakDays: 0,
  mealTypes: [],
}

export function useDailyProgress() {
  const { activeDiet } = useDiets()
  const demoProgress = useMemo(() => {
    const date = brazilDateKey()
    const mealTypes = dietMealTypesForDate(activeDiet?.mealTypeSchedule, date)
    return {
      ...EMPTY_PROGRESS,
      dietId: activeDiet?.id ?? '',
      date,
      dailyGoal: mealTypes.length,
      mealTypes,
    }
  }, [activeDiet?.id, activeDiet?.mealTypeSchedule])
  const resource = useDietResource<DailyProgress>('progress', demoProgress, EMPTY_PROGRESS, 'Não foi possível carregar o progresso diário.')
  const reload = useEffectEvent(resource.reload)

  useEffect(() => {
    const handleInvalidation = (event: Event) => {
      const detail = (event as CustomEvent<{ dietId: string }>).detail
      if (detail.dietId === activeDiet?.id) reload()
    }
    window.addEventListener(DAILY_PROGRESS_INVALIDATED_EVENT, handleInvalidation)
    return () => window.removeEventListener(DAILY_PROGRESS_INVALIDATED_EVENT, handleInvalidation)
  }, [activeDiet?.id])

  return resource
}
