import { describe, expect, it } from 'vitest'
import {
  FEATURE_HINT_COOLDOWN_MS,
  decideFeatureHint,
  isFeatureCampaignCoolingDown,
  type FeatureHintDisplayConditions,
} from './featureDiscoveryPolicy'
import { type FeatureDiscoveryContext, type FeatureDiscoveryResource } from './featureDiscovery'
import type { FeatureCampaignPreference } from './featureDiscoveryStorage'

function ready<T>(data: T): FeatureDiscoveryResource<T> {
  return { status: 'ready', data }
}

function context(): FeatureDiscoveryContext {
  return {
    diet: ready({ competitiveMode: false }),
    ownMealHistory: ready(true),
    members: ready({ count: 1, canInvite: true }),
    hydrationDiscovery: ready('unknown'),
    waterCheck: ready(true),
    waterReminders: ready({ supported: true, enabled: false, blocked: false }),
    socialInteraction: ready({ hasSyncedMealFromOtherMember: true, hasInteracted: false }),
    completedCampaigns: ready({}),
  }
}

function conditions(overrides: Partial<FeatureHintDisplayConditions> = {}): FeatureHintDisplayConditions {
  return {
    authenticated: true,
    dataStatus: 'ready',
    formStatus: 'idle',
    modalOpen: false,
    celebrationActive: false,
    seasonalMessageActive: false,
    operationalError: false,
    ...overrides,
  }
}

describe('featureDiscoveryPolicy', () => {
  it('blocks optional hints during unauthenticated, loading, error, form, modal, celebration, and seasonal states', () => {
    const blockedConditions: Partial<FeatureHintDisplayConditions>[] = [
      { authenticated: false },
      { dataStatus: 'error' },
      { operationalError: true },
      { formStatus: 'editing' },
      { formStatus: 'saving' },
      { formStatus: 'uploading' },
      { modalOpen: true },
      { celebrationActive: true },
      { seasonalMessageActive: true },
    ]
    for (const blocked of blockedConditions) {
      expect(decideFeatureHint({
        context: context(),
        conditions: conditions(blocked),
        preferences: {},
        sessionLimitReached: false,
      }).status).toBe('blocked')
    }
    expect(decideFeatureHint({
      context: context(),
      conditions: conditions({ dataStatus: 'loading' }),
      preferences: {},
      sessionLimitReached: false,
    }).status).toBe('pending')
  })

  it('permits one selected hint per session while keeping the currently exposed hint mounted', () => {
    const base = {
      context: context(),
      conditions: conditions(),
      preferences: {},
    }
    expect(decideFeatureHint({ ...base, sessionLimitReached: false }))
      .toMatchObject({ status: 'selected', campaign: { id: 'share_diet' } })
    expect(decideFeatureHint({ ...base, sessionLimitReached: true }).status).toBe('none')
    expect(decideFeatureHint({ ...base, sessionLimitReached: true, activeCampaignId: 'share_diet' }))
      .toMatchObject({ status: 'selected', campaign: { id: 'share_diet' } })
  })

  it('applies the seven-day cooldown after dismissal or click and clears it at expiry', () => {
    const clicked: FeatureCampaignPreference = {
      campaignId: 'share_diet',
      version: 1,
      clickedAt: new Date(1_000).toISOString(),
    }
    const dismissed: FeatureCampaignPreference = {
      campaignId: 'share_diet',
      version: 1,
      dismissedAt: new Date(1_000).toISOString(),
    }
    expect(isFeatureCampaignCoolingDown(clicked, 1_000 + FEATURE_HINT_COOLDOWN_MS - 1)).toBe(true)
    expect(isFeatureCampaignCoolingDown(clicked, 1_000 + FEATURE_HINT_COOLDOWN_MS)).toBe(false)
    expect(isFeatureCampaignCoolingDown(dismissed, 1_000 + FEATURE_HINT_COOLDOWN_MS - 1)).toBe(true)
    expect(isFeatureCampaignCoolingDown(dismissed, 1_000 + FEATURE_HINT_COOLDOWN_MS)).toBe(false)

    const preference: Partial<Record<'share_diet' | 'discover_hydration', FeatureCampaignPreference>> = {
      share_diet: { campaignId: 'share_diet', version: 1, dismissedAt: new Date(1_000).toISOString() },
    }
    expect(decideFeatureHint({
      context: context(),
      conditions: conditions(),
      preferences: preference,
      sessionLimitReached: false,
      now: 1_000 + 1,
    })).toMatchObject({ status: 'selected', campaign: { id: 'discover_hydration' } })
  })

  it('does not fall through to a lower-priority hint when higher-priority data is pending', () => {
    expect(decideFeatureHint({
      context: context(),
      conditions: conditions(),
      preferences: {},
      sessionLimitReached: false,
      now: 1_000,
    })).toMatchObject({ status: 'selected', campaign: { id: 'share_diet' } })

    expect(decideFeatureHint({
      context: { ...context(), members: { status: 'loading' } },
      conditions: conditions(),
      preferences: {},
      sessionLimitReached: false,
      now: 1_000,
    }).status).toBe('pending')
  })

  it('suppresses completed campaigns even if the eligibility condition still applies', () => {
    expect(decideFeatureHint({
      context: context(),
      conditions: conditions(),
      preferences: {
        share_diet: {
          campaignId: 'share_diet',
          version: 1,
          completedAt: new Date(1_000).toISOString(),
        },
      },
      sessionLimitReached: false,
      now: 1_000,
    })).toMatchObject({ status: 'selected', campaign: { id: 'discover_hydration' } })
  })
})
