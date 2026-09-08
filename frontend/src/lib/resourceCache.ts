const CACHE_PREFIX = 'Dietaday_resource_v1:'
const FRESH_FOR_MS = 2 * 60_000
const MAX_AGE_MS = 7 * 24 * 60 * 60_000
const MAX_ENTRIES = 30

type CacheEntry<T> = {
  userId: string
  resource: string
  savedAt: number
  data: T
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
const memory = new Map<string, CacheEntry<unknown>>()

function browserStorage(): StorageLike | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function cacheKey(userId: string, resource: string) {
  return `${CACHE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(resource)}`
}

function isCacheEntry(value: unknown): value is CacheEntry<unknown> {
  return typeof value === 'object' && value !== null &&
    'userId' in value && typeof value.userId === 'string' &&
    'resource' in value && typeof value.resource === 'string' &&
    'savedAt' in value && typeof value.savedAt === 'number' &&
    'data' in value
}

function storedEntries(storage: StorageLike) {
  const entries: Array<{ key: string; entry: CacheEntry<unknown> }> = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key?.startsWith(CACHE_PREFIX)) continue
    try {
      const value: unknown = JSON.parse(storage.getItem(key) ?? '')
      if (isCacheEntry(value)) entries.push({ key, entry: value })
      else storage.removeItem(key)
    } catch {
      storage.removeItem(key)
    }
  }
  return entries
}

function prune(storage: StorageLike) {
  const now = Date.now()
  const entries = storedEntries(storage)
  for (const { key, entry } of entries) {
    if (now - entry.savedAt > MAX_AGE_MS) {
      storage.removeItem(key)
      memory.delete(key)
    }
  }
  const remaining = entries
    .filter(({ entry }) => now - entry.savedAt <= MAX_AGE_MS)
    .sort((left, right) => left.entry.savedAt - right.entry.savedAt)
  while (remaining.length >= MAX_ENTRIES) {
    const oldest = remaining.shift()
    if (oldest) {
      storage.removeItem(oldest.key)
      memory.delete(oldest.key)
    }
  }
}

export function readCachedResource<T>(userId: string, resource: string, storage = browserStorage()) {
  const key = cacheKey(userId, resource)
  let entry = memory.get(key)
  if (!entry && storage) {
    try {
      const value: unknown = JSON.parse(storage.getItem(key) ?? '')
      if (isCacheEntry(value) && value.userId === userId && value.resource === resource) {
        entry = value
        memory.set(key, value)
      }
    } catch {
      storage.removeItem(key)
    }
  }
  if (!entry) return null
  if (Date.now() - entry.savedAt > MAX_AGE_MS) {
    memory.delete(key)
    storage?.removeItem(key)
    return null
  }
  return { data: entry.data as T, fresh: Date.now() - entry.savedAt <= FRESH_FOR_MS }
}

export function writeCachedResource<T>(userId: string, resource: string, data: T, storage = browserStorage()) {
  const key = cacheKey(userId, resource)
  const entry: CacheEntry<T> = { userId, resource, savedAt: Date.now(), data }
  memory.set(key, entry)
  if (!storage) return
  try {
    prune(storage)
    storage.setItem(key, JSON.stringify(entry))
  } catch {
    // Do not leave an older entry looking fresh after a failed persistence attempt.
    storage.removeItem(key)
  }
}

export function expireCachedResource(userId: string, resource: string, storage = browserStorage()) {
  const cached = readCachedResource<unknown>(userId, resource, storage)
  if (!cached) return
  const key = cacheKey(userId, resource)
  const entry: CacheEntry<unknown> = {
    userId,
    resource,
    savedAt: Date.now() - FRESH_FOR_MS - 1,
    data: cached.data,
  }
  memory.set(key, entry)
  try {
    storage?.setItem(key, JSON.stringify(entry))
  } catch {
    // The in-memory entry still remains usable.
  }
}

export function updateCachedResource<T>(userId: string, resource: string, update: (current: T) => T, storage = browserStorage()) {
  const cached = readCachedResource<T>(userId, resource, storage)
  if (cached) writeCachedResource(userId, resource, update(cached.data), storage)
}

export function clearUserCache(userId: string, storage = browserStorage()) {
  for (const [key, entry] of memory) {
    if (entry.userId === userId) memory.delete(key)
  }
  if (!storage) return
  for (const { key, entry } of storedEntries(storage)) {
    if (entry.userId === userId) storage.removeItem(key)
  }
}

export function clearDietCache(userId: string, dietId: string, storage = browserStorage()) {
  const prefix = `diet:${dietId}:`
  for (const [key, entry] of memory) {
    if (entry.userId === userId && entry.resource.startsWith(prefix)) memory.delete(key)
  }
  if (!storage) return
  for (const { key, entry } of storedEntries(storage)) {
    if (entry.userId === userId && entry.resource.startsWith(prefix)) storage.removeItem(key)
  }
}

export function dietResourceKey(dietId: string, resource: string) {
  return `diet:${dietId}:${resource}`
}
