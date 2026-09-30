import { ArrowDown, ArrowUp } from 'lucide-react'
import { motion } from 'motion/react'
import { MOTION_SPRING, MOTION_TIMEOUT } from '../../constants/motion'
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference'
import type { RankingMovementDirection } from '../../lib/rankingMovement'
import { useEffect, useEffectEvent } from 'react'

type RankingMovementProps = {
  direction: RankingMovementDirection | null
  position: number
  onComplete: () => void
}

export function RankingMovement({ direction, position, onComplete }: RankingMovementProps) {
  const reducedMotion = useReducedMotionPreference()
  const complete = useEffectEvent(onComplete)

  useEffect(() => {
    if (!direction) return
    const timer = window.setTimeout(complete, MOTION_TIMEOUT.rankingMovement)
    return () => window.clearTimeout(timer)
  }, [direction])

  if (!direction) return null
  const movedUp = direction === 'up'
  const Icon = movedUp ? ArrowUp : ArrowDown
  return <motion.div
    className={`ranking-movement ${movedUp ? 'is-up' : 'is-down'}`}
    role="status"
    aria-live="polite"
    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={reducedMotion ? { duration: 0 } : MOTION_SPRING.soft}
  >
    <Icon size={16} aria-hidden="true" />
    Você {movedUp ? 'subiu' : 'desceu'} para o {position}º lugar
  </motion.div>
}
