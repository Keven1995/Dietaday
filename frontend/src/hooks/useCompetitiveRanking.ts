import { useEffect, useState } from 'react'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import type { RankingDetails, RankingResponse } from '../types'

export function useCompetitiveRanking(page = 0, size = 20) {
  const { token, user } = useAuth()
  const { activeDiet } = useDiets()
  const [data, setData] = useState<{ ranking: RankingResponse | null; details: RankingDetails | null; loading: boolean; error: string }>({ ranking: null, details: null, loading: false, error: '' })
  const [revision, setRevision] = useState(0)
  const competitive = Boolean(activeDiet?.competitiveMode)

  useEffect(() => {
    if (!activeDiet || !competitive || !user || (!token && !isDemoMode)) {
      setData({ ranking: null, details: null, loading: false, error: '' })
      return
    }
    const controller = new AbortController()
    setData((current) => ({ ...current, loading: true, error: '' }))
    const request = isDemoMode
      ? Promise.resolve([
        { dietId: activeDiet.id, status: 'ACTIVE' as const, startDate: activeDiet.startDate, endDate: activeDiet.endDate, lastClosedDate: null, currentUser: { userId: user.id, position: 1, officialPoints: 0, pendingPoints: 0 }, participants: [{ position: 1, userId: user.id, displayName: user.fullName, officialPoints: 0, activeDays: 0, firstReachedAt: null }], page: { number: 0, size, totalElements: 1, totalPages: 1 }, podium: null } as RankingResponse,
        { userId: user.id, pendingPoints: 0, mealCountByType: {}, eligibleWaterChecks: 0, events: [], page: { number: 0, size, totalElements: 0, totalPages: 0 } } as RankingDetails,
      ] as const)
      : Promise.all([
        api<RankingResponse>(`/diets/${activeDiet.id}/ranking?page=${page}&size=${size}`, { token, signal: controller.signal }),
        api<RankingDetails>(`/diets/${activeDiet.id}/ranking/me?page=${page}&size=${size}`, { token, signal: controller.signal }),
      ])
    request.then(([ranking, details]) => { if (!controller.signal.aborted) setData({ ranking, details, loading: false, error: '' }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setData({ ranking: null, details: null, loading: false, error: getErrorMessage(error, 'Não foi possível carregar o ranking.') }) })
    return () => controller.abort()
  }, [activeDiet, competitive, page, revision, size, token, user])

  return { ...data, reload: () => setRevision((current) => current + 1) }
}
