import { motion } from 'motion/react'
import { useEffect, useEffectEvent } from 'react'
import { MOTION_DURATION, MOTION_TIMEOUT } from '../../constants/motion'
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference'

type FloatingEmojiProps = {
  emoji: string
  onComplete: () => void
}

export function FloatingEmoji({ emoji, onComplete }: FloatingEmojiProps) {
  const reducedMotion = useReducedMotionPreference()
  const complete = useEffectEvent(onComplete)

  useEffect(() => {
    const timer = window.setTimeout(complete, MOTION_TIMEOUT.floatingFeedback)
    return () => window.clearTimeout(timer)
  }, [])

  return <motion.span
    className="floating-emoji"
    role="status"
    aria-live="polite"
    aria-label={`Reação ${emoji} enviada`}
    initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.75 }}
    animate={{ opacity: 1, y: reducedMotion ? 0 : -34, scale: 1 }}
    transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.celebration / 1000, ease: 'easeOut' }}
  >
    {emoji}
  </motion.span>
}
