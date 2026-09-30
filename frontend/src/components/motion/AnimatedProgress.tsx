import { motion } from 'motion/react'
import { MOTION_DURATION } from '../../constants/motion'
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference'
import { clampProgress } from '../../lib/motionRules'

export function AnimatedProgress({ value, max = 100, label, className = '' }: { value: number; max?: number; label: string; className?: string }) {
  const reducedMotion = useReducedMotionPreference()
  const safeMax = Math.max(1, max)
  const safeValue = clampProgress(value, safeMax)
  const percentage = safeValue / safeMax * 100

  return (
    <div
      className={`animated-progress ${className}`.trim()}
      role="progressbar"
      aria-label={label}
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={safeMax}
    >
      <motion.span
        initial={false}
        animate={{ width: `${percentage}%` }}
        transition={reducedMotion ? { duration: 0 } : { duration: MOTION_DURATION.slow / 1000, ease: 'easeOut' }}
      />
    </div>
  )
}
