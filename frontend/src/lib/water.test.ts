import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }))

vi.mock('./api', () => ({
  api: apiMock,
  isDemoMode: false,
}))

import { addWaterCheck, getWaterToday, updateWaterGoal } from './water'

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
