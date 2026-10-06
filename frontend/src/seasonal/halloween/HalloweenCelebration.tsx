import { useEffect } from 'react'
import { MEAL_SYNCED_EVENT } from '../../state/OfflineMealContext'
import { useCelebration } from '../../state/CelebrationContext'
import { useHalloween } from './hooks/useHalloween'
import { halloweenConfig } from './HalloweenConfig'

type MealSyncedDetail = {
  operationId?: string
  mealId?: string
  pointsEarned?: number
}

export function HalloweenCelebration() {
  const { isHalloween, intensity } = useHalloween()
  const { celebrate } = useCelebration()

  useEffect(() => {
    if (!isHalloween || intensity !== 'full' || !halloweenConfig.effects.celebration) return

    const handleMealSynced = (event: Event) => {
      const detail = (event as CustomEvent<MealSyncedDetail>).detail
      const id = detail?.mealId ?? detail?.operationId
      if (!id) return
      const pointsEarned = Number.isFinite(detail.pointsEarned) ? Math.max(0, detail.pointsEarned ?? 0) : 0
      celebrate({ type: 'MEAL_REGISTERED', id, pointsEarned })
    }

    window.addEventListener(MEAL_SYNCED_EVENT, handleMealSynced)
    return () => window.removeEventListener(MEAL_SYNCED_EVENT, handleMealSynced)
  }, [celebrate, intensity, isHalloween])

  return null
}
