// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Layout } from './Layout'

vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({ user: { fullName: 'Pessoa Dietaday' } }),
}))
vi.mock('./InvitationNotifications', () => ({ InvitationNotifications: () => null }))
vi.mock('./CreatorCredit', () => ({ CreatorCredit: () => null }))
vi.mock('./ServerConnectionNotice', () => ({ ServerConnectionNotice: () => null }))
vi.mock('./OfflineMealNotice', () => ({ OfflineMealNotice: () => null }))
vi.mock('./CompetitiveFeedbackOverlay', () => ({ CompetitiveFeedbackOverlay: () => null }))
vi.mock('./motion/PageTransition', () => ({ PageTransition: () => null }))
vi.mock('./CompetitiveRankingWidget', () => ({
  CompetitiveRankingWidget: () => <div data-testid="competitive-ranking-widget" />,
}))

describe('Layout ranking widget visibility', () => {
  afterEach(cleanup)

  it('hides the floating widget on the new-meal route, including pending-meal edits', () => {
    render(<MemoryRouter initialEntries={['/refeicoes/nova']}><Layout /></MemoryRouter>)

    expect(screen.queryByTestId('competitive-ranking-widget')).toBeNull()
  })

  it('keeps the floating widget on other routes', () => {
    render(<MemoryRouter initialEntries={['/']}><Layout /></MemoryRouter>)

    expect(screen.getByTestId('competitive-ranking-widget')).toBeTruthy()
  })
})
