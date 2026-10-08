// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { HalloweenMessage } from '../HalloweenMessage'
import { useHalloweenEyesMotion } from './useHalloweenEyesMotion'

vi.mock('../hooks/useHalloween', () => ({
  useHalloween: () => ({ enabled: true, intensity: 'full', reducedMotion: false }),
}))

type HarnessProps = { enabled?: boolean; reducedMotion?: boolean }

function MotionHarness({ enabled = true, reducedMotion = false }: HarnessProps) {
  const eyesRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const { status, requestPermission } = useHalloweenEyesMotion({ enabled, reducedMotion, eyesRef, cardRef })

  return <aside data-testid="card" data-status={status} ref={cardRef}>
    <span data-testid="eyes" ref={eyesRef} />
    <button type="button" onClick={() => void requestPermission()}>request</button>
  </aside>
}

let frameId = 0
let frames: Map<number, FrameRequestCallback>
let cancelFrame: ReturnType<typeof vi.fn>

function configureEnvironment({ finePointer = false, orientation = true, permission }: {
  finePointer?: boolean
  orientation?: boolean
  permission?: () => Promise<'granted' | 'denied'>
} = {}) {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  Object.defineProperty(window.screen, 'orientation', {
    configurable: true,
    value: { angle: 0, addEventListener: vi.fn(), removeEventListener: vi.fn() },
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((media: string) => ({
      matches: media === '(pointer: fine)' && finePointer,
      media,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  if (orientation) {
    const DeviceOrientationMock = class {}
    if (permission) Object.defineProperty(DeviceOrientationMock, 'requestPermission', { value: permission })
    Object.defineProperty(window, 'DeviceOrientationEvent', { configurable: true, value: DeviceOrientationMock })
  } else {
    Reflect.deleteProperty(window, 'DeviceOrientationEvent')
  }
}

function mockEyesBounds() {
  const eyes = screen.getByTestId('eyes')
  vi.spyOn(eyes, 'getBoundingClientRect').mockReturnValue({
    x: 40, y: 50, left: 40, top: 50, right: 80, bottom: 73, width: 40, height: 23,
    toJSON: () => ({}),
  })
  return eyes
}

function dispatchPointer(target: EventTarget, type: string, pointerType: string, clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true })
  Object.defineProperties(event, {
    pointerType: { value: pointerType },
    clientX: { value: clientX },
    clientY: { value: clientY },
  })
  act(() => target.dispatchEvent(event))
}

function dispatchOrientation(gamma: number | null, beta: number | null) {
  const event = new Event('deviceorientation')
  Object.defineProperties(event, { gamma: { value: gamma }, beta: { value: beta } })
  act(() => window.dispatchEvent(event))
}

function flushFrames() {
  let iterations = 0
  while (frames.size > 0 && iterations < 120) {
    const [id, callback] = frames.entries().next().value as [number, FrameRequestCallback]
    frames.delete(id)
    act(() => callback(0))
    iterations += 1
  }
  expect(iterations).toBeLessThan(120)
}

beforeEach(() => {
  localStorage.clear()
  frames = new Map()
  frameId = 0
  cancelFrame = vi.fn((id: number) => { frames.delete(id) })
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: vi.fn((callback: FrameRequestCallback) => {
      frameId += 1
      frames.set(frameId, callback)
      return frameId
    }),
  })
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: cancelFrame })
  configureEnvironment()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('useHalloweenEyesMotion', () => {
  it('keeps desktop mouse tracking within the existing ±4/±3px limits', () => {
    configureEnvironment({ finePointer: true })
    render(<MotionHarness />)
    const eyes = mockEyesBounds()

    dispatchPointer(window, 'pointermove', 'mouse', 600, 500)
    flushFrames()

    expect(eyes.style.getPropertyValue('--pupil-x')).toBe('4.00px')
    expect(eyes.style.getPropertyValue('--pupil-y')).toBe('3.00px')
  })

  it('calibrates the first valid sensor reading and ignores null values', () => {
    render(<MotionHarness />)
    const eyes = mockEyesBounds()

    dispatchOrientation(null, 10)
    expect(eyes.style.getPropertyValue('--pupil-x')).toBe('0px')
    dispatchOrientation(0, 0)
    dispatchOrientation(10, 10)
    flushFrames()

    expect(eyes.style.getPropertyValue('--pupil-x')).toBe('3.50px')
    expect(eyes.style.getPropertyValue('--pupil-y')).toBe('2.00px')
  })

  it('rotates sensor axes in landscape orientation', () => {
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: { angle: 90, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    })
    render(<MotionHarness />)
    const eyes = mockEyesBounds()

    dispatchOrientation(0, 0)
    dispatchOrientation(10, 10)
    flushFrames()

    expect(eyes.style.getPropertyValue('--pupil-x')).toBe('3.50px')
    expect(eyes.style.getPropertyValue('--pupil-y')).toBe('-2.00px')
  })

  it('uses touch on the card when orientation is unavailable', () => {
    configureEnvironment({ orientation: false })
    render(<MotionHarness />)
    const eyes = mockEyesBounds()

    expect(screen.getByTestId('card').getAttribute('data-status')).toBe('unsupported')
    dispatchPointer(screen.getByTestId('card'), 'pointerdown', 'touch', -500, -500)
    flushFrames()

    expect(eyes.style.getPropertyValue('--pupil-x')).toBe('-4.00px')
    expect(eyes.style.getPropertyValue('--pupil-y')).toBe('-3.00px')
  })

  it('requests permission only on demand and falls back to touch when denied', async () => {
    const requestPermission = vi.fn().mockResolvedValue('denied' as const)
    configureEnvironment({ permission: requestPermission })
    render(<MotionHarness />)
    const eyes = mockEyesBounds()

    expect(screen.getByTestId('card').getAttribute('data-status')).toBe('permission-required')
    expect(requestPermission).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'request' })) })
    expect(screen.getByTestId('card').getAttribute('data-status')).toBe('denied')
    expect(requestPermission).toHaveBeenCalledTimes(1)

    dispatchPointer(screen.getByTestId('card'), 'pointermove', 'touch', 600, 500)
    flushFrames()
    expect(eyes.style.getPropertyValue('--pupil-x')).toBe('4.00px')
  })

  it('remembers a granted sensor permission across hook remounts', async () => {
    const firstPermissionRequest = vi.fn().mockResolvedValue('granted' as const)
    configureEnvironment({ permission: firstPermissionRequest })
    const firstMount = render(<MotionHarness />)
    expect(screen.getByTestId('card').getAttribute('data-status')).toBe('permission-required')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'request' })) })
    expect(screen.getByTestId('card').getAttribute('data-status')).toBe('active')
    expect(localStorage.getItem('Dietaday_halloween_eyes_orientation_permission_v1')).toBe('granted')
    firstMount.unmount()

    const nextPermissionRequest = vi.fn().mockResolvedValue('granted' as const)
    configureEnvironment({ permission: nextPermissionRequest })
    render(<MotionHarness />)
    expect(screen.getByTestId('card').getAttribute('data-status')).toBe('active')
    expect(nextPermissionRequest).not.toHaveBeenCalled()
  })

  it('remembers denial without repeating the request and keeps touch movement active', async () => {
    const firstPermissionRequest = vi.fn().mockResolvedValue('denied' as const)
    configureEnvironment({ permission: firstPermissionRequest })
    const firstMount = render(<MotionHarness />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'request' })) })
    expect(localStorage.getItem('Dietaday_halloween_eyes_orientation_permission_v1')).toBe('denied')
    firstMount.unmount()

    const nextPermissionRequest = vi.fn().mockResolvedValue('granted' as const)
    configureEnvironment({ permission: nextPermissionRequest })
    render(<MotionHarness />)
    const eyes = mockEyesBounds()
    expect(screen.getByTestId('card').getAttribute('data-status')).toBe('denied')
    expect(nextPermissionRequest).not.toHaveBeenCalled()

    dispatchPointer(screen.getByTestId('card'), 'pointermove', 'touch', 600, 500)
    flushFrames()
    expect(eyes.style.getPropertyValue('--pupil-x')).toBe('4.00px')
    expect(eyes.style.getPropertyValue('--pupil-y')).toBe('3.00px')
  })

  it('shows the permission control only when the browser explicitly requires it', () => {
    configureEnvironment({ permission: vi.fn().mockResolvedValue('granted' as const) })
    const permissionRequiredView = render(<HalloweenMessage />)
    const button = screen.getByRole('button', { name: 'Ativar olhos interativos' })
    expect(button).toBeTruthy()
    expect(screen.getByText('🎃 Outubro Assustador').closest('aside')).toBeTruthy()
    expect(screen.getByText('🎃 Outubro Assustador').closest('aside')?.querySelector('.halloween-eyes')?.getAttribute('aria-hidden')).toBe('true')
    permissionRequiredView.unmount()

    configureEnvironment()
    render(<HalloweenMessage />)
    expect(screen.queryByRole('button', { name: 'Ativar olhos interativos' })).toBeNull()
  })

  it('does not register movement listeners when disabled or reduced motion is enabled', () => {
    localStorage.setItem('Dietaday_halloween_eyes_orientation_permission_v1', 'granted')
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const { rerender } = render(<MotionHarness enabled={false} />)
    expect(screen.getByTestId('card').getAttribute('data-status')).toBe('inactive')
    rerender(<MotionHarness reducedMotion />)

    expect(addEventListener).not.toHaveBeenCalledWith('deviceorientation', expect.any(Function), expect.anything())
    expect(addEventListener).not.toHaveBeenCalledWith('pointermove', expect.any(Function), expect.anything())
    expect(addEventListener).not.toHaveBeenCalledWith('orientationchange', expect.any(Function), expect.anything())
  })

  it('centers the eyes in a hidden tab and removes listeners and pending frames on unmount', () => {
    const { unmount } = render(<MotionHarness />)
    const eyes = mockEyesBounds()
    dispatchOrientation(0, 0)
    dispatchOrientation(20, 15)
    expect(frames.size).toBeGreaterThan(0)

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(frames.size).toBe(0)
    expect(eyes.style.getPropertyValue('--pupil-x')).toBe('0.00px')
    expect(eyes.style.getPropertyValue('--pupil-y')).toBe('0.00px')

    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    dispatchOrientation(0, 0)
    dispatchOrientation(20, 15)
    expect(frames.size).toBeGreaterThan(0)
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const cancellationsBeforeUnmount = cancelFrame.mock.calls.length
    unmount()
    expect(cancelFrame.mock.calls.length).toBeGreaterThan(cancellationsBeforeUnmount)
    expect(removeEventListener).toHaveBeenCalledWith('deviceorientation', expect.any(Function))
  })
})
