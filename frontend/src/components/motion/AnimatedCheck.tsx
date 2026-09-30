import { AlertCircle, Check, LoaderCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { MOTION_DURATION } from '../../constants/motion'
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference'

export type AnimatedCheckStatus = 'idle' | 'loading' | 'success' | 'error'

export function AnimatedCheck({ status, label, className = '' }: { status: AnimatedCheckStatus; label?: string; className?: string }) {
  const reducedMotion = useReducedMotionPreference()
  if (status === 'idle') return null

  const Icon = status === 'loading' ? LoaderCircle : status === 'error' ? AlertCircle : Check
  const role = status === 'error' ? 'alert' : 'status'

  return (
    <motion.span
      className={`animated-check animated-check-${status} ${className}`.trim()}
      role={role}
      initial={!reducedMotion ? { opacity: 0, scale: 0.86 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: MOTION_DURATION.fast / 1000, ease: 'easeOut' }}
    >
      <Icon className={status === 'loading' ? 'spin' : undefined} size={18} aria-hidden="true" />
      {label && <span>{label}</span>}
    </motion.span>
  )
}
