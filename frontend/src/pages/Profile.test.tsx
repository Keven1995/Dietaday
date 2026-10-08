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
  },
  updateUser: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({ ...profile, token: 'profile-token' }),
}))
vi.mock('../hooks/usePushStatus', () => ({
  usePushStatus: () => ({ status: 'unsupported', refresh: vi.fn() }),
}))
vi.mock('../lib/api', () => ({
  api: vi.fn(),
  getErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
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
    profile.updateUser.mockReset().mockResolvedValue(undefined)
    profile.logout.mockReset()
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

  it('submits a valid birth date when updating the profile', async () => {
    renderProfile()
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '1990-04-15' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }))

    await waitFor(() => expect(profile.updateUser).toHaveBeenCalledWith(expect.objectContaining({
      birthDate: '1990-04-15',
    })))
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
})
