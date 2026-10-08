import { useRef } from 'react'
import type { CSSProperties } from 'react'
import { useHalloween } from './hooks/useHalloween'
import { useHalloweenEyesMotion } from './hooks/useHalloweenEyesMotion'
import { halloweenConfig } from './HalloweenConfig'

export function HalloweenMessage() {
  const { enabled, intensity, reducedMotion } = useHalloween()
  const eyesRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const eyesEnabled = enabled && halloweenConfig.effects.eyes
  const { status, requestPermission } = useHalloweenEyesMotion({
    enabled: eyesEnabled,
    reducedMotion,
    eyesRef,
    cardRef,
  })

  if (!enabled) return null

  return <aside ref={cardRef} className={`halloween-message halloween-message-${intensity}`} role="note">
    <div><strong>🎃 Outubro Assustador</strong><span>Continue firme — um dia de cada vez.</span></div>
    {eyesEnabled && <span className="halloween-eyes" ref={eyesRef} aria-hidden="true" style={{ '--pupil-x': '0px', '--pupil-y': '0px' } as CSSProperties}>
      <i><b /></i><i><b /></i>
    </span>}
    {eyesEnabled && status === 'permission-required' && <button
      className="halloween-eyes-permission"
      type="button"
      onClick={() => void requestPermission()}
    >Ativar olhos interativos</button>}
  </aside>
}
