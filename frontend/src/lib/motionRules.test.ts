import { describe, expect, it } from 'vitest'
import { clampProgress, crossedThreshold } from './motionRules'

describe('motion rules', () => {
  it('keeps progress between zero and its maximum', () => {
    expect(clampProgress(-10)).toBe(0)
    expect(clampProgress(64)).toBe(64)
    expect(clampProgress(140)).toBe(100)
    expect(clampProgress(12, 10)).toBe(10)
  })

  it('detects only the transition that crosses a threshold', () => {
    expect(crossedThreshold(64, 72, 100)).toBe(false)
    expect(crossedThreshold(99, 100, 100)).toBe(true)
    expect(crossedThreshold(100, 100, 100)).toBe(false)
    expect(crossedThreshold(120, 130, 100)).toBe(false)
  })
})
