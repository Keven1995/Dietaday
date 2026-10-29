// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setReducedMotionPreference } from '../test/matchMedia'
import { DIET_MEAL_TYPES } from '../lib/dietMealTypes'

const flow = vi.hoisted(() => ({
  diets: [] as Array<{
    id: string
    name: string
    startDate: string
    endDate: string
    competitiveMode: boolean
    canManageMealTypes?: boolean
    mealTypeSchedule?: Array<{ effectiveFrom: string; mealTypes: string[] }>
  }>,
  selectDiet: vi.fn(),
  createDiet: vi.fn(),
  updateDietMealTypes: vi.fn(),
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
    updateDietMealTypes: flow.updateDietMealTypes,
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
    flow.updateDietMealTypes.mockReset()
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

  it('sends the selected meal types when creating a diet, with all six selected by default', async () => {
    flow.createDiet.mockResolvedValue({ id: 'new-diet', name: 'Plano novo', startDate: '2026-10-01', endDate: '2026-10-31', competitiveMode: false })
    render(<MemoryRouter><Diets /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Nova dieta' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Plano novo' } })
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-10-31' } })
    expect((screen.getByLabelText('Ceia') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByLabelText('Ceia'))
    fireEvent.click(screen.getByRole('button', { name: 'Criar e selecionar' }))

    await waitFor(() => expect(flow.createDiet).toHaveBeenCalledOnce())
    expect(flow.createDiet.mock.calls[0][0]).toMatchObject({
      name: 'Plano novo',
      mealTypes: DIET_MEAL_TYPES.filter((mealType) => mealType !== 'Ceia'),
    })
  })

  it('shows the meal-list editor only to the current owner and saves selections', async () => {
    flow.diets = [
      {
        id: 'owner-diet', name: 'Dieta do responsável', startDate: '2026-10-01', endDate: '2026-10-31',
        competitiveMode: false, canManageMealTypes: true,
        mealTypeSchedule: [{ effectiveFrom: '2026-10-01', mealTypes: [...DIET_MEAL_TYPES] }],
      },
      {
        id: 'member-diet', name: 'Dieta de membro', startDate: '2026-10-01', endDate: '2026-10-31',
        competitiveMode: false, canManageMealTypes: false,
      },
    ]
    flow.updateDietMealTypes.mockResolvedValue([
      { effectiveFrom: '2026-10-01', mealTypes: [...DIET_MEAL_TYPES] },
      { effectiveFrom: '2026-10-18', mealTypes: DIET_MEAL_TYPES.filter((mealType) => mealType !== 'Ceia') },
    ])
    render(<MemoryRouter><Diets /></MemoryRouter>)

    expect(screen.getAllByRole('button', { name: 'Refeições da dieta' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Refeições da dieta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar lista de refeições' }))
    fireEvent.click(screen.getByLabelText('Ceia'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar lista de refeições' }))

    await waitFor(() => expect(flow.updateDietMealTypes).toHaveBeenCalledWith(
      'owner-diet', DIET_MEAL_TYPES.filter((mealType) => mealType !== 'Ceia'),
    ))
  })
})
