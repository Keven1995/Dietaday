import { Check, LoaderCircle } from 'lucide-react'
import { motion, type HTMLMotionProps } from 'motion/react'
import type { ReactNode } from 'react'
import { MOTION_DURATION, MOTION_SCALE } from '../../constants/motion'
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference'

export type AnimatedButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  children?: ReactNode
  loading?: boolean
  success?: boolean
}

export function AnimatedButton({ loading = false, success = false, disabled = false, children, className = '', ...props }: AnimatedButtonProps) {
  const reducedMotion = useReducedMotionPreference()
  const isDisabled = disabled || loading

  return (
    <motion.button
      {...props}
      className={`button ${className}`.trim()}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      animate={success && !reducedMotion ? { scale: [1, 1.04, 1] } : undefined}
      whileHover={!isDisabled && !reducedMotion ? { y: -1, scale: MOTION_SCALE.hover } : undefined}
      whileTap={!isDisabled && !reducedMotion ? { scale: MOTION_SCALE.tap } : undefined}
      transition={{ duration: MOTION_DURATION.fast / 1000, ease: 'easeOut' }}
    >
      {loading && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
      {!loading && success && <Check size={18} aria-hidden="true" />}
      {children}
    </motion.button>
  )
}
