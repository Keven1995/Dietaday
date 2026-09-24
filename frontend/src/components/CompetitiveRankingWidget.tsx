import { Trophy } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useCompetitiveRanking } from '../hooks/useCompetitiveRanking'
import { useDiets } from '../state/DietContext'

export function CompetitiveRankingWidget() {
  const { activeDiet } = useDiets()
  const location = useLocation()
  const { ranking, loading } = useCompetitiveRanking(0, 3)
  if (!activeDiet?.competitiveMode || location.pathname === '/ranking' || (!ranking && !loading)) return null
  return <Link to="/ranking" className="competitive-widget"><span className="competitive-widget-icon"><Trophy size={18} /></span><span><small>RANKING</small><strong>{loading ? 'Carregando...' : `${ranking?.currentUser.position}º lugar · ${ranking?.currentUser.officialPoints} pts`}</strong></span>{ranking && ranking.currentUser.pendingPoints > 0 && <b>+{ranking.currentUser.pendingPoints}</b>}</Link>
}
