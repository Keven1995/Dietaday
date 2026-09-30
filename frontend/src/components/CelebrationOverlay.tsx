import { lazy, Suspense, useEffect, useEffectEvent } from 'react'
import { motion } from 'motion/react'
import { MOTION_DURATION } from '../constants/motion'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'
import type { ActiveCelebration } from '../state/CelebrationContext'

const Confetti = lazy(() => import('./motion/Confetti'))

const MESSAGES = {
  DAILY_GOAL_COMPLETED: 'Meta diária concluída!',
  HYDRATION_GOAL_COMPLETED: 'Meta de hidratação concluída!',
  STREAK_INCREMENTED: 'Sua constância aumentou!',
  RANKING_FINALIZED: 'Resultado final do ranking!',
} as const

type CelebrationOverlayProps = {
  celebration: ActiveCelebration | null
  onDismiss: () => void
}

export function CelebrationOverlay({ celebration, onDismiss }: CelebrationOverlayProps) {
  const reducedMotion = useReducedMotionPreference()
  const dismiss = useEffectEvent(onDismiss)

  useEffect(() => {
    if (!celebration) return
    const timer = window.setTimeout(dismiss, MOTION_DURATION.celebration + 800)
    return () => window.clearTimeout(timer)
  }, [celebration?.key])

  if (!celebration) return null
  return <div className="celebration-overlay" role="status" aria-live="polite">
    {!reducedMotion && <Suspense fallback={null}><Confetti /></Suspense>}
    <motion.div className="celebration-message" initial={reducedMotion ? false : { opacity: 0, y: 10, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.normal / 1000 }}>
      <span aria-hidden="true">✨</span>{MESSAGES[celebration.type]}
    </motion.div>
  </div>
}
