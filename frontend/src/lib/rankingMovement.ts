export type RankingMovementDirection = 'up' | 'down'

export function getRankingMovement(previous: number | null, current: number): RankingMovementDirection | null {
  if (previous === null || previous === current) return null
  return current < previous ? 'up' : 'down'
}
