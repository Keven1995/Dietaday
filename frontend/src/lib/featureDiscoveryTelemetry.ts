import type { FeatureCampaignId } from './featureDiscovery'
import { isDemoMode } from './api'
import {
  readFeatureCampaignPreference,
  recordFeatureCampaignAction,
  type FeatureDiscoveryStorage,
} from './featureDiscoveryStorage'
import { reportUxEvent, type UxEventName } from './uxTelemetry'

export type FeatureHintTelemetryName =
  | 'feature_hint_viewed'
  | 'feature_hint_clicked'
  | 'feature_hint_dismissed'
  | 'feature_adopted'

export function reportFeatureHintTelemetry(
  token: string | null,
  eventName: FeatureHintTelemetryName,
  campaignId: FeatureCampaignId,
  version: number,
  page: string,
  exposureId: string,
  dietId?: string,
) {
  if (!token || isDemoMode) return
  const event: Parameters<typeof reportUxEvent>[1] = {
    eventName: eventName as UxEventName,
    eventId: `${eventName}:${exposureId}`,
    dietId: dietId ?? null,
    details: { campaign: campaignId, version, page, exposureId },
  }
  void reportUxEvent(token, event)
}

export function completeFeatureCampaign(
  token: string | null,
  userId: string,
  campaignId: FeatureCampaignId,
  version: number,
  options: {
    page: string
    dietId?: string
    eventDietId?: string
    now?: number
    storage?: FeatureDiscoveryStorage | null
  },
) {
  const preference = readFeatureCampaignPreference(userId, campaignId, version, options.dietId, options.storage)
  if (preference?.completedAt) return false
  if (preference?.exposureId) {
    reportFeatureHintTelemetry(
      token,
      'feature_adopted',
      campaignId,
      version,
      options.page,
      preference.exposureId,
      preference.exposureDietId ?? options.eventDietId ?? options.dietId,
    )
  }
  recordFeatureCampaignAction(userId, campaignId, version, 'complete', {
    dietId: options.dietId,
    now: options.now,
    storage: options.storage,
  })
  return true
}
