// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setReducedMotionPreference } from '../test/matchMedia'

const flow = vi.hoisted(() => ({
  water: {
    date: '2026-10-08',
    goalMl: 2450,
    consumedMl: 2000,
    remainingMl: 450,
    percentage: 82,
    checks: [] as Array<{ id: string; amountMl: number; createdAt: string }>,
  },
  addCheck: vi.fn(),
  saveGoal: vi.fn(),
  celebrate: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('../state/WaterContext', () => ({
  useWater: () => ({
    water: flow.water,
    loading: false,
    saving: false,
    error: '',
    saveGoal: flow.saveGoal,
    addCheck: flow.addCheck,
  }),
}))
vi.mock('../hooks/useCompetitiveMode', () => ({ useCompetitiveMode: () => ({ activeDiet: null, dietId: null }) }))
vi.mock('../hooks/usePushStatus', () => ({ usePushStatus: () => ({ status: 'unsupported' }) }))
vi.mock('../hooks/useFeatureDiscovery', () => ({
  useFeatureDiscovery: () => ({ campaign: null, onVisible: vi.fn(), onClicked: vi.fn(), onDismissed: vi.fn() }),
}))
vi.mock('../state/AuthContext', () => ({ useAuth: () => ({ token: 'water-token', user: { id: 'water-user' } }) }))
vi.mock('../state/CelebrationContext', () => ({ useCelebration: () => ({ active: null, celebrate: flow.celebrate }) }))
vi.mock('../state/ToastContext', () => ({ useToast: () => ({ showToast: flow.showToast }) }))
vi.mock('../lib/uxTelemetry', () => ({ reportUxEvent: vi.fn() }))
vi.mock('../components/motion/AnimatedCheck', () => ({ AnimatedCheck: () => null }))
vi.mock('../components/motion/AnimatedCounter', () => ({ AnimatedCounter: () => null }))
vi.mock('../components/motion/AnimatedError', () => ({ AnimatedError: () => null }))
vi.mock('../components/motion/AnimatedProgress', () => ({ AnimatedProgress: () => null }))
vi.mock('../components/motion/WaterBottle', () => ({ WaterBottle: () => null }))

import { Water } from './Water'

describe('Water page exact remainder check', () => {
  beforeEach(() => {
    flow.water = {
      date: '2026-10-08',
      goalMl: 2450,
      consumedMl: 2000,
      remainingMl: 450,
      percentage: 82,
      checks: [],
    }
    flow.addCheck.mockReset().mockResolvedValue({
      ...flow.water,
      consumedMl: 2450,
      remainingMl: 0,
      percentage: 100,
      checks: [{ id: 'remainder-check', amountMl: 450, createdAt: '2026-10-08T12:00:00Z' }],
    })
    flow.saveGoal.mockReset()
    flow.celebrate.mockReset()
    flow.showToast.mockReset()
    setReducedMotionPreference(true)
  })

  afterEach(cleanup)

  it('offers and submits only the exact remaining amount when it is below 500 ml', async () => {
    render(
      <MemoryRouter>
        <Water />
      </MemoryRouter>,
    )

    expect(screen.getByRole('option', { name: 'Registrar restante (450 ml)' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: '0,5 L' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar restante (450 ml)' }))

    await waitFor(() => expect(flow.addCheck).toHaveBeenCalledWith(450))
  })
})
