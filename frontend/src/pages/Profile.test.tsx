// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setReducedMotionPreference } from '../test/matchMedia'

const profile = vi.hoisted(() => ({
  user: {
    id: 'profile-user',
    email: 'profile@example.com',
    fullName: 'Pessoa Teste',
    weightKg: 72,
    heightCm: 178,
    sex: 'FEMALE',
    birthDate: null as string | null,
    waterGoalSuggestionReview: {
      status: 'NOT_REQUIRED' as 'NOT_REQUIRED' | 'PENDING' | 'RESOLVED',
      suggestedGoalMl: null as number | null,
    },
  },
  updateUser: vi.fn(),
  refreshProfile: vi.fn(),
  logout: vi.fn(),
  api: vi.fn(),
  refreshWater: vi.fn(),
}))

vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({ ...profile, token: 'profile-token' }),
}))
vi.mock('../hooks/useCompetitiveMode', () => ({ useCompetitiveMode: () => ({ dietId: null }) }))
vi.mock('../hooks/usePushStatus', () => ({
  usePushStatus: () => ({ status: 'unsupported', refresh: vi.fn() }),
}))
vi.mock('../lib/api', () => ({
  api: profile.api,
  isDemoMode: false,
  getErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}))
vi.mock('../state/WaterContext', () => ({
  useWater: () => ({ water: { goalMl: 2000 }, loading: false, refresh: profile.refreshWater }),
}))
vi.mock('../lib/featureDiscoveryTelemetry', () => ({ completeFeatureCampaign: vi.fn() }))
vi.mock('../lib/pushNotifications', () => ({
  disablePushNotifications: vi.fn(),
  enablePushNotifications: vi.fn(),
}))

import { Profile } from './Profile'

function renderProfile() {
  render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  )
}

describe('Profile birth date', () => {
  beforeEach(() => {
    profile.user.birthDate = null
    profile.user.waterGoalSuggestionReview = { status: 'NOT_REQUIRED', suggestedGoalMl: null }
    profile.updateUser.mockReset().mockResolvedValue(undefined)
    profile.refreshProfile.mockReset().mockResolvedValue(undefined)
    profile.logout.mockReset()
    profile.api.mockReset().mockResolvedValue({})
    profile.refreshWater.mockReset().mockResolvedValue(undefined)
    setReducedMotionPreference(true)
  })

  afterEach(cleanup)

  it('allows legacy users to leave birth date empty while saving the profile', async () => {
    renderProfile()

    expect((screen.getByLabelText('Data de nascimento') as HTMLInputElement).value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }))

    await waitFor(() => expect(profile.updateUser).toHaveBeenCalledWith(expect.objectContaining({
      birthDate: null,
    })))
  })

  it('lets the user disable receiving meal nudges', async () => {
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: 'Desativar recebimento' }))

    await waitFor(() => expect(profile.api).toHaveBeenCalledWith('/profile/meal-nudges', expect.objectContaining({
      method: 'PUT',
      token: 'profile-token',
      body: JSON.stringify({ enabled: false }),
    })))
    expect((await screen.findByRole('status')).textContent).toContain('Recebimento de cutucadas desativado.')
  })

  it('submits a valid birth date when updating the profile', async () => {
    renderProfile()
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '1990-04-15' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }))

    await waitFor(() => expect(profile.updateUser).toHaveBeenCalledWith(expect.objectContaining({
      birthDate: '1990-04-15',
    })))
  })

  it('opens the review modal after saving a legacy birth date with an eligible suggestion', async () => {
    profile.updateUser.mockImplementation(async () => {
      profile.user.birthDate = '1990-04-15'
      profile.user.waterGoalSuggestionReview = { status: 'PENDING', suggestedGoalMl: 2450 }
    })
    renderProfile()
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '1990-04-15' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }))

    expect(await screen.findByRole('dialog', { name: 'Quer atualizar sua meta de hidratação?' })).toBeTruthy()
  })

  it('shows the numeric BMI and adult reference category with an accessible explanation', () => {
    profile.user.birthDate = '1990-04-15'
    renderProfile()

    expect(screen.getByText('22,7')).toBeTruthy()
    expect(screen.getByText('— Faixa adequada')).toBeTruthy()

    const infoButton = screen.getByRole('button', { name: 'Como o IMC é calculado?' })
    expect(infoButton.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(infoButton)

    expect(infoButton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/dividindo o peso em quilos pela altura em metros ao quadrado/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /OMS: sobrepeso e obesidade/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /NHS: cálculo do IMC em adultos/ })).toBeTruthy()
  })

  it('shows the BMI number without adult classification for a minor', () => {
    profile.user.birthDate = '2015-04-15'
    renderProfile()

    expect(screen.getByText('22,7')).toBeTruthy()
    expect(screen.queryByText('— Faixa adequada')).toBeNull()
    expect(screen.getByText(/Para menores de 18 anos/)).toBeTruthy()
  })

  it('asks an eligible legacy user whether to keep or apply the suggested goal', () => {
    profile.user.waterGoalSuggestionReview = { status: 'PENDING', suggestedGoalMl: 2450 }
    renderProfile()

    expect(screen.getByRole('dialog', { name: 'Quer atualizar sua meta de hidratação?' })).toBeTruthy()
    expect(screen.getByText('2 L')).toBeTruthy()
    expect(screen.getByText('2,45 L')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Manter meta atual' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Usar meta recomendada' })).toBeTruthy()
  })

  it('defers the goal choice and lets the user reopen it during the session', () => {
    profile.user.waterGoalSuggestionReview = { status: 'PENDING', suggestedGoalMl: 2450 }
    renderProfile()

    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Rever sugestão de meta' }))
    expect(screen.getByRole('dialog', { name: 'Quer atualizar sua meta de hidratação?' })).toBeTruthy()
  })

  it('keeps the current goal without applying a second goal update', async () => {
    profile.user.waterGoalSuggestionReview = { status: 'PENDING', suggestedGoalMl: 2450 }
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: 'Manter meta atual' }))

    await waitFor(() => expect(profile.api).toHaveBeenCalledWith('/profile/water-goal-suggestion', expect.objectContaining({
      method: 'PUT',
      token: 'profile-token',
      body: JSON.stringify({ decision: 'KEEP_CURRENT', dietId: null }),
    })))
    expect(profile.updateUser).not.toHaveBeenCalled()
    expect(profile.refreshWater).not.toHaveBeenCalled()
    await waitFor(() => expect(profile.refreshProfile).toHaveBeenCalledOnce())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('applies an explicit suggestion using the current context and refreshes profile and water', async () => {
    profile.user.waterGoalSuggestionReview = { status: 'PENDING', suggestedGoalMl: 2450 }
    renderProfile()

    fireEvent.click(screen.getByRole('button', { name: 'Usar meta recomendada' }))

    await waitFor(() => expect(profile.api).toHaveBeenCalledWith('/profile/water-goal-suggestion', expect.objectContaining({
      method: 'PUT',
      token: 'profile-token',
      body: JSON.stringify({ decision: 'APPLY_RECOMMENDATION', dietId: null }),
    })))
    await waitFor(() => expect(profile.refreshProfile).toHaveBeenCalledOnce())
    expect(profile.refreshWater).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
