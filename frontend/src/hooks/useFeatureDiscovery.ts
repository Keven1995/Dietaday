import { useCallback, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  FEATURE_CAMPAIGNS,
  type FeatureCampaign,
  type FeatureCampaignId,
  type FeatureDiscoveryContext,
} from '../lib/featureDiscovery'
import {
  hasShownOptionalSuggestionThisSession,
  markOptionalSuggestionShownThisSession,
  readFeatureCampaignPreference,
  recordFeatureCampaignExposure,
  recordFeatureCampaignAction,
  type FeatureCampaignAction,
  type FeatureCampaignPreference,
  type FeatureDiscoveryStorage,
} from '../lib/featureDiscoveryStorage'
import { isFeatureDiscoveryEnabled } from '../lib/featureDiscoveryFlag'
import { decideFeatureHint, type FeatureHintDisplayConditions, type FeatureHintDecision } from '../lib/featureDiscoveryPolicy'
import { reportFeatureHintTelemetry, completeFeatureCampaign } from '../lib/featureDiscoveryTelemetry'
import { createUuid } from '../lib/uuid'
import { useAuth } from '../state/AuthContext'

export type UseFeatureDiscoveryOptions = {
  userId: string | null
  context: FeatureDiscoveryContext
  conditions: FeatureHintDisplayConditions
  campaignIds?: readonly FeatureCampaignId[]
  dietIdsByCampaign?: Partial<Record<FeatureCampaignId, string>>
  eventDietIdsByCampaign?: Partial<Record<FeatureCampaignId, string>>
  preferenceStorage?: FeatureDiscoveryStorage | null
  sessionStorage?: FeatureDiscoveryStorage | null
  now?: number
}

export type UseFeatureDiscoveryResult = {
  campaign: FeatureCampaign | null
  decision: FeatureHintDecision['status']
  onVisible: () => void
  onClicked: () => void
  onDismissed: () => void
  onCompleted: () => void
}

export function useFeatureDiscovery({
  userId,
  context,
  conditions,
  campaignIds,
  dietIdsByCampaign,
  eventDietIdsByCampaign,
  preferenceStorage,
  sessionStorage,
  now,
}: UseFeatureDiscoveryOptions): UseFeatureDiscoveryResult {
  const { token } = useAuth()
  const location = useLocation()
  const [revision, setRevision] = useState(0)
  const [exposedCampaign, setExposedCampaign] = useState<{
    userId: string
    campaignId: FeatureCampaignId
    dietId?: string
    eventDietId?: string
  } | null>(null)
  const exposureClaim = useRef<{
    userId: string
    campaignId: FeatureCampaignId
    dietId?: string
    eventDietId?: string
    exposureId: string
  } | null>(null)
  const activeCampaignId = exposedCampaign?.userId === userId
      && exposedCampaign.dietId === dietIdsByCampaign?.[exposedCampaign.campaignId]
      && exposedCampaign.eventDietId === (eventDietIdsByCampaign?.[exposedCampaign.campaignId]
        ?? dietIdsByCampaign?.[exposedCampaign.campaignId])
    ? exposedCampaign.campaignId
    : undefined

  const preferences = useMemo(() => {
    const values: Partial<Record<FeatureCampaignId, FeatureCampaignPreference>> = {}
    if (!userId) return values
    for (const campaign of FEATURE_CAMPAIGNS) {
      const preference = readFeatureCampaignPreference(
        userId,
        campaign.id,
        campaign.version,
        dietIdsByCampaign?.[campaign.id],
        preferenceStorage,
      )
      if (preference) values[campaign.id] = preference
    }
    return values
  }, [dietIdsByCampaign, preferenceStorage, revision, userId])

  const sessionLimitReached = userId
    ? hasShownOptionalSuggestionThisSession(userId, sessionStorage)
    : false
  const decision: FeatureHintDecision = !isFeatureDiscoveryEnabled() || !userId || !token
    ? { status: 'blocked' }
    : decideFeatureHint({
      context,
      conditions,
      preferences,
      sessionLimitReached,
      campaignIds,
      activeCampaignId,
      now,
    })
  const campaign = decision.status === 'selected' ? decision.campaign : null

  const claimExposure = useCallback((campaignId: FeatureCampaignId) => {
    if (!userId || !token) return false
    const dietId = dietIdsByCampaign?.[campaignId]
    const eventDietId = eventDietIdsByCampaign?.[campaignId] ?? dietId
    const currentClaim = exposureClaim.current
    if (currentClaim?.userId === userId
        && currentClaim.campaignId === campaignId
        && currentClaim.dietId === dietId
        && currentClaim.eventDietId === eventDietId) return true
    if (!markOptionalSuggestionShownThisSession(userId, sessionStorage)) return false
    const exposureId = createUuid()
    const campaign = FEATURE_CAMPAIGNS.find((item) => item.id === campaignId)
    if (!campaign) return false
    recordFeatureCampaignExposure(userId, campaignId, campaign.version, exposureId, {
      dietId,
      eventDietId,
      now,
      storage: preferenceStorage,
    })
    reportFeatureHintTelemetry(token, 'feature_hint_viewed', campaignId, campaign.version,
      location.pathname, exposureId, eventDietId)
    const claim = {
      userId,
      campaignId,
      exposureId,
      ...(dietId ? { dietId } : {}),
      ...(eventDietId ? { eventDietId } : {}),
    }
    exposureClaim.current = claim
    setExposedCampaign(claim)
    return true
  }, [dietIdsByCampaign, eventDietIdsByCampaign, location.pathname, now, preferenceStorage, sessionStorage, token, userId])

  const onVisible = useCallback(() => {
    if (campaign) claimExposure(campaign.id)
  }, [campaign, claimExposure])

  const recordAction = useCallback((action: FeatureCampaignAction) => {
    if (!userId || !campaign || !claimExposure(campaign.id)) return
    const claim = exposureClaim.current
    if (action === 'complete') {
      completeFeatureCampaign(token, userId, campaign.id, campaign.version, {
        dietId: dietIdsByCampaign?.[campaign.id],
        eventDietId: claim?.eventDietId,
        page: location.pathname,
        now,
        storage: preferenceStorage,
      })
    } else {
      recordFeatureCampaignAction(userId, campaign.id, campaign.version, action, {
        dietId: dietIdsByCampaign?.[campaign.id],
        now,
        storage: preferenceStorage,
      })
      if (claim) {
        reportFeatureHintTelemetry(token, action === 'click' ? 'feature_hint_clicked' : 'feature_hint_dismissed',
          campaign.id, campaign.version, location.pathname, claim.exposureId, claim.eventDietId)
      }
    }
    exposureClaim.current = null
    setExposedCampaign((current) => current?.userId === userId
        && current.campaignId === campaign.id
        && current.dietId === dietIdsByCampaign?.[campaign.id]
        && current.eventDietId === (eventDietIdsByCampaign?.[campaign.id] ?? dietIdsByCampaign?.[campaign.id]) ? null : current)
    setRevision((value) => value + 1)
  }, [campaign, claimExposure, dietIdsByCampaign, eventDietIdsByCampaign, location.pathname, now, preferenceStorage, token, userId])

  const onClicked = useCallback(() => recordAction('click'), [recordAction])
  const onDismissed = useCallback(() => recordAction('dismiss'), [recordAction])
  const onCompleted = useCallback(() => recordAction('complete'), [recordAction])

  return { campaign, decision: decision.status, onVisible, onClicked, onDismissed, onCompleted }
}
