import { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext'
import { useWater } from '../state/WaterContext'
import { api, isDemoMode } from '../lib/api'
import { readFeatureCampaignPreference } from '../lib/featureDiscoveryStorage'
import { isFeatureDiscoveryEnabled } from '../lib/featureDiscoveryFlag'
import type { FeatureDiscoveryResource } from '../lib/featureDiscovery'

type HydrationDiscoveryState = {
  userId: string | null
  resource: FeatureDiscoveryResource<'unknown' | 'known'>
}

export function useHydrationDiscoveryStatus(): FeatureDiscoveryResource<'unknown' | 'known'> {
  const { token, user } = useAuth()
  const { water } = useWater()
  const [state, setState] = useState<HydrationDiscoveryState>({ userId: null, resource: { status: 'loading' } })

  useEffect(() => {
    if (!user || !isFeatureDiscoveryEnabled()) {
      setState({ userId: user?.id ?? null, resource: { status: 'loading' } })
      return
    }
    if (isDemoMode) return

    let active = true
    const controller = new AbortController()
    setState({ userId: user.id, resource: { status: 'loading' } })
    api<boolean>('/water/has-checks', { token, signal: controller.signal })
      .then((hasEverChecked) => {
        if (active) setState({
          userId: user.id,
          resource: { status: 'ready', data: hasEverChecked ? 'known' : 'unknown' },
        })
      })
      .catch(() => {
        if (active && !controller.signal.aborted) {
          setState({ userId: user.id, resource: { status: 'error' } })
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [token, user?.id])

  useEffect(() => {
    if (!isDemoMode || !user) return
    const preference = readFeatureCampaignPreference(user.id, 'discover_hydration', 1)
    const hasPositiveHistoryEvidence = Boolean(preference?.completedAt || water?.checks.length)
    setState({
      userId: user.id,
      resource: hasPositiveHistoryEvidence
        ? { status: 'ready', data: 'known' }
        : { status: 'error' },
    })
  }, [user?.id, water?.checks.length])

  return user && state.userId === user.id ? state.resource : { status: 'loading' }
}
