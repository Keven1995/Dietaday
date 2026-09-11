import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { addOfflineMeal, claimOfflineMeal, listOfflineMeals, removeClaimedOfflineMeal, removeOfflineMeal, saveClaimedOfflineMeal, saveOfflineMeal, type OfflineMealOperation } from './offlineMeals'

function operation(overrides: Partial<OfflineMealOperation> = {}): OfflineMealOperation {
  return {
    id: crypto.randomUUID(),
    userId: 'user-1',
    dietId: 'diet-1',
    dietName: 'Dieta',
    authorName: 'Keven',
    request: { mealType: 'Almoço', description: 'Arroz e frango', mealDate: '2026-09-11' },
    photo: new Blob(['photo'], { type: 'image/jpeg' }),
    photoName: 'meal.jpg',
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('offlineMeals', () => {
  it('persists photos and isolates each user queue', async () => {
    const first = operation()
    const second = operation({ userId: 'user-2' })
    await addOfflineMeal(first)
    await addOfflineMeal(second)

    const firstUserMeals = await listOfflineMeals('user-1')
    expect(firstUserMeals).toHaveLength(1)
    expect(firstUserMeals[0].photo).toBeInstanceOf(Blob)
    expect(await listOfflineMeals('user-2')).toHaveLength(1)

    await removeOfflineMeal(first.id)
    await removeOfflineMeal(second.id)
  })

  it('retains the operation id and uploaded URL while changing its status', async () => {
    const queued = operation({ uploadedPhotoUrl: 'https://example.com/photo.jpg' })
    await addOfflineMeal(queued)
    await saveOfflineMeal({ ...queued, status: 'failed', attempts: 1, error: 'invalid meal' })

    expect(await listOfflineMeals(queued.userId)).toEqual([
      expect.objectContaining({
        id: queued.id,
        uploadedPhotoUrl: 'https://example.com/photo.jpg',
        status: 'failed',
        attempts: 1,
      }),
    ])
    await removeOfflineMeal(queued.id)
  })

  it('allows only one tab to claim an operation for synchronization', async () => {
    const queued = operation()
    await addOfflineMeal(queued)

    const claims = await Promise.all([
      claimOfflineMeal(queued.id, 'tab-1'),
      claimOfflineMeal(queued.id, 'tab-2'),
    ])

    expect(claims.filter(Boolean)).toHaveLength(1)
    expect(claims.find(Boolean)).toEqual(expect.objectContaining({ status: 'syncing' }))
    await removeOfflineMeal(queued.id)
  })

  it('rejects writes from a tab after another tab takes over an expired lease', async () => {
    const queued = operation()
    await addOfflineMeal(queued)
    const firstClaim = await claimOfflineMeal(queued.id, 'tab-1')
    await saveOfflineMeal({ ...firstClaim!, syncLeaseUntil: 0 })
    const secondClaim = await claimOfflineMeal(queued.id, 'tab-2')

    expect(secondClaim?.syncOwner).toBe('tab-2')
    expect(await saveClaimedOfflineMeal({ ...firstClaim!, status: 'failed' }, 'tab-1')).toBe(false)
    expect(await removeClaimedOfflineMeal(queued.id, 'tab-1')).toBe(false)
    expect((await listOfflineMeals(queued.userId))[0].syncOwner).toBe('tab-2')
    await removeOfflineMeal(queued.id)
  })
})
