import { useEffect, useState } from 'react'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { dietResourceKey, expireCachedResource, readCachedResource, resourceCacheRevision, resourceCacheSavedAt, subscribeResourceCache, writeCachedResource } from '../lib/resourceCache'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'

type DietResource<T> = {
  data: T
  loading: boolean
  error: string
  reload: () => void
}

type PendingRequest = {
  promise: Promise<unknown>
  controller: AbortController
  consumers: number
  settled: boolean
  startedAt: number
}

const pendingRequests = new Map<string, PendingRequest>()

function acquireRequest<T>(key: string, request: (signal: AbortSignal) => Promise<T>) {
  let entry = pendingRequests.get(key)
  if (!entry) {
    const controller = new AbortController()
    entry = { promise: request(controller.signal), controller, consumers: 0, settled: false, startedAt: Date.now() }
    pendingRequests.set(key, entry)
    entry.promise.then(
      () => { entry!.settled = true; if (pendingRequests.get(key) === entry) pendingRequests.delete(key) },
      () => { entry!.settled = true; if (pendingRequests.get(key) === entry) pendingRequests.delete(key) },
    )
  }
  entry.consumers += 1
  return {
    promise: entry.promise as Promise<T>,
    startedAt: entry.startedAt,
    release: () => {
      entry!.consumers -= 1
      if (!entry!.settled && entry!.consumers === 0) {
        entry!.controller.abort()
        if (pendingRequests.get(key) === entry) pendingRequests.delete(key)
      }
    },
  }
}

export function useDietResource<T>(resource: string, demoData: T, emptyData: T, fallbackError: string): DietResource<T> {
  const { token, user } = useAuth()
  const { activeDiet } = useDiets()
  const cacheResource = activeDiet ? dietResourceKey(activeDiet.id, resource) : ''
  const identity = user && cacheResource ? `${user.id}:${cacheResource}` : ''
  const renderedCache = !isDemoMode && user && cacheResource ? readCachedResource<T>(user.id, cacheResource) : null
  const [resourceState, setResourceState] = useState<{ identity: string; data: T }>(() => ({
    identity,
    data: renderedCache?.data ?? emptyData,
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => subscribeResourceCache((changedUserId, changedResource) => {
    if (!user || changedUserId !== user.id || changedResource !== cacheResource) return
    const cached = readCachedResource<T>(user.id, cacheResource)
    if (cached) setResourceState({ identity, data: cached.data })
  }), [cacheResource, identity, user])

  useEffect(() => {
    if (!activeDiet || !token || !user) {
      setResourceState({ identity: '', data: emptyData })
      setLoading(false)
      setError('')
      return
    }

    let cancelled = false
    const cached = isDemoMode ? null : readCachedResource<T>(user.id, cacheResource)
    setResourceState({ identity, data: cached?.data ?? emptyData })
    setLoading(!cached)
    setError('')

    if (cached?.fresh) return

    const shared = isDemoMode
      ? { promise: Promise.resolve(demoData), release: () => undefined, startedAt: Date.now() }
      : acquireRequest(`${user.id}:${cacheResource}`, (signal) => api<T>(`/diets/${activeDiet.id}/${resource}`, { token, signal }))
    const requestCacheRevision = resourceCacheRevision(user.id, cacheResource)
    const requestStartedAt = shared.startedAt

    shared.promise
      .then((responseData) => {
        if (!cancelled) {
          if (!isDemoMode && (resourceCacheRevision(user.id, cacheResource) !== requestCacheRevision
              || resourceCacheSavedAt(user.id, cacheResource) >= requestStartedAt)) {
            const latest = readCachedResource<T>(user.id, cacheResource)
            if (latest) setResourceState({ identity, data: latest.data })
            return
          }
          if (!isDemoMode) writeCachedResource(user.id, cacheResource, responseData)
          setResourceState({ identity, data: responseData })
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(getErrorMessage(requestError, fallbackError))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      shared.release()
    }
  }, [activeDiet, demoData, emptyData, fallbackError, resource, revision, token, user])

  return {
    data: resourceState.identity === identity ? resourceState.data : renderedCache?.data ?? emptyData,
    loading: resourceState.identity === identity ? loading : Boolean(identity && !renderedCache),
    error,
    reload: () => {
      if (activeDiet && user) expireCachedResource(user.id, dietResourceKey(activeDiet.id, resource))
      setRevision((current) => current + 1)
    },
  }
}
