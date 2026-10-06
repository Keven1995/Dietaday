import { evaluateFeatureCampaigns, type FeatureCampaign, type FeatureCampaignId, type FeatureDiscoveryContext } from './featureDiscovery'
import type { FeatureCampaignPreference } from './featureDiscoveryStorage'

export const FEATURE_HINT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export type FeatureHintDisplayConditions = {
  authenticated: boolean
  dataStatus: 'ready' | 'loading' | 'error'
  formStatus: 'idle' | 'editing' | 'saving' | 'uploading'
  modalOpen: boolean
  celebrationActive: boolean
  seasonalMessageActive: boolean
  operationalError: boolean
}

export type FeatureHintDecision =
  | { status: 'selected'; campaign: FeatureCampaign }
  | { status: 'pending' | 'error' | 'blocked' | 'none' }

export type FeatureHintPolicyInput = {
  context: FeatureDiscoveryContext
  conditions: FeatureHintDisplayConditions
  preferences: Partial<Record<FeatureCampaignId, FeatureCampaignPreference>>
  sessionLimitReached: boolean
  campaignIds?: readonly FeatureCampaignId[]
  activeCampaignId?: FeatureCampaignId
  now?: number
}

export function isFeatureCampaignCoolingDown(preference: FeatureCampaignPreference | null | undefined, now = Date.now()) {
  if (!preference) return false
  if (preference.completedAt) return true

  const actionTimes = [preference.dismissedAt, preference.clickedAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite)
  if (!actionTimes.length) return false

  const latestActionAt = Math.max(...actionTimes)
  return now - latestActionAt < FEATURE_HINT_COOLDOWN_MS
}

export function decideFeatureHint(input: FeatureHintPolicyInput): FeatureHintDecision {
  const { conditions } = input
  if (!conditions.authenticated) return { status: 'blocked' }
  if (conditions.dataStatus === 'loading') return { status: 'pending' }
  if (conditions.dataStatus === 'error' || conditions.operationalError) return { status: 'blocked' }
  if (conditions.formStatus !== 'idle'
      || conditions.modalOpen
      || conditions.celebrationActive
      || conditions.seasonalMessageActive) {
    return { status: 'blocked' }
  }
  if (input.sessionLimitReached && !input.activeCampaignId) return { status: 'none' }

  const allEvaluations = evaluateFeatureCampaigns(input.context)
  const evaluations = input.campaignIds
    ? allEvaluations.filter(({ campaign }) => input.campaignIds?.includes(campaign.id))
    : allEvaluations
  const candidates = input.activeCampaignId
    ? evaluations.filter(({ campaign }) => campaign.id === input.activeCampaignId)
    : evaluations

  for (const evaluation of candidates) {
    if (isFeatureCampaignCoolingDown(input.preferences[evaluation.campaign.id], input.now)) continue
    if (evaluation.status === 'ineligible') continue
    if (evaluation.status === 'pending' || evaluation.status === 'error') return { status: evaluation.status }
    return { status: 'selected', campaign: evaluation.campaign }
  }

  return { status: 'none' }
}
