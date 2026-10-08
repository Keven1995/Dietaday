import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }))

vi.mock('./api', () => ({
  api: apiMock,
  isDemoMode: false,
}))

import {
  addWaterCheck,
  getWaterHistory,
  getAvailableWaterCheckOptions,
  getWaterToday,
  readCachedWaterHistory,
  updateWaterGoal,
  WATER_CHECK_OPTIONS,
  WATER_GOAL_OPTIONS,
} from './water'

describe('water amount options', () => {
  it('allows 50 ml goal increments from 2 L through 4 L while checks remain in 500 ml increments', () => {
    expect(WATER_GOAL_OPTIONS[0]).toBe(2000)
    expect(WATER_GOAL_OPTIONS[WATER_GOAL_OPTIONS.length - 1]).toBe(4000)
    expect(WATER_GOAL_OPTIONS).toContain(2450)
    expect(WATER_GOAL_OPTIONS.every((amount) => amount >= 2000 && amount <= 4000 && amount % 50 === 0)).toBe(true)
    expect(WATER_CHECK_OPTIONS).toEqual([500, 1000, 1500, 2000, 2500, 3000, 3500, 4000])
  })

  it('offers an exact remainder only when the positive balance is below 500 ml', () => {
    expect(getAvailableWaterCheckOptions(450)).toEqual({ regular: [], exactRemainderMl: 450 })
    expect(getAvailableWaterCheckOptions(350)).toEqual({ regular: [], exactRemainderMl: 350 })
    expect(getAvailableWaterCheckOptions(550)).toEqual({ regular: [500], exactRemainderMl: null })
    expect(getAvailableWaterCheckOptions(0)).toEqual({ regular: [], exactRemainderMl: null })
  })
})

describe('competitive water endpoints', () => {
  beforeEach(() => apiMock.mockResolvedValue({}))

  it('uses the diet-scoped endpoint for competitive checks', async () => {
    await addWaterCheck('token', 'user-id', 500, 'diet-id')

    expect(apiMock).toHaveBeenCalledWith('/diets/diet-id/water/checks', {
      method: 'POST',
      token: 'token',
      body: JSON.stringify({ amountMl: 500 }),
    })
  })

  it('keeps the legacy endpoints for non-competitive water tracking', async () => {
    await getWaterToday('token', 'user-id')
    await updateWaterGoal('token', 'user-id', 2000)

    expect(apiMock).toHaveBeenNthCalledWith(1, '/water/today', { token: 'token' })
    expect(apiMock).toHaveBeenNthCalledWith(2, '/water/goal', {
      method: 'PUT',
      token: 'token',
      body: JSON.stringify({ goalMl: 2000 }),
    })
  })

  it('requests monthly history from the endpoint matching its scope', async () => {
    apiMock.mockResolvedValueOnce({ month: '2026-10', days: [] })
    await getWaterHistory('token', 'history-user', '2026-10')
    expect(apiMock).toHaveBeenLastCalledWith('/water/history?month=2026-10', { token: 'token' })

    apiMock.mockResolvedValueOnce({ month: '2026-10', days: [] })
    await getWaterHistory('token', 'history-user', '2026-10', 'diet-id')
    expect(apiMock).toHaveBeenLastCalledWith('/diets/diet-id/water/history?month=2026-10', { token: 'token' })
  })

  it('caches monthly history separately by user, month, and diet scope', async () => {
    const history = { month: '2026-11', days: [{ date: '2026-11-01', consumedMl: 500, goalMl: null, percentage: null, hasRecords: true }] }
    apiMock.mockResolvedValueOnce(history)
    await getWaterHistory('token', 'history-cache-user', '2026-11', 'diet-cache-id')

    expect(readCachedWaterHistory('history-cache-user', '2026-11', 'diet-cache-id')?.data).toEqual(history)
    expect(readCachedWaterHistory('history-cache-user', '2026-11')?.data).toBeUndefined()
    expect(readCachedWaterHistory('another-history-user', '2026-11', 'diet-cache-id')?.data).toBeUndefined()
    expect(readCachedWaterHistory('history-cache-user', '2026-10', 'diet-cache-id')?.data).toBeUndefined()
  })

  it('coalesces concurrent requests for the same user, month, and scope', async () => {
    apiMock.mockClear()
    const history = { month: '2026-12', days: [] }
    apiMock.mockResolvedValueOnce(history)

    const [first, second] = await Promise.all([
      getWaterHistory('token', 'history-concurrent-user', '2026-12'),
      getWaterHistory('token', 'history-concurrent-user', '2026-12'),
    ])

    expect(first).toEqual(history)
    expect(second).toEqual(history)
    expect(apiMock).toHaveBeenCalledOnce()
  })
})
