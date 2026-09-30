// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOTION_TIMEOUT } from '../constants/motion'
import { setReducedMotionPreference } from '../test/matchMedia'
import { CelebrationOverlay } from './CelebrationOverlay'
import type { ActiveCelebration } from '../state/CelebrationContext'

vi.mock('./motion/Confetti', () => ({
  default: ({ variant }: { variant: string }) => <div data-testid="confetti" data-variant={variant} />,
}))

const dailyCelebration: ActiveCelebration = {
  type: 'DAILY_GOAL_COMPLETED',
  id: 'daily-goal-1',
  key: 'DAILY_GOAL_COMPLETED:daily-goal-1',
}

describe('CelebrationOverlay', () => {
  beforeEach(() => setReducedMotionPreference(false))

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders the celebration message and matching confetti variant', async () => {
    render(<CelebrationOverlay celebration={dailyCelebration} onDismiss={vi.fn()} />)

    expect(screen.getByRole('status').textContent).toContain('Meta diária concluída!')
    await waitFor(() => expect(screen.queryByTestId('confetti')).not.toBeNull())
    expect(screen.getByTestId('confetti').getAttribute('data-variant')).toBe('daily-goal')
  })

  it('omits confetti when reduced motion is enabled', () => {
    setReducedMotionPreference(true)

    render(<CelebrationOverlay celebration={{ ...dailyCelebration, type: 'HYDRATION_GOAL_COMPLETED' }} onDismiss={vi.fn()} />)

    expect(screen.getByRole('status').textContent).toContain('Meta de hidratação concluída!')
    expect(screen.queryByTestId('confetti')).toBeNull()
  })

  it('dismisses the celebration after the configured timeout', () => {
    setReducedMotionPreference(true)
    vi.useFakeTimers()
    const onDismiss = vi.fn()

    render(<CelebrationOverlay celebration={dailyCelebration} onDismiss={onDismiss} />)

    act(() => vi.advanceTimersByTime(MOTION_TIMEOUT.celebrationDismiss - 1))
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('renders nothing without an active celebration', () => {
    const { container } = render(<CelebrationOverlay celebration={null} onDismiss={vi.fn()} />)

    expect(container.firstChild).toBeNull()
  })
})
