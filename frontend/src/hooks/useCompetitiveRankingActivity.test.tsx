// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { useCompetitiveRankingActivity } from './useCompetitiveRankingActivity'

vi.mock('../lib/api', () => ({
  api: vi.fn(),
  isDemoMode: false,
}))
vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token', user: { id: 'user-1' } }),
}))
vi.mock('./useCompetitiveMode', () => ({
  useCompetitiveMode: () => ({
    activeDiet: { id: 'diet-1', competitiveMode: true },
    enabled: true,
  }),
}))

let visibility: DocumentVisibilityState = 'visible'
let online = true

function setVisibility(next: DocumentVisibilityState) {
  visibility = next
}

describe('useCompetitiveRankingActivity', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    visibility = 'visible'
    online = true
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
    vi.mocked(api).mockResolvedValue({ eventId: null, sourceType: null, createdAt: null })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('polls every 30 seconds while visible', async () => {
    renderHook(() => useCompetitiveRankingActivity())
    await act(async () => { await Promise.resolve() })
    expect(api).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(29_999)
      await Promise.resolve()
    })
    expect(api).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(api).toHaveBeenCalledTimes(2)
  })

  it('pauses hidden or offline tabs and refreshes immediately when visible again', async () => {
    renderHook(() => useCompetitiveRankingActivity())
    await act(async () => { await Promise.resolve() })
    expect(api).toHaveBeenCalledTimes(1)

    setVisibility('hidden')
    await act(async () => {
      vi.advanceTimersByTime(30_000)
      await Promise.resolve()
    })
    expect(api).toHaveBeenCalledTimes(1)

    online = false
    setVisibility('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
    })
    expect(api).toHaveBeenCalledTimes(1)

    online = true
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
    })
    expect(api).toHaveBeenCalledTimes(2)
  })
})
