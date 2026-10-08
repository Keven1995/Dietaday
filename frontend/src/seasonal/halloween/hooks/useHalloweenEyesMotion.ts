import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export type EyesMotionStatus =
  | 'inactive'
  | 'unsupported'
  | 'permission-required'
  | 'active'
  | 'denied'

type UseHalloweenEyesMotionOptions = {
  enabled: boolean
  reducedMotion: boolean
  eyesRef: RefObject<HTMLSpanElement | null>
  cardRef: RefObject<HTMLElement | null>
}

type UseHalloweenEyesMotionResult = {
  status: EyesMotionStatus
  requestPermission: () => Promise<void>
}

type DeviceOrientationEventConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

type OrientationWindow = Window & { orientation?: number }

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const angularDelta = (value: number, baseline: number) => {
  const delta = value - baseline
  return ((delta + 180) % 360 + 360) % 360 - 180
}

function getScreenAngle() {
  const screenAngle = window.screen.orientation?.angle
  if (typeof screenAngle === 'number') return ((screenAngle % 360) + 360) % 360

  const legacyAngle = (window as OrientationWindow).orientation
  return typeof legacyAngle === 'number' ? ((legacyAngle % 360) + 360) % 360 : 0
}

function rotateForScreen(deltaGamma: number, deltaBeta: number) {
  switch (getScreenAngle()) {
    case 90:
      return { x: deltaBeta, y: -deltaGamma }
    case 180:
      return { x: -deltaGamma, y: -deltaBeta }
    case 270:
      return { x: -deltaBeta, y: deltaGamma }
    default:
      return { x: deltaGamma, y: deltaBeta }
  }
}

function readDeviceOrientationConstructor() {
  return window.DeviceOrientationEvent as DeviceOrientationEventConstructor | undefined
}

export function useHalloweenEyesMotion({
  enabled,
  reducedMotion,
  eyesRef,
  cardRef,
}: UseHalloweenEyesMotionOptions): UseHalloweenEyesMotionResult {
  const [status, setStatus] = useState<EyesMotionStatus>('inactive')
  const statusRef = useRef<EyesMotionStatus>('inactive')
  const permissionPendingRef = useRef(false)

  const updateStatus = useCallback((nextStatus: EyesMotionStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const requestPermission = useCallback(async () => {
    if (!enabled || reducedMotion || statusRef.current !== 'permission-required' || permissionPendingRef.current) return

    const orientationConstructor = readDeviceOrientationConstructor()
    const request = orientationConstructor?.requestPermission
    if (!request) {
      updateStatus('unsupported')
      return
    }

    permissionPendingRef.current = true
    try {
      // Invoke synchronously before the first await so the browser sees the user gesture.
      const permissionPromise = request.call(orientationConstructor)
      const permission = await permissionPromise
      updateStatus(permission === 'granted' ? 'active' : 'denied')
    } catch {
      updateStatus('denied')
    } finally {
      permissionPendingRef.current = false
    }
  }, [enabled, reducedMotion, updateStatus])

  useEffect(() => {
    const eyes = eyesRef.current
    const card = cardRef.current
    if (!enabled || reducedMotion || !eyes || !card) {
      eyes?.style.setProperty('--pupil-x', '0px')
      eyes?.style.setProperty('--pupil-y', '0px')
      updateStatus('inactive')
      return
    }

    let frame: number | null = null
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let baseline: { gamma: number; beta: number } | null = null
    let hasSensorReading = false
    let isHidden = document.hidden
    const orientationConstructor = readDeviceOrientationConstructor()
    const hasFinePointer = window.matchMedia?.('(pointer: fine)').matches ?? false

    const writePosition = () => {
      eyes.style.setProperty('--pupil-x', `${currentX.toFixed(2)}px`)
      eyes.style.setProperty('--pupil-y', `${currentY.toFixed(2)}px`)
    }

    const stopFrame = () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      frame = null
    }

    const animate = () => {
      frame = null
      currentX += (targetX - currentX) * 0.18
      currentY += (targetY - currentY) * 0.18
      if (Math.abs(targetX - currentX) < 0.05) currentX = targetX
      if (Math.abs(targetY - currentY) < 0.05) currentY = targetY
      writePosition()

      if (Math.abs(targetX - currentX) >= 0.05 || Math.abs(targetY - currentY) >= 0.05) {
        frame = window.requestAnimationFrame(animate)
      }
    }

    const setTarget = (x: number, y: number) => {
      targetX = clamp(x, -4, 4)
      targetY = clamp(y, -3, 3)
      if (!isHidden && frame === null) frame = window.requestAnimationFrame(animate)
    }

    const setTargetFromPointer = (clientX: number, clientY: number) => {
      const bounds = eyes.getBoundingClientRect()
      const centerX = bounds.left + bounds.width / 2
      const centerY = bounds.top + bounds.height / 2
      setTarget((clientX - centerX) / 30, (clientY - centerY) / 30)
    }

    const handleMouseMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      setTargetFromPointer(event.clientX, event.clientY)
    }

    const handleCardPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || hasSensorReading) return
      setTargetFromPointer(event.clientX, event.clientY)
    }

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || hasSensorReading) return
      setTarget(0, 0)
    }

    const centerEyes = () => {
      stopFrame()
      targetX = 0
      targetY = 0
      currentX = 0
      currentY = 0
      writePosition()
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (isHidden) return
      const { gamma, beta } = event
      if (typeof gamma !== 'number' || !Number.isFinite(gamma) || typeof beta !== 'number' || !Number.isFinite(beta)) {
        hasSensorReading = false
        return
      }

      if (!baseline) {
        baseline = { gamma, beta }
        hasSensorReading = true
        return
      }

      hasSensorReading = true
      const relative = rotateForScreen(angularDelta(gamma, baseline.gamma), angularDelta(beta, baseline.beta))
      setTarget(relative.x * 0.35, relative.y * 0.2)
    }

    const recalibrate = () => {
      baseline = null
      hasSensorReading = false
      setTarget(0, 0)
    }

    const handleVisibilityChange = () => {
      isHidden = document.hidden
      if (isHidden) {
        centerEyes()
      } else {
        recalibrate()
      }
    }

    const handleScreenOrientationChange = () => recalibrate()
    const screenOrientation = window.screen.orientation
    const canUseOrientation = !hasFinePointer && window.isSecureContext !== false && Boolean(orientationConstructor)
    const needsPermission = Boolean(orientationConstructor?.requestPermission)

    eyes.style.setProperty('--pupil-x', '0px')
    eyes.style.setProperty('--pupil-y', '0px')
    if (hasFinePointer) {
      updateStatus('inactive')
    } else if (!canUseOrientation) {
      updateStatus('unsupported')
    } else if (needsPermission) {
      if (status !== 'active' && status !== 'denied') updateStatus('permission-required')
    } else {
      updateStatus('active')
    }

    if (hasFinePointer) window.addEventListener('pointermove', handleMouseMove, { passive: true })
    card.addEventListener('pointermove', handleCardPointerMove, { passive: true })
    card.addEventListener('pointerup', handlePointerEnd, { passive: true })
    card.addEventListener('pointercancel', handlePointerEnd, { passive: true })
    card.addEventListener('pointerleave', handlePointerEnd, { passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const attachOrientationListener = () => {
      if (canUseOrientation && (!needsPermission || status === 'active')) {
        window.addEventListener('deviceorientation', handleOrientation, { passive: true })
      }
    }
    attachOrientationListener()

    card.addEventListener('pointerdown', handleCardPointerMove, { passive: true })
    if (screenOrientation?.addEventListener) {
      screenOrientation.addEventListener('change', handleScreenOrientationChange)
    }
    window.addEventListener('orientationchange', handleScreenOrientationChange, { passive: true })

    return () => {
      if (hasFinePointer) window.removeEventListener('pointermove', handleMouseMove)
      card.removeEventListener('pointermove', handleCardPointerMove)
      card.removeEventListener('pointerdown', handleCardPointerMove)
      card.removeEventListener('pointerup', handlePointerEnd)
      card.removeEventListener('pointercancel', handlePointerEnd)
      card.removeEventListener('pointerleave', handlePointerEnd)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('deviceorientation', handleOrientation)
      window.removeEventListener('orientationchange', handleScreenOrientationChange)
      screenOrientation?.removeEventListener?.('change', handleScreenOrientationChange)
      stopFrame()
      eyes.style.setProperty('--pupil-x', '0px')
      eyes.style.setProperty('--pupil-y', '0px')
    }
  }, [enabled, reducedMotion, eyesRef, cardRef, status, updateStatus])

  return { status, requestPermission }
}
