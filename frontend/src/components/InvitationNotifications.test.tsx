// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const summaryApi = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  api: summaryApi,
  getErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
  isDemoMode: false,
}))
vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))
vi.mock('../state/DietContext', () => ({
  useDiets: () => ({ reload: vi.fn(), selectDiet: vi.fn() }),
}))

import { InvitationNotifications } from './InvitationNotifications'

describe('InvitationNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    summaryApi.mockReset().mockResolvedValue({ notifications: [], unreadCount: 0, invitations: [] })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('loads one consolidated summary and refreshes every 60 seconds', async () => {
    render(<MemoryRouter><InvitationNotifications /></MemoryRouter>)
    await act(async () => { await Promise.resolve() })

    expect(summaryApi).toHaveBeenCalledTimes(1)
    expect(summaryApi).toHaveBeenCalledWith('/notifications/summary', expect.objectContaining({ token: 'test-token' }))

    await act(async () => {
      vi.advanceTimersByTime(59_999)
      await Promise.resolve()
    })
    expect(summaryApi).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(summaryApi).toHaveBeenCalledTimes(2)
  })
})
