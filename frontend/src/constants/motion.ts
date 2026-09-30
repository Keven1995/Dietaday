export const MOTION_DURATION = {
  instant: 100,
  fast: 150,
  normal: 250,
  slow: 350,
  celebration: 1000,
} as const

export const MOTION_SCALE = {
  tap: 0.96,
  hover: 1.02,
} as const

export const MOTION_STAGGER = {
  fast: 0.04,
  normal: 0.06,
} as const

export const MOTION_SPRING = {
  soft: { type: 'spring' as const, stiffness: 420, damping: 30, mass: 0.7 },
  medium: { type: 'spring' as const, stiffness: 180, damping: 22, mass: 0.8 },
} as const

export const MOTION_OFFSET = 10
