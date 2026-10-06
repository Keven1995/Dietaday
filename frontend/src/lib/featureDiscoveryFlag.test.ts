import { describe, expect, it } from 'vitest'
import { isFeatureDiscoveryEnabled } from './featureDiscoveryFlag'

describe('isFeatureDiscoveryEnabled', () => {
  it('enables discovery only for the literal true value', () => {
    expect(isFeatureDiscoveryEnabled('true')).toBe(true)
    expect(isFeatureDiscoveryEnabled('false')).toBe(false)
    expect(isFeatureDiscoveryEnabled(undefined)).toBe(false)
    expect(isFeatureDiscoveryEnabled(true)).toBe(false)
    expect(isFeatureDiscoveryEnabled('TRUE')).toBe(false)
  })
})
