import { useDiets } from '../state/DietContext'

export function useCompetitiveMode() {
  const { activeDiet } = useDiets()
  const enabled = Boolean(activeDiet?.competitiveMode)

  return {
    activeDiet,
    dietId: enabled ? activeDiet?.id ?? null : null,
    enabled,
    showPoints: enabled,
    showRanking: enabled,
  }
}
