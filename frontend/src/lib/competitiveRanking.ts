export const COMPETITIVE_SCORE_UPDATED_EVENT = 'competitive-ranking-score-updated'

export type CompetitiveScoreSource = 'MEAL' | 'WATER_CHECK'

export type CompetitiveScoreUpdatedDetail = {
  dietId: string
  source: CompetitiveScoreSource
}

export function notifyCompetitiveScoreUpdated(detail: CompetitiveScoreUpdatedDetail) {
  window.dispatchEvent(new CustomEvent<CompetitiveScoreUpdatedDetail>(COMPETITIVE_SCORE_UPDATED_EVENT, { detail }))
}
