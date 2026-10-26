// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setReducedMotionPreference } from '../test/matchMedia'

const flow = vi.hoisted(() => ({
  diets: [] as Array<{ id: string; name: string; startDate: string; endDate: string; competitiveMode: boolean }>,
  selectDiet: vi.fn(),
  createDiet: vi.fn(),
  deleteDiet: vi.fn(),
}))

vi.mock('../state/AuthContext', () => ({ useAuth: () => ({ user: { id: 'diets-user' } }) }))
vi.mock('../state/DietContext', () => ({
  useDiets: () => ({
    diets: flow.diets,
    activeDiet: null,
    activeDietId: null,
    loading: false,
    error: '',
    selectDiet: flow.selectDiet,
    createDiet: flow.createDiet,
    deleteDiet: flow.deleteDiet,
  }),
}))
vi.mock('../hooks/useDietResource', () => ({ useDietResource: () => ({ data: [], loading: false, error: '' }) }))

import { Diets } from './Diets'

describe('Diets page completion feedback', () => {
  beforeEach(() => {
    flow.diets = []
    flow.selectDiet.mockReset()
    flow.createDiet.mockReset()
    flow.deleteDiet.mockReset()
    setReducedMotionPreference(true)
  })

  afterEach(cleanup)

  it('shows the congratulatory message for a diet whose period has ended', () => {
    flow.diets = [{ id: 'ended-diet', name: 'Plano concluído', startDate: '2020-01-01', endDate: '2020-01-31', competitiveMode: false }]

    render(<MemoryRouter><Diets /></MemoryRouter>)

    expect(screen.getByRole('status').textContent).toContain('Parabéns por concluir seu plano!')
    expect(screen.getByText('Concluída')).toBeTruthy()
  })

  it('does not show completion feedback while the diet period is active', () => {
    flow.diets = [{ id: 'active-diet', name: 'Plano ativo', startDate: '2999-01-01', endDate: '2999-01-31', competitiveMode: false }]

    render(<MemoryRouter><Diets /></MemoryRouter>)

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('Concluída')).toBeNull()
  })
})
