import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }))

vi.mock('./api', () => ({
  api: apiMock,
  isDemoMode: false,
}))

import { addWaterCheck, getWaterToday, updateWaterGoal, WATER_CHECK_OPTIONS, WATER_GOAL_OPTIONS } from './water'

describe('water amount options', () => {
  it('allows 50 ml goal increments from 2 L through 4 L while checks remain in 500 ml increments', () => {
    expect(WATER_GOAL_OPTIONS[0]).toBe(2000)
    expect(WATER_GOAL_OPTIONS[WATER_GOAL_OPTIONS.length - 1]).toBe(4000)
    expect(WATER_GOAL_OPTIONS).toContain(2450)
    expect(WATER_GOAL_OPTIONS.every((amount) => amount >= 2000 && amount <= 4000 && amount % 50 === 0)).toBe(true)
    expect(WATER_CHECK_OPTIONS).toEqual([500, 1000, 1500, 2000, 2500, 3000, 3500, 4000])
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
})
