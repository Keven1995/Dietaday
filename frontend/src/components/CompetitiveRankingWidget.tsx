import { Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import { Link, useLocation } from 'react-router-dom'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'
import { useCompetitiveRanking } from '../hooks/useCompetitiveRanking'
import { useCompetitiveRankingActivity } from '../hooks/useCompetitiveRankingActivity'
import { useCompetitiveMode } from '../hooks/useCompetitiveMode'
import { MOTION_DURATION, MOTION_STAGGER } from '../constants/motion'

function WaterDrops() {
  const reducedMotion = useReducedMotionPreference()
  const animate = reducedMotion ? { opacity: 0.85 } : { y: [-8, 7], opacity: [0, 1, 0] }
  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: MOTION_DURATION.waterDrop / 1000, ease: 'easeInOut' as const }

  return <span className="competitive-water-drops" aria-hidden="true">
    <motion.span className="competitive-water-drop competitive-water-drop-one" animate={animate} transition={transition} />
    <motion.span className="competitive-water-drop competitive-water-drop-two" animate={animate} transition={{ ...transition, delay: MOTION_STAGGER.waterDrop }} />
    <motion.span className="competitive-water-drop competitive-water-drop-three" animate={animate} transition={{ ...transition, delay: MOTION_STAGGER.waterDrop * 2 }} />
  </span>
}

export function CompetitiveRankingWidget() {
  const { enabled } = useCompetitiveMode()
  const location = useLocation()
  const reducedMotion = useReducedMotionPreference()
  const { ranking, loading } = useCompetitiveRanking(0, 3)
  const { hasUnseenActivity, activitySourceType, activityEventId, acknowledge } = useCompetitiveRankingActivity()

  if (!enabled || location.pathname === '/ranking') return null
  const label = loading ? 'Abrir ranking competitivo. Carregando dados.' : ranking
    ? `Abrir ranking competitivo. ${ranking.currentUser.position}º lugar, ${ranking.currentUser.officialPoints} pontos${ranking.currentUser.pendingPoints ? ` e ${ranking.currentUser.pendingPoints} pontos pendentes` : ''}.`
    : 'Abrir ranking competitivo.'
  const showWaterDrops = hasUnseenActivity && activitySourceType === 'WATER_CHECK'
  return <Link to="/ranking" className={`competitive-widget${hasUnseenActivity ? ' reacting' : ''}`} aria-label={label} title={label} onClick={acknowledge}>
    {showWaterDrops && <WaterDrops key={activityEventId ?? 'water-check'} />}
    <motion.span
      key={activityEventId ?? 'ranking-idle'}
      className="competitive-widget-icon"
      aria-hidden="true"
      initial={hasUnseenActivity && !reducedMotion ? { scale: 0.78, opacity: 0.55 } : false}
      animate={hasUnseenActivity && !reducedMotion ? { scale: [0.78, 1.12, 1], opacity: [0.55, 1, 1] } : { scale: 1, opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.interaction / 1000, ease: 'easeOut' }}
    >
      <Trophy size={19} />
    </motion.span>
  </Link>
}
