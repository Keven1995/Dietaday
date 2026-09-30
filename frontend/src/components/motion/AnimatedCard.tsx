import { motion, type HTMLMotionProps } from 'motion/react'
import { MOTION_DURATION, MOTION_OFFSET, MOTION_STAGGER } from '../../constants/motion'
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference'

export type AnimatedCardProps = HTMLMotionProps<'div'> & {
  delay?: number
  disableAnimation?: boolean
}

export function AnimatedCard({ delay = 0, disableAnimation = false, className = '', children, ...props }: AnimatedCardProps) {
  const reducedMotion = useReducedMotionPreference()
  const shouldAnimate = !disableAnimation && !reducedMotion

  return (
    <motion.div
      {...props}
      className={className}
      initial={shouldAnimate ? { opacity: 0, y: MOTION_OFFSET } : false}
      animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: MOTION_DURATION.normal / 1000, delay: delay * MOTION_STAGGER.normal, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
