import { useEffect, useState } from 'react'
import { api, isDemoMode } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import type { RankingActivity } from '../types'

const POLL_INTERVAL_MS = 5_000

function seenKey(userId: string, dietId: string) {
  return `Dietaday_ranking_activity_seen:${userId}:${dietId}`
}

export function useCompetitiveRankingActivity() {
  const { token, user } = useAuth()
  const { activeDiet } = useDiets()
  const [activity, setActivity] = useState<RankingActivity | null>(null)
  const [seenEventId, setSeenEventId] = useState<string | null>(null)

  useEffect(() => {
    if (!activeDiet?.competitiveMode || !user || (!token && !isDemoMode)) {
      setActivity(null)
      setSeenEventId(null)
      return
    }
    const stored = localStorage.getItem(seenKey(user.id, activeDiet.id))
    setSeenEventId(stored)
    if (isDemoMode) {
      setActivity(null)
      return
    }

    let cancelled = false
    let controller: AbortController | null = null
    const checkActivity = async () => {
      controller?.abort()
      controller = new AbortController()
      try {
        const next = await api<RankingActivity>(`/diets/${activeDiet.id}/ranking/activity`, { token, signal: controller.signal })
        if (!cancelled) setActivity(next)
      } catch {
        // The ranking widget remains available when activity polling is temporarily unavailable.
      }
    }
    void checkActivity()
    const timer = window.setInterval(() => void checkActivity(), POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      controller?.abort()
      window.clearInterval(timer)
    }
  }, [activeDiet?.competitiveMode, activeDiet?.id, token, user?.id])

  function acknowledge() {
    if (!user || !activeDiet || !activity?.eventId) return
    localStorage.setItem(seenKey(user.id, activeDiet.id), activity.eventId)
    setSeenEventId(activity.eventId)
  }

  return {
    hasUnseenActivity: Boolean(activity?.eventId && activity.eventId !== seenEventId),
    activitySourceType: activity?.eventId && activity.eventId !== seenEventId ? activity.sourceType : null,
    acknowledge,
  }
}
