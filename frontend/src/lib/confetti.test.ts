import { describe, expect, it } from 'vitest'
import { createConfettiPieces } from './confetti'

describe('createConfettiPieces', () => {
  it('uses stronger density for the final ranking', () => {
    expect(createConfettiPieces('ranking-finalized')).toHaveLength(34)
    expect(createConfettiPieces('streak')).toHaveLength(20)
  })

  it('keeps particle positions deterministic', () => {
    expect(createConfettiPieces('daily-goal')).toEqual(createConfettiPieces('daily-goal'))
  })
})
