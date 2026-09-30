import { motion } from 'motion/react'
import { useId } from 'react'
import { MOTION_SPRING } from '../../constants/motion'
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference'
import { clampProgress } from '../../lib/motionRules'

export interface WaterBottleProps {
  current: number
  goal: number
}

export function WaterBottle({ current, goal }: WaterBottleProps) {
  const reducedMotion = useReducedMotionPreference()
  const id = useId().replaceAll(':', '')
  const clipId = `water-bottle-clip-${id}`
  const gradientId = `water-gradient-${id}`
  const percentage = goal > 0 ? clampProgress(Math.round(current * 100 / goal)) : 0
  const fillHeight = 312 * percentage / 100
  const fillY = 375 - fillHeight
  const transition = reducedMotion ? { duration: 0 } : MOTION_SPRING.medium

  return (
    <div className="water-bottle" aria-label={`Garrafa preenchida em ${percentage}%`} role="img">
      <svg viewBox="0 0 220 430" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <path d="M73 88h74l10 29v226c0 18-14 32-32 32H95c-18 0-32-14-32-32V117z" />
          </clipPath>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#80d8dd" />
            <stop offset="1" stopColor="#278ca2" />
          </linearGradient>
        </defs>
        <path className="bottle-shadow" d="M73 88h74l10 29v226c0 18-14 32-32 32H95c-18 0-32-14-32-32V117z" />
        <path className="bottle-body" d="M73 88h74l10 29v226c0 18-14 32-32 32H95c-18 0-32-14-32-32V117z" />
        <g clipPath={`url(#${clipId})`}>
          <motion.rect
            className="bottle-water"
            x="55"
            width="110"
            fill={`url(#${gradientId})`}
            initial={false}
            animate={{ y: fillY, height: fillHeight + 20 }}
            transition={transition}
          />
          {percentage > 0 && <motion.path
            className="bottle-wave"
            d="M48 0 Q72 -10 96 0 T144 0 T192 0 V25 H48Z"
            initial={false}
            animate={{ y: fillY - 9 }}
            transition={transition}
          />}
        </g>
        <path className="bottle-highlight" d="M80 133v171c0 10 4 18 10 22" />
        <path className="bottle-neck" d="M87 87V58h46v29" />
        <path className="bottle-cap" d="M84 56h52v-11c0-5-4-9-9-9H93c-5 0-9 4-9 9z" />
        <path className="bottle-label" d="M64 220h92v65H64z" />
        <text x="110" y="248" textAnchor="middle">ÁGUA</text>
        <text x="110" y="267" textAnchor="middle">{percentage}%</text>
      </svg>
    </div>
  )
}
