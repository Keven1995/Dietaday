import { lazy, Suspense, useEffect, useEffectEvent } from 'react'
import { motion } from 'motion/react'
import { MOTION_DURATION, MOTION_TIMEOUT } from '../constants/motion'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'
import type { ConfettiVariant } from '../lib/confetti'
import type { ActiveCelebration } from '../state/CelebrationContext'
import { useHalloween } from '../seasonal/halloween'
import { halloweenConfig } from '../seasonal/halloween/HalloweenConfig'

const Confetti = lazy(() => import('./motion/Confetti'))

const MESSAGES = {
  DAILY_GOAL_COMPLETED: 'Meta diária concluída!',
  HYDRATION_GOAL_COMPLETED: 'Meta de hidratação concluída!',
  STREAK_INCREMENTED: 'Sua constância aumentou!',
  RANKING_FINALIZED: 'Resultado final do ranking!',
  MEAL_REGISTERED: 'Refeição registrada com sucesso!',
} as const

const CONFETTI_VARIANTS: Record<ActiveCelebration['type'], ConfettiVariant> = {
  DAILY_GOAL_COMPLETED: 'daily-goal',
  HYDRATION_GOAL_COMPLETED: 'hydration-goal',
  STREAK_INCREMENTED: 'streak',
  RANKING_FINALIZED: 'ranking-finalized',
  MEAL_REGISTERED: 'daily-goal',
}

const ICONS = {
  DAILY_GOAL_COMPLETED: '✨',
  HYDRATION_GOAL_COMPLETED: '💧',
  STREAK_INCREMENTED: '🔥',
  RANKING_FINALIZED: '🏆',
  MEAL_REGISTERED: '✅',
} as const

type CelebrationOverlayProps = {
  celebration: ActiveCelebration | null
  onDismiss: () => void
}

export function CelebrationOverlay({ celebration, onDismiss }: CelebrationOverlayProps) {
  const reducedMotion = useReducedMotionPreference()
  const { isHalloween, intensity } = useHalloween()
  const dismiss = useEffectEvent(onDismiss)

  useEffect(() => {
    if (!celebration) return
    const timer = window.setTimeout(dismiss, MOTION_TIMEOUT.celebrationDismiss)
    return () => window.clearTimeout(timer)
  }, [celebration?.key])

  if (!celebration) return null
  const halloweenMessages: Partial<Record<ActiveCelebration['type'], string>> = intensity === 'full' && halloweenConfig.effects.celebration
    ? {
      DAILY_GOAL_COMPLETED: 'Você sobreviveu à dieta hoje!',
      HYDRATION_GOAL_COMPLETED: 'Hidratação registrada!',
      STREAK_INCREMENTED: 'Sua constância está assombrando!',
      RANKING_FINALIZED: 'Resultado final do ranking!',
      MEAL_REGISTERED: celebration.pointsEarned
        ? `+${celebration.pointsEarned} ponto${celebration.pointsEarned === 1 ? '' : 's'} assombrado${celebration.pointsEarned === 1 ? '' : 's'}`
        : 'Refeição registrada!',
    }
    : {}
  const halloweenIcons: Partial<Record<ActiveCelebration['type'], string>> = {
    DAILY_GOAL_COMPLETED: '👻',
    HYDRATION_GOAL_COMPLETED: '🎃',
    STREAK_INCREMENTED: '🎃',
    RANKING_FINALIZED: '🦇',
    MEAL_REGISTERED: '🎃',
  }
  return <div className={`celebration-overlay celebration-${celebration.type.toLowerCase()}`} role="status" aria-live="polite">
    {!reducedMotion && <Suspense fallback={null}><Confetti variant={CONFETTI_VARIANTS[celebration.type]} /></Suspense>}
    <motion.div className="celebration-message" initial={reducedMotion ? false : { opacity: 0, y: 10, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.normal / 1000 }}>
      <span aria-hidden="true">{isHalloween && intensity === 'full' && halloweenConfig.effects.celebration ? halloweenIcons[celebration.type] : ICONS[celebration.type]}</span>{isHalloween ? halloweenMessages[celebration.type] ?? MESSAGES[celebration.type] : MESSAGES[celebration.type]}
      {celebration.type === 'RANKING_FINALIZED' && <small>pódio final</small>}
    </motion.div>
  </div>
}
