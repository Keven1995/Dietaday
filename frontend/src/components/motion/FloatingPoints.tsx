import { motion } from 'motion/react'
import { useEffect, useEffectEvent } from 'react'
import { MOTION_DURATION, MOTION_TIMEOUT } from '../../constants/motion'
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference'

type FloatingPointsProps = {
  points: number
  onComplete: () => void
}

export function FloatingPoints({ points, onComplete }: FloatingPointsProps) {
  const reducedMotion = useReducedMotionPreference()
  const complete = useEffectEvent(onComplete)

  useEffect(() => {
    const timer = window.setTimeout(complete, MOTION_TIMEOUT.floatingFeedback)
    return () => window.clearTimeout(timer)
  }, [])

  return <motion.div
    className="floating-points"
    role="status"
    aria-live="polite"
    initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.88 }}
    animate={{ opacity: 1, y: reducedMotion ? 0 : -14, scale: 1 }}
    transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.normal / 1000 }}
  >
    +{points} pontos
  </motion.div>
}
