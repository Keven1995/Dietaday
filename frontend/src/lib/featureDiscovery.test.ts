import { describe, expect, it } from 'vitest'
import {
  ESSENTIAL_GUIDANCE_IDS,
  FEATURE_CAMPAIGNS,
  evaluateFeatureCampaigns,
  getEligibleFeatureCampaigns,
  selectNextFeatureCampaign,
  type FeatureDiscoveryContext,
  type FeatureDiscoveryResource,
} from './featureDiscovery'

function ready<T>(data: T): FeatureDiscoveryResource<T> {
  return { status: 'ready', data }
}

function context(overrides: Partial<FeatureDiscoveryContext> = {}): FeatureDiscoveryContext {
  return {
    diet: ready({ competitiveMode: false }),
    ownMealHistory: ready(true),
    members: ready({ count: 1, canInvite: true }),
    hydrationDiscovery: ready('unknown'),
    waterCheck: ready(true),
    waterReminders: ready({ supported: true, enabled: false, blocked: false }),
    socialInteraction: ready({ hasSyncedMealFromOtherMember: true, hasInteracted: false }),
    completedCampaigns: ready({}),
    ...overrides,
  }
}

describe('featureDiscovery', () => {
  it('keeps essential onboarding outside the optional campaign catalog', () => {
    expect(ESSENTIAL_GUIDANCE_IDS).toEqual(['create_diet', 'select_diet', 'first_meal'])
    expect(FEATURE_CAMPAIGNS.map(({ id }) => id)).not.toContain('first_meal')
    expect(FEATURE_CAMPAIGNS.every(({ version }) => version > 0)).toBe(true)
  })

  it('sorts eligible optional campaigns by configured priority', () => {
    expect(getEligibleFeatureCampaigns(context({ diet: ready({ competitiveMode: true }) })).map(({ id }) => id)).toEqual([
      'share_diet',
      'discover_hydration',
      'water_reminders',
      'competitive_ranking',
      'social_interactions',
    ])
  })

  it('waits for a higher-priority campaign before selecting a lower-priority one', () => {
    const waiting = selectNextFeatureCampaign(context({
      diet: ready({ competitiveMode: true }),
      members: { status: 'loading' },
    }))
    expect(waiting.status).toBe('pending')

    const next = selectNextFeatureCampaign(context({
      diet: ready({ competitiveMode: true }),
      members: ready({ count: 2, canInvite: true }),
    }))
    expect(next).toMatchObject({ status: 'selected', campaign: { id: 'discover_hydration' } })
  })

  it('requires a first own meal, one member, and invite permission before sharing', () => {
    expect(getEligibleFeatureCampaigns(context({ ownMealHistory: ready(false) })).map(({ id }) => id))
      .not.toContain('share_diet')
    expect(getEligibleFeatureCampaigns(context({ members: ready({ count: 2, canInvite: true }) })).map(({ id }) => id))
      .not.toContain('share_diet')
    expect(getEligibleFeatureCampaigns(context({ members: ready({ count: 1, canInvite: false }) })).map(({ id }) => id))
      .not.toContain('share_diet')
  })

  it('offers hydration discovery only when it is not already known', () => {
    expect(getEligibleFeatureCampaigns(context({ hydrationDiscovery: ready('known') })).map(({ id }) => id))
      .not.toContain('discover_hydration')
    expect(getEligibleFeatureCampaigns(context({ diet: ready(null) })).map(({ id }) => id))
      .not.toContain('discover_hydration')
  })

  it('offers reminders only after a successful check when push is available and unblocked', () => {
    expect(getEligibleFeatureCampaigns(context({ waterCheck: ready(false) })).map(({ id }) => id))
      .not.toContain('water_reminders')
    for (const reminders of [
      { supported: false, enabled: false, blocked: false },
      { supported: true, enabled: true, blocked: false },
      { supported: true, enabled: false, blocked: true },
    ]) {
      expect(getEligibleFeatureCampaigns(context({ waterReminders: ready(reminders) })).map(({ id }) => id))
        .not.toContain('water_reminders')
    }
  })

  it('limits social guidance to synced meals from another member before first interaction', () => {
    expect(getEligibleFeatureCampaigns(context({
      socialInteraction: ready({ hasSyncedMealFromOtherMember: false, hasInteracted: false }),
    })).map(({ id }) => id)).not.toContain('social_interactions')
    expect(getEligibleFeatureCampaigns(context({
      socialInteraction: ready({ hasSyncedMealFromOtherMember: true, hasInteracted: true }),
    })).map(({ id }) => id)).not.toContain('social_interactions')
  })

  it('offers competitive ranking only for a competitive diet', () => {
    expect(getEligibleFeatureCampaigns(context()).map(({ id }) => id)).not.toContain('competitive_ranking')
    expect(getEligibleFeatureCampaigns(context({ diet: ready({ competitiveMode: true }) })).map(({ id }) => id))
      .toContain('competitive_ranking')
  })

  it('preserves loading and error as undecided instead of treating them as unused', () => {
    const loading = evaluateFeatureCampaigns(context({ members: { status: 'loading' } }))
      .find(({ campaign }) => campaign.id === 'share_diet')
    const error = evaluateFeatureCampaigns(context({ ownMealHistory: { status: 'error' } }))
      .find(({ campaign }) => campaign.id === 'share_diet')
    expect(loading?.status).toBe('pending')
    expect(error?.status).toBe('error')
  })

  it('keeps campaign-specific loading and errors distinct from an unused feature', () => {
    const cases = [
      { context: context({ hydrationDiscovery: { status: 'loading' } }), id: 'discover_hydration', status: 'pending' },
      { context: context({ waterCheck: { status: 'error' } }), id: 'water_reminders', status: 'error' },
      { context: context({ socialInteraction: { status: 'loading' } }), id: 'social_interactions', status: 'pending' },
      { context: context({ diet: { status: 'error' } }), id: 'competitive_ranking', status: 'error' },
    ] as const

    for (const scenario of cases) {
      expect(evaluateFeatureCampaigns(scenario.context).find(({ campaign }) => campaign.id === scenario.id)?.status)
        .toBe(scenario.status)
    }
  })

  it('suppresses completed campaigns and waits for completion state to load', () => {
    expect(getEligibleFeatureCampaigns(context({ completedCampaigns: ready({ share_diet: true }) }))
      .map(({ id }) => id)).not.toContain('share_diet')
    const evaluation = evaluateFeatureCampaigns(context({ completedCampaigns: { status: 'loading' } }))
      .find(({ campaign }) => campaign.id === 'share_diet')
    expect(evaluation?.status).toBe('pending')
  })
})
