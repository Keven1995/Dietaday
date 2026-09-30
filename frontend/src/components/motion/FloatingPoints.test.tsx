// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOTION_TIMEOUT } from '../../constants/motion'
import { setReducedMotionPreference } from '../../test/matchMedia'
import { FloatingPoints } from './FloatingPoints'

describe('FloatingPoints', () => {
  beforeEach(() => {
    setReducedMotionPreference(false)
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders the awarded points and completes after the feedback timeout', () => {
    const onComplete = vi.fn()

    render(<FloatingPoints points={120} onComplete={onComplete} />)

    expect(screen.getByRole('status').textContent).toContain('+120 pontos')
    expect(onComplete).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(MOTION_TIMEOUT.floatingFeedback - 1))
    expect(onComplete).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('clears the completion timer when unmounted', () => {
    const onComplete = vi.fn()
    const { unmount } = render(<FloatingPoints points={25} onComplete={onComplete} />)

    unmount()
    act(() => vi.advanceTimersByTime(MOTION_TIMEOUT.floatingFeedback))

    expect(onComplete).not.toHaveBeenCalled()
  })
})
