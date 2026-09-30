import { describe, expect, it } from 'vitest'
import { getRankingMovement } from './rankingMovement'

describe('ranking movement', () => {
  it('does not announce the initial ranking position', () => {
    expect(getRankingMovement(null, 4)).toBeNull()
  })

  it('detects upward and downward movement', () => {
    expect(getRankingMovement(5, 3)).toBe('up')
    expect(getRankingMovement(3, 5)).toBe('down')
    expect(getRankingMovement(3, 3)).toBeNull()
  })
})
