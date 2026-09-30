export const MOTION_DURATION = {
  instant: 100,
  fast: 150,
  interaction: 200,
  normal: 250,
  slow: 350,
  medium: 500,
  spin: 800,
  waterDrop: 900,
  celebration: 1000,
  shimmer: 1200,
  pulse: 1400,
} as const

export const MOTION_SCALE = {
  tap: 0.96,
  hover: 1.02,
} as const

export const MOTION_STAGGER = {
  fast: 0.04,
  normal: 0.06,
  waterDrop: 0.3,
} as const

export const MOTION_DELAY = {
  confetti: 0.035,
  celebrationDismiss: 800,
  rankingMovement: 500,
} as const

export const MOTION_SPRING = {
  soft: { type: 'spring' as const, stiffness: 420, damping: 30, mass: 0.7 },
  medium: { type: 'spring' as const, stiffness: 180, damping: 22, mass: 0.8 },
} as const

export const MOTION_OFFSET = 10

export const MOTION_TIMEOUT = {
  floatingFeedback: MOTION_DURATION.celebration,
  celebrationDismiss: MOTION_DURATION.celebration + MOTION_DELAY.celebrationDismiss,
  rankingMovement: MOTION_DURATION.celebration + MOTION_DELAY.rankingMovement,
} as const
