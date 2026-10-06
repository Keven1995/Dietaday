import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useHalloween } from './hooks/useHalloween'
import { halloweenConfig } from './HalloweenConfig'

export function HalloweenMessage() {
  const { enabled, intensity, reducedMotion } = useHalloween()
  const eyesRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const eyes = eyesRef.current
    if (!enabled || reducedMotion || !eyes || !window.matchMedia('(pointer: fine)').matches) return

    let frame = 0
    const followPointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const bounds = eyes.getBoundingClientRect()
        const centerX = bounds.left + bounds.width / 2
        const centerY = bounds.top + bounds.height / 2
        const offsetX = Math.max(-4, Math.min(4, (event.clientX - centerX) / 30))
        const offsetY = Math.max(-3, Math.min(3, (event.clientY - centerY) / 30))
        eyes.style.setProperty('--pupil-x', `${offsetX}px`)
        eyes.style.setProperty('--pupil-y', `${offsetY}px`)
      })
    }

    window.addEventListener('pointermove', followPointer, { passive: true })
    return () => {
      window.removeEventListener('pointermove', followPointer)
      window.cancelAnimationFrame(frame)
    }
  }, [enabled, reducedMotion])

  if (!enabled) return null

  return <aside className={`halloween-message halloween-message-${intensity}`} role="note">
    <div><strong>🎃 Outubro Assustador</strong><span>Continue firme — um dia de cada vez.</span></div>
    {halloweenConfig.effects.eyes && <span className="halloween-eyes" ref={eyesRef} aria-hidden="true" style={{ '--pupil-x': '0px', '--pupil-y': '0px' } as CSSProperties}>
      <i><b /></i><i><b /></i>
    </span>}
  </aside>
}
