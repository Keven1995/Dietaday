export const COMPETITIVE_POINTS_EVENT = 'dietaday:competitive-points'
export const COMPETITIVE_RANKING_INVALIDATED_EVENT = 'dietaday:ranking-invalidated'

export type CompetitivePointsSource = 'MEAL' | 'WATER_CHECK'

export type CompetitivePointsDetail = {
  dietId: string
  points: number
  source: CompetitivePointsSource
  eventId?: string
}

export function emitCompetitivePoints(detail: CompetitivePointsDetail) {
  if (typeof window === 'undefined' || detail.points <= 0) return
  window.dispatchEvent(new CustomEvent<CompetitivePointsDetail>(COMPETITIVE_POINTS_EVENT, { detail }))
}

export function emitCompetitiveRankingInvalidated(dietId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<{ dietId: string }>(COMPETITIVE_RANKING_INVALIDATED_EVENT, { detail: { dietId } }))
}
