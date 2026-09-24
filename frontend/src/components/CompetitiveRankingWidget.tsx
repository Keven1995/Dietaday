import { Trophy } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Link, useLocation } from 'react-router-dom'
import { useCompetitiveRanking } from '../hooks/useCompetitiveRanking'
import { useCompetitiveRankingActivity } from '../hooks/useCompetitiveRankingActivity'
import { useDiets } from '../state/DietContext'

function WaterDrops() {
  const reducedMotion = useReducedMotion()
  const animate = reducedMotion ? { opacity: 0.85 } : { y: [-8, 7], opacity: [0, 1, 0] }
  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.9, repeat: Infinity, ease: 'easeInOut' as const }

  return <span className="competitive-water-drops" aria-hidden="true">
    <motion.span className="competitive-water-drop competitive-water-drop-one" animate={animate} transition={transition} />
    <motion.span className="competitive-water-drop competitive-water-drop-two" animate={animate} transition={{ ...transition, delay: 0.3 }} />
    <motion.span className="competitive-water-drop competitive-water-drop-three" animate={animate} transition={{ ...transition, delay: 0.6 }} />
  </span>
}

export function CompetitiveRankingWidget() {
  const { activeDiet } = useDiets()
  const location = useLocation()
  const { ranking, loading } = useCompetitiveRanking(0, 3)
  const { hasUnseenActivity, activitySourceType, acknowledge } = useCompetitiveRankingActivity()

  if (!activeDiet?.competitiveMode || location.pathname === '/ranking') return null
  const label = loading ? 'Abrir ranking competitivo. Carregando dados.' : ranking
    ? `Abrir ranking competitivo. ${ranking.currentUser.position}º lugar, ${ranking.currentUser.officialPoints} pontos${ranking.currentUser.pendingPoints ? ` e ${ranking.currentUser.pendingPoints} pontos pendentes` : ''}.`
    : 'Abrir ranking competitivo.'
  const showWaterDrops = hasUnseenActivity && activitySourceType === 'WATER_CHECK'
  return <Link to="/ranking" className={`competitive-widget${hasUnseenActivity ? ' reacting' : ''}`} aria-label={label} title={label} onClick={acknowledge}>
    {showWaterDrops && <WaterDrops />}
    <Trophy size={19} aria-hidden="true" />
  </Link>
}
