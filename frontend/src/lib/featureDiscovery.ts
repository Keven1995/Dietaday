export const ESSENTIAL_GUIDANCE_IDS = ['create_diet', 'select_diet', 'first_meal'] as const
export type EssentialGuidanceId = (typeof ESSENTIAL_GUIDANCE_IDS)[number]

export type FeatureCampaignId =
  | 'share_diet'
  | 'discover_hydration'
  | 'water_reminders'
  | 'competitive_ranking'
  | 'social_interactions'

export type FeatureCampaignRequirement =
  | 'diet'
  | 'ownMealHistory'
  | 'members'
  | 'hydrationDiscovery'
  | 'waterCheck'
  | 'waterReminders'
  | 'socialInteraction'
  | 'completedCampaigns'

export type FeatureCampaign = {
  id: FeatureCampaignId
  version: number
  priority: number
  requirements: readonly FeatureCampaignRequirement[]
}

export const FEATURE_CAMPAIGNS: readonly FeatureCampaign[] = [
  { id: 'share_diet', version: 1, priority: 10, requirements: ['diet', 'ownMealHistory', 'members', 'completedCampaigns'] },
  { id: 'discover_hydration', version: 1, priority: 20, requirements: ['diet', 'ownMealHistory', 'hydrationDiscovery', 'completedCampaigns'] },
  { id: 'water_reminders', version: 1, priority: 30, requirements: ['waterCheck', 'waterReminders', 'completedCampaigns'] },
  { id: 'competitive_ranking', version: 1, priority: 40, requirements: ['diet', 'completedCampaigns'] },
  { id: 'social_interactions', version: 1, priority: 50, requirements: ['socialInteraction', 'completedCampaigns'] },
]

export type FeatureDiscoveryResource<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: T }

export type FeatureDiscoveryContext = {
  diet: FeatureDiscoveryResource<{ competitiveMode: boolean } | null>
  ownMealHistory: FeatureDiscoveryResource<boolean>
  members: FeatureDiscoveryResource<{ count: number; canInvite: boolean }>
  hydrationDiscovery: FeatureDiscoveryResource<'unknown' | 'known'>
  waterCheck: FeatureDiscoveryResource<boolean>
  waterReminders: FeatureDiscoveryResource<{ supported: boolean; enabled: boolean; blocked: boolean }>
  socialInteraction: FeatureDiscoveryResource<{ hasSyncedMealFromOtherMember: boolean; hasInteracted: boolean }>
  completedCampaigns: FeatureDiscoveryResource<Partial<Record<FeatureCampaignId, boolean>>>
}

export type FeatureCampaignStatus = 'eligible' | 'ineligible' | 'pending' | 'error'

export type FeatureCampaignEvaluation = {
  campaign: FeatureCampaign
  status: FeatureCampaignStatus
}

export type NextFeatureCampaign =
  | { status: 'selected'; campaign: FeatureCampaign }
  | { status: 'pending' | 'error'; campaign: FeatureCampaign }
  | { status: 'none' }

function getResourceBlock<T>(resource: FeatureDiscoveryResource<T>): 'pending' | 'error' | null {
  if (resource.status === 'loading') return 'pending'
  if (resource.status === 'error') return 'error'
  return null
}

function getDietAndMealBlock(context: FeatureDiscoveryContext) {
  const dietBlock = getResourceBlock(context.diet)
  const mealBlock = getResourceBlock(context.ownMealHistory)
  if (dietBlock === 'pending' || mealBlock === 'pending') return 'pending'
  if (dietBlock === 'error' || mealBlock === 'error') return 'error'
  if (context.diet.status !== 'ready' || context.ownMealHistory.status !== 'ready') return 'pending'
  if (!context.diet.data || !context.ownMealHistory.data) return 'ineligible'
  return null
}

function evaluateCampaignRules(id: FeatureCampaignId, context: FeatureDiscoveryContext): FeatureCampaignStatus {
  const campaign = FEATURE_CAMPAIGNS.find((candidate) => candidate.id === id)
  if (!campaign) return 'ineligible'
  const requiredResources = campaign.requirements.map((requirement) => context[requirement])
  if (requiredResources.some((resource) => resource.status === 'loading')) return 'pending'
  if (requiredResources.some((resource) => resource.status === 'error')) return 'error'

  const completionBlock = getResourceBlock(context.completedCampaigns)
  if (completionBlock) return completionBlock
  if (context.completedCampaigns.status !== 'ready') return 'pending'
  if (context.completedCampaigns.data[id]) return 'ineligible'

  switch (id) {
    case 'share_diet': {
      const baseBlock = getDietAndMealBlock(context)
      if (baseBlock) return baseBlock
      const membersBlock = getResourceBlock(context.members)
      if (membersBlock) return membersBlock
      if (context.members.status !== 'ready') return 'pending'
      return context.members.data.count === 1 && context.members.data.canInvite ? 'eligible' : 'ineligible'
    }
    case 'discover_hydration': {
      const baseBlock = getDietAndMealBlock(context)
      if (baseBlock) return baseBlock
      const hydrationBlock = getResourceBlock(context.hydrationDiscovery)
      if (hydrationBlock) return hydrationBlock
      if (context.hydrationDiscovery.status !== 'ready') return 'pending'
      return context.hydrationDiscovery.data === 'unknown' ? 'eligible' : 'ineligible'
    }
    case 'water_reminders': {
      const checkBlock = getResourceBlock(context.waterCheck)
      const remindersBlock = getResourceBlock(context.waterReminders)
      if (checkBlock === 'pending' || remindersBlock === 'pending') return 'pending'
      if (checkBlock === 'error' || remindersBlock === 'error') return 'error'
      if (context.waterCheck.status !== 'ready' || context.waterReminders.status !== 'ready') return 'pending'
      return context.waterCheck.data
        && context.waterReminders.data.supported
        && !context.waterReminders.data.enabled
        && !context.waterReminders.data.blocked
        ? 'eligible'
        : 'ineligible'
    }
    case 'competitive_ranking': {
      const dietBlock = getResourceBlock(context.diet)
      if (dietBlock) return dietBlock
      if (context.diet.status !== 'ready') return 'pending'
      return context.diet.data?.competitiveMode ? 'eligible' : 'ineligible'
    }
    case 'social_interactions': {
      const socialBlock = getResourceBlock(context.socialInteraction)
      if (socialBlock) return socialBlock
      if (context.socialInteraction.status !== 'ready') return 'pending'
      return context.socialInteraction.data.hasSyncedMealFromOtherMember
        && !context.socialInteraction.data.hasInteracted
        ? 'eligible'
        : 'ineligible'
    }
  }
}

export function evaluateFeatureCampaigns(context: FeatureDiscoveryContext): FeatureCampaignEvaluation[] {
  return FEATURE_CAMPAIGNS
    .map((campaign) => ({ campaign, status: evaluateCampaignRules(campaign.id, context) }))
    .sort((left, right) => left.campaign.priority - right.campaign.priority)
}

export function getEligibleFeatureCampaigns(context: FeatureDiscoveryContext): FeatureCampaign[] {
  return evaluateFeatureCampaigns(context)
    .filter((evaluation) => evaluation.status === 'eligible')
    .map((evaluation) => evaluation.campaign)
}

export function selectNextFeatureCampaign(context: FeatureDiscoveryContext): NextFeatureCampaign {
  for (const evaluation of evaluateFeatureCampaigns(context)) {
    if (evaluation.status === 'ineligible') continue
    if (evaluation.status === 'eligible') return { status: 'selected', campaign: evaluation.campaign }
    return { status: evaluation.status, campaign: evaluation.campaign }
  }
  return { status: 'none' }
}
