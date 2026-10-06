import { describe, expect, it } from 'vitest'
import {
  clearFeatureDiscoverySession,
  hasShownOptionalSuggestionThisSession,
  markOptionalSuggestionShownThisSession,
  readFeatureCampaignPreference,
  readFeatureCampaignPreferences,
  recordFeatureCampaignAction,
  recordFeatureCampaignExposure,
  type FeatureDiscoveryStorage,
} from './featureDiscoveryStorage'

class TestStorage implements FeatureDiscoveryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

const failingStorage: FeatureDiscoveryStorage = {
  getItem() { throw new Error('storage unavailable') },
  setItem() { throw new Error('storage unavailable') },
  removeItem() { throw new Error('storage unavailable') },
}

describe('featureDiscoveryStorage', () => {
  it('isolates campaign preferences by user, version, and optional diet scope', () => {
    const storage = new TestStorage()
    recordFeatureCampaignAction('user-isolation', 'share_diet', 1, 'dismiss', { dietId: 'diet-1', now: 1_000, storage })

    expect(readFeatureCampaignPreference('user-isolation', 'share_diet', 1, 'diet-1', storage)?.dismissedAt)
      .toBe(new Date(1_000).toISOString())
    expect(readFeatureCampaignPreference('user-isolation', 'share_diet', 1, 'diet-2', storage)).toBeNull()
    expect(readFeatureCampaignPreference('another-user', 'share_diet', 1, 'diet-1', storage)).toBeNull()
    expect(readFeatureCampaignPreference('user-isolation', 'share_diet', 2, 'diet-1', storage)).toBeNull()
  })

  it('accumulates click, dismissal, and completion timestamps for one campaign scope', () => {
    const storage = new TestStorage()
    recordFeatureCampaignAction('user-actions', 'discover_hydration', 1, 'click', { now: 1_000, storage })
    recordFeatureCampaignAction('user-actions', 'discover_hydration', 1, 'dismiss', { now: 2_000, storage })
    const completed = recordFeatureCampaignAction('user-actions', 'discover_hydration', 1, 'complete', { now: 3_000, storage })

    expect(completed).toEqual({
      campaignId: 'discover_hydration',
      version: 1,
      clickedAt: new Date(1_000).toISOString(),
      dismissedAt: new Date(2_000).toISOString(),
      completedAt: new Date(3_000).toISOString(),
    })
    expect(readFeatureCampaignPreferences('user-actions', storage)).toEqual([completed])
  })

  it('persists one stable exposure id and its contextual diet', () => {
    const storage = new TestStorage()
    const viewed = recordFeatureCampaignExposure('user-exposure', 'discover_hydration', 1, 'exposure-uuid', {
      eventDietId: 'diet-context',
      now: 5_000,
      storage,
    })

    expect(viewed).toMatchObject({
      campaignId: 'discover_hydration',
      exposureId: 'exposure-uuid',
      exposureDietId: 'diet-context',
      viewedAt: new Date(5_000).toISOString(),
    })
    expect(readFeatureCampaignPreference('user-exposure', 'discover_hydration', 1, undefined, storage)).toEqual(viewed)
  })

  it('keeps the session exposure cap across reloads and resets on logout', () => {
    const sessionStorage = new TestStorage()
    expect(markOptionalSuggestionShownThisSession('user-1', sessionStorage)).toBe(true)
    expect(hasShownOptionalSuggestionThisSession('user-1', sessionStorage)).toBe(true)
    expect(markOptionalSuggestionShownThisSession('user-1', sessionStorage)).toBe(false)
    expect(markOptionalSuggestionShownThisSession('user-2', sessionStorage)).toBe(true)

    clearFeatureDiscoverySession('user-1', sessionStorage)
    expect(hasShownOptionalSuggestionThisSession('user-1', sessionStorage)).toBe(false)
    expect(markOptionalSuggestionShownThisSession('user-1', sessionStorage)).toBe(true)
  })

  it('falls back to memory when preference and session storage throw', () => {
    const preference = recordFeatureCampaignAction('memory-user', 'social_interactions', 1, 'click', {
      dietId: 'diet-3',
      now: 4_000,
      storage: failingStorage,
    })
    expect(readFeatureCampaignPreference('memory-user', 'social_interactions', 1, 'diet-3', failingStorage))
      .toEqual(preference)

    expect(markOptionalSuggestionShownThisSession('memory-user', failingStorage)).toBe(true)
    expect(hasShownOptionalSuggestionThisSession('memory-user', failingStorage)).toBe(true)
    expect(markOptionalSuggestionShownThisSession('memory-user', failingStorage)).toBe(false)
  })

  it('ignores corrupt persisted preference data without throwing', () => {
    const storage = new TestStorage()
    storage.setItem('Dietaday_feature_discovery_v1:user-corrupt', '{not-json')

    expect(readFeatureCampaignPreferences('user-corrupt', storage)).toEqual([])
    expect(readFeatureCampaignPreference('user-corrupt', 'share_diet', 1, undefined, storage)).toBeNull()
  })
})
