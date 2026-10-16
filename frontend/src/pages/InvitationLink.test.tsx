// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const state = vi.hoisted(() => ({
  auth: { user: null as { id: string; fullName: string } | null, token: null as string | null, ready: true },
  diets: [] as Array<{ id: string; name: string }>,
  reload: vi.fn(),
  selectDiet: vi.fn(),
  api: vi.fn(),
}))

vi.mock('../state/AuthContext', () => ({ useAuth: () => state.auth }))
vi.mock('../state/DietContext', () => ({ useDiets: () => ({ diets: state.diets, reload: state.reload, selectDiet: state.selectDiet }) }))
vi.mock('../lib/api', () => ({
  api: state.api,
  getErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
  isDemoMode: false,
}))
vi.mock('../components/Ui', () => ({
  Button: ({ children, loading, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => <button {...props} disabled={props.disabled || loading}>{children}</button>,
}))

import { InvitationLinkPage } from './InvitationLink'

function LocationState() {
  const location = useLocation()
  return <div data-testid="registration-state">{JSON.stringify(location.state)}</div>
}

function renderInvitation() {
  return render(<MemoryRouter initialEntries={['/convite/abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG']}>
    <Routes>
      <Route path="/convite/:token" element={<InvitationLinkPage />} />
      <Route path="/cadastro" element={<LocationState />} />
      <Route path="/login" element={<LocationState />} />
      <Route path="/" element={<div data-testid="home-route">início</div>} />
    </Routes>
  </MemoryRouter>)
}

describe('InvitationLinkPage', () => {
  beforeEach(() => {
    state.auth = { user: null, token: null, ready: true }
    state.diets = []
    state.reload.mockReset().mockResolvedValue(undefined)
    state.selectDiet.mockReset()
    state.api.mockReset().mockResolvedValue({
      dietId: 'diet-123',
      dietName: 'Dieta da família',
      inviterName: 'Ana',
      expiresAt: '2026-11-15T00:00:00Z',
    })
  })

  afterEach(cleanup)

  it('previews the reusable invite anonymously and keeps its URL through registration navigation', async () => {
    renderInvitation()

    expect(await screen.findByText(/Ana/)).toBeTruthy()
    expect(screen.getByText(/Dieta da família/)).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Criar conta' }))

    expect((await screen.findByTestId('registration-state')).textContent).toContain('/convite/abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG')
  })

  it('accepts the invite for a signed-in user and opens the new diet', async () => {
    state.auth = { user: { id: 'user-1', fullName: 'Pessoa' }, token: 'access-token', ready: true }
    renderInvitation()
    fireEvent.click(await screen.findByRole('button', { name: 'Aceitar convite' }))

    await waitFor(() => expect(state.selectDiet).toHaveBeenCalledWith('diet-123'))
    expect(state.reload).toHaveBeenCalledOnce()
    expect(state.api).toHaveBeenLastCalledWith(
      '/invitation-links/abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG/accept',
      { method: 'POST', token: 'access-token' },
    )
    expect(await screen.findByTestId('home-route')).toBeTruthy()
  })

  it('shows an open-diet action when this user already belongs to the invited diet', async () => {
    state.auth = { user: { id: 'user-1', fullName: 'Pessoa' }, token: 'access-token', ready: true }
    state.diets = [{ id: 'diet-123', name: 'Dieta da família' }]
    renderInvitation()

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir dieta' }))
    expect(state.selectDiet).toHaveBeenCalledWith('diet-123')
    expect(state.api).toHaveBeenCalledTimes(1)
  })
})
