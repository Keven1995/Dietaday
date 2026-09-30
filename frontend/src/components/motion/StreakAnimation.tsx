import { motion } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { MOTION_DURATION } from '../../constants/motion'
import { useCelebration } from '../../state/CelebrationContext'
import { AnimatedCounter } from './AnimatedCounter'
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference'

type StreakAnimationProps = {
  days: number
  dietId: string
  eventDate: string
}

export function StreakAnimation({ days, dietId, eventDate }: StreakAnimationProps) {
  const reducedMotion = useReducedMotionPreference()
  const { celebrate } = useCelebration()
  const celebrateEvent = useEffectEvent(celebrate)
  const previousDays = useRef<{ dietId: string; days: number } | null>(null)
  const [bumping, setBumping] = useState(false)

  useEffect(() => {
    const previous = previousDays.current
    previousDays.current = { dietId, days }
    if (previous === null || previous.dietId !== dietId || days <= previous.days) return
    setBumping(true)
    celebrateEvent({ type: 'STREAK_INCREMENTED', id: `${dietId}:${eventDate}:${days}` })
    const timer = window.setTimeout(() => setBumping(false), MOTION_DURATION.celebration)
    return () => window.clearTimeout(timer)
  }, [days, dietId, eventDate])

  return <motion.div className="streak-card card" animate={reducedMotion || !bumping ? { scale: 1 } : { scale: [1, 1.08, 1] }} transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.celebration / 1000 }}>
    <span className="streak-flame" aria-hidden="true">🔥</span>
    <div><span>CONSTÂNCIA</span><strong><AnimatedCounter value={days} /> {days === 1 ? 'dia' : 'dias'}</strong><small>{days ? 'Você está mantendo o ritmo.' : 'Complete a meta diária para começar.'}</small></div>
  </motion.div>
}
