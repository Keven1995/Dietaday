import { AlertTriangle } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { MOTION_DURATION } from '../../constants/motion'
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference'

export function AnimatedError({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reducedMotion = useReducedMotionPreference()

  return (
    <motion.div
      className={`error-message animated-error ${className}`.trim()}
      role="alert"
      initial={!reducedMotion ? { opacity: 0, x: 0 } : false}
      animate={!reducedMotion ? { opacity: 1, x: [0, -4, 4, -2, 2, 0] } : { opacity: 1 }}
      transition={{ duration: MOTION_DURATION.normal / 1000, ease: 'easeOut' }}
    >
      <AlertTriangle size={17} aria-hidden="true" />
      <span>{children}</span>
    </motion.div>
  )
}
