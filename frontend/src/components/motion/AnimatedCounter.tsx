import { useEffect, useRef, useState } from 'react'
import { MOTION_DURATION } from '../../constants/motion'
import { useReducedMotionPreference } from '../../hooks/useReducedMotionPreference'

export interface AnimatedCounterProps {
  value: number
  previousValue?: number
  duration?: number
  suffix?: string
  prefix?: string
  className?: string
}

function formatValue(value: number) {
  return new Intl.NumberFormat('pt-BR').format(Math.round(value))
}

export function AnimatedCounter({ value, previousValue, duration = MOTION_DURATION.normal, suffix = '', prefix = '', className = '' }: AnimatedCounterProps) {
  const reducedMotion = useReducedMotionPreference()
  const initialValue = previousValue ?? value
  const [displayValue, setDisplayValue] = useState(initialValue)
  const previousValueRef = useRef(previousValue ?? value)

  useEffect(() => {
    const from = previousValueRef.current
    previousValueRef.current = value
    if (reducedMotion || from === value) {
      setDisplayValue(value)
      return
    }

    let frame = 0
    const startedAt = performance.now()
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - (1 - progress) ** 3
      setDisplayValue(from + (value - from) * eased)
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [duration, reducedMotion, value])

  return <span className={className}>{prefix}{formatValue(displayValue)}{suffix}</span>
}
