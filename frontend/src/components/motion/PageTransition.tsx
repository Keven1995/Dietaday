import { AnimatePresence, motion } from 'motion/react'
import { Outlet, useLocation } from 'react-router-dom'
import { MOTION_DURATION, MOTION_OFFSET } from '../../constants/motion'
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference'

export function PageTransition() {
  const location = useLocation()
  const reducedMotion = useReducedMotionPreference()

  return <AnimatePresence initial={false} mode="sync">
    <motion.div
      key={location.pathname}
      className="page-transition"
      initial={reducedMotion ? false : { opacity: 0, y: MOTION_OFFSET }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -MOTION_OFFSET }}
      transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.normal / 1000, ease: 'easeOut' }}
    >
      <Outlet />
    </motion.div>
  </AnimatePresence>
}
