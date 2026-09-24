import { Trophy } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useCompetitiveRanking } from '../hooks/useCompetitiveRanking'
import { useCompetitiveRankingActivity } from '../hooks/useCompetitiveRankingActivity'
import { useDiets } from '../state/DietContext'

export function CompetitiveRankingWidget() {
  const { activeDiet } = useDiets()
  const location = useLocation()
  const { ranking, loading } = useCompetitiveRanking(0, 3)
  const { hasUnseenActivity, acknowledge } = useCompetitiveRankingActivity()

  if (!activeDiet?.competitiveMode || location.pathname === '/ranking' || (!ranking && !loading)) return null
  const label = loading ? 'Abrir ranking competitivo. Carregando dados.' : `Abrir ranking competitivo. ${ranking?.currentUser.position}º lugar, ${ranking?.currentUser.officialPoints} pontos${ranking?.currentUser.pendingPoints ? ` e ${ranking.currentUser.pendingPoints} pontos pendentes` : ''}.`
  return <Link to="/ranking" className={`competitive-widget${hasUnseenActivity ? ' reacting' : ''}`} aria-label={label} title={label} onClick={acknowledge}><Trophy size={19} aria-hidden="true" /></Link>
}
