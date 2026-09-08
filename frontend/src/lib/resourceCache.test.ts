import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearDietCache, clearUserCache, dietResourceKey, expireCachedResource, readCachedResource, updateCachedResource, writeCachedResource } from './resourceCache'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  get length() { return this.values.size }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  key(index: number) { return [...this.values.keys()][index] ?? null }
}

afterEach(() => vi.restoreAllMocks())

describe('resourceCache', () => {
  it('keeps data while reporting whether it is fresh', () => {
    const storage = new MemoryStorage()
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    writeCachedResource('user-1', 'diets', [{ id: 'diet-1' }], storage)

    expect(readCachedResource('user-1', 'diets', storage)).toEqual({ data: [{ id: 'diet-1' }], fresh: true })
    expireCachedResource('user-1', 'diets', storage)
    expect(readCachedResource('user-1', 'diets', storage)).toEqual({ data: [{ id: 'diet-1' }], fresh: false })
  })

  it('updates existing resources and isolates users', () => {
    const storage = new MemoryStorage()
    writeCachedResource('user-2', 'meals', ['breakfast'], storage)
    updateCachedResource<string[]>('user-2', 'meals', (meals) => [...meals, 'lunch'], storage)

    expect(readCachedResource<string[]>('user-2', 'meals', storage)?.data).toEqual(['breakfast', 'lunch'])
    expect(readCachedResource('another-user', 'meals', storage)).toBeNull()
    clearUserCache('user-2', storage)
    expect(readCachedResource('user-2', 'meals', storage)).toBeNull()
  })

  it('removes entries older than seven days', () => {
    const storage = new MemoryStorage()
    const now = vi.spyOn(Date, 'now').mockReturnValue(2_000_000)
    writeCachedResource('user-3', 'members', ['member'], storage)
    now.mockReturnValue(2_000_000 + 8 * 24 * 60 * 60_000)

    expect(readCachedResource('user-3', 'members', storage)).toBeNull()
  })

  it('clears only resources belonging to the removed diet', () => {
    const storage = new MemoryStorage()
    writeCachedResource('user-4', dietResourceKey('diet-1', 'meals'), ['meal'], storage)
    writeCachedResource('user-4', dietResourceKey('diet-1', 'members'), ['member'], storage)
    writeCachedResource('user-4', dietResourceKey('diet-2', 'meals'), ['other meal'], storage)

    clearDietCache('user-4', 'diet-1', storage)

    expect(readCachedResource('user-4', dietResourceKey('diet-1', 'meals'), storage)).toBeNull()
    expect(readCachedResource('user-4', dietResourceKey('diet-1', 'members'), storage)).toBeNull()
    expect(readCachedResource('user-4', dietResourceKey('diet-2', 'meals'), storage)?.data).toEqual(['other meal'])
  })
})
