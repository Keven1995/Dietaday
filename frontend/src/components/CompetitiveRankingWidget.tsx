import { Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { COMPETITIVE_SCORE_UPDATED_EVENT, type CompetitiveScoreUpdatedDetail } from '../lib/competitiveRanking'
import { useCompetitiveRanking } from '../hooks/useCompetitiveRanking'
import { useDiets } from '../state/DietContext'

export function CompetitiveRankingWidget() {
  const { activeDiet } = useDiets()
  const location = useLocation()
  const { ranking, loading, reload } = useCompetitiveRanking(0, 3)
  const [reacting, setReacting] = useState(false)
  const reactionTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const handleScoreUpdate = (event: Event) => {
      const detail = (event as CustomEvent<CompetitiveScoreUpdatedDetail>).detail
      if (!detail || detail.dietId !== activeDiet?.id) return
      setReacting(true)
      reload()
      if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current)
      reactionTimerRef.current = window.setTimeout(() => setReacting(false), 1400)
    }
    window.addEventListener(COMPETITIVE_SCORE_UPDATED_EVENT, handleScoreUpdate)
    return () => {
      window.removeEventListener(COMPETITIVE_SCORE_UPDATED_EVENT, handleScoreUpdate)
      if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current)
    }
  }, [activeDiet?.id])

  if (!activeDiet?.competitiveMode || location.pathname === '/ranking' || (!ranking && !loading)) return null
  const label = loading ? 'Abrir ranking competitivo. Carregando dados.' : `Abrir ranking competitivo. ${ranking?.currentUser.position}º lugar, ${ranking?.currentUser.officialPoints} pontos${ranking?.currentUser.pendingPoints ? ` e ${ranking.currentUser.pendingPoints} pontos pendentes` : ''}.`
  return <Link to="/ranking" className={`competitive-widget${reacting ? ' reacting' : ''}`} aria-label={label} title={label}><Trophy size={19} aria-hidden="true" /></Link>
}
