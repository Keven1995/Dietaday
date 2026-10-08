// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { setReducedMotionPreference } from '../test/matchMedia'

const auth = vi.hoisted(() => ({
  user: null as null,
  login: vi.fn(),
  register: vi.fn(),
}))

vi.mock('../state/AuthContext', () => ({
  useAuth: () => auth,
}))
vi.mock('../lib/api', () => ({ isDemoMode: true }))
vi.mock('../lib/serverWakeup', () => ({ prepareApi: vi.fn(async () => undefined) }))

import { AuthPage } from './Auth'

function renderRegistration() {
  render(
    <MemoryRouter>
      <AuthPage mode="register" />
    </MemoryRouter>,
  )
}

function fillRegistration(birthDate: string) {
  fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Pessoa Teste' } })
  fireEvent.change(screen.getByLabelText('Sexo'), { target: { value: 'FEMALE' } })
  fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: birthDate } })
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'pessoa@example.com' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'password123' } })
}

describe('AuthPage registration birth date', () => {
  beforeEach(() => {
    auth.user = null
    auth.login.mockReset()
    auth.register.mockReset().mockResolvedValue(undefined)
    setReducedMotionPreference(true)
  })

  afterEach(cleanup)

  it('requires and sends birthDate with registration data', async () => {
    renderRegistration()
    fillRegistration('1990-04-15')
    fireEvent.click(screen.getByRole('button', { name: /Criar conta/ }))

    await waitFor(() => expect(auth.register).toHaveBeenCalledWith({
      fullName: 'Pessoa Teste',
      sex: 'FEMALE',
      birthDate: '1990-04-15',
      email: 'pessoa@example.com',
      password: 'password123',
    }))
  })

  it('rejects a future birth date before calling register', async () => {
    renderRegistration()
    fillRegistration('2099-01-01')
    const birthDate = screen.getByLabelText('Data de nascimento') as HTMLInputElement
    expect(birthDate.validity.rangeOverflow).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Criar conta/ }))

    expect(auth.register).not.toHaveBeenCalled()
  })
})
