import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FeatureDiscoveryStorage } from './featureDiscoveryStorage'
import { recordFeatureCampaignExposure, readFeatureCampaignPreference } from './featureDiscoveryStorage'
import { completeFeatureCampaign, reportFeatureHintTelemetry } from './featureDiscoveryTelemetry'
import { reportUxEvent } from './uxTelemetry'

vi.mock('./api', () => ({ isDemoMode: false }))
vi.mock('./uxTelemetry', () => ({ reportUxEvent: vi.fn() }))

class TestStorage implements FeatureDiscoveryStorage {
  private readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

describe('featureDiscoveryTelemetry', () => {
  afterEach(() => vi.clearAllMocks())

  it('uses the exposure id as the idempotent key for hint lifecycle events', () => {
    reportFeatureHintTelemetry(
      'access-token',
      'feature_hint_viewed',
      'discover_hydration',
      1,
      '/agua',
      '00000000-0000-0000-0000-000000000011',
    )

    expect(reportUxEvent).toHaveBeenCalledWith('access-token', expect.objectContaining({
      eventName: 'feature_hint_viewed',
      eventId: 'feature_hint_viewed:00000000-0000-0000-0000-000000000011',
      dietId: null,
      details: {
        campaign: 'discover_hydration',
        version: 1,
        page: '/agua',
        exposureId: '00000000-0000-0000-0000-000000000011',
      },
    }))
  })

  it('reports adoption once for a real feature completion tied to its exposure', () => {
    const storage = new TestStorage()
    const exposureId = '00000000-0000-0000-0000-000000000012'
    recordFeatureCampaignExposure('telemetry-user', 'share_diet', 1, exposureId, {
      dietId: 'diet-1',
      eventDietId: 'diet-1',
      now: 1_000,
      storage,
    })

    const options = { dietId: 'diet-1', page: '/membros', now: 2_000, storage }
    expect(completeFeatureCampaign('access-token', 'telemetry-user', 'share_diet', 1, options)).toBe(true)
    expect(completeFeatureCampaign('access-token', 'telemetry-user', 'share_diet', 1, options)).toBe(false)
    expect(readFeatureCampaignPreference('telemetry-user', 'share_diet', 1, 'diet-1', storage)?.completedAt)
      .toBe(new Date(2_000).toISOString())
    expect(reportUxEvent).toHaveBeenCalledOnce()
    expect(reportUxEvent).toHaveBeenCalledWith('access-token', expect.objectContaining({
      eventName: 'feature_adopted',
      eventId: `feature_adopted:${exposureId}`,
      dietId: 'diet-1',
      details: { campaign: 'share_diet', version: 1, page: '/membros', exposureId },
    }))
  })
})
