import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, api, getErrorMessage, isDemoMode } from '../lib/api'
import { PhotoUploadError, uploadPhoto } from '../lib/cloudinary'
import { dietResourceKey, readCachedResource, writeCachedResource } from '../lib/resourceCache'
import { SERVER_STATUS_EVENT, type ServerStatus } from '../lib/serverWakeup'
import {
  addOfflineMeal,
  claimOfflineMeal,
  listOfflineMeals,
  removeOfflineMeal,
  removeClaimedOfflineMeal,
  saveClaimedOfflineMeal,
  saveOfflineMeal,
  subscribeOfflineMeals,
  toStoredPhoto,
  type OfflineMealOperation,
} from '../lib/offlineMeals'
import type { CreateMealRequest, Meal } from '../types'
import { createUuid } from '../lib/uuid'
import { useAuth } from './AuthContext'

type QueueMealInput = {
  operationId?: string
  dietId: string
  dietName: string
  request: Omit<CreateMealRequest, 'photoUrl'>
  photo?: File | null
}

type OfflineMealContextValue = {
  operations: OfflineMealOperation[]
  offlineMeals: Meal[]
  syncing: boolean
  enqueue: (input: QueueMealInput) => Promise<void>
  retry: (id: string) => Promise<void>
  discard: (id: string) => Promise<void>
  syncNow: () => Promise<void>
}

const OfflineMealContext = createContext<OfflineMealContextValue | null>(null)
const activeSyncs = new Map<string, Promise<void>>()
const syncOwner = createUuid()

function isPermanentFailure(error: unknown) {
  const status = error instanceof ApiError || error instanceof PhotoUploadError ? error.status : 0
  return status >= 400 && status < 500 && ![401, 408, 429].includes(status)
}

async function synchronize(userId: string, token: string) {
  if (activeSyncs.has(userId)) return activeSyncs.get(userId)!
  const synchronization = (async () => {
    const operations = await listOfflineMeals(userId)
    for (const stored of operations) {
      if (stored.status === 'failed') continue
      const claimed = await claimOfflineMeal(stored.id, syncOwner)
      if (!claimed) continue
      let operation = claimed
      try {
        if (operation.photo && !operation.uploadedPhotoUrl) {
          const controller = new AbortController()
          const timeout = window.setTimeout(() => controller.abort(), 60_000)
          try {
            const uploadedPhotoUrl = await uploadPhoto(operation.photo, operation.photoName ?? 'refeicao.jpg', token, controller.signal)
            operation = { ...operation, uploadedPhotoUrl }
            if (!await saveClaimedOfflineMeal(operation, syncOwner)) continue
          } finally {
            window.clearTimeout(timeout)
          }
        }

        const renewed = await claimOfflineMeal(operation.id, syncOwner)
        if (!renewed) continue
        operation = renewed
        const created = await api<Meal>(`/diets/${operation.dietId}/meals`, {
          method: 'POST',
          token,
          headers: { 'Idempotency-Key': operation.id },
          body: JSON.stringify({ ...operation.request, photoUrl: operation.uploadedPhotoUrl ?? null }),
        })
        const resource = dietResourceKey(operation.dietId, 'meals')
        const cachedMeals = readCachedResource<Meal[]>(userId, resource)?.data ?? []
        writeCachedResource(userId, resource, [
          created,
          ...cachedMeals.filter((meal) => meal.id !== created.id),
        ])
        await removeClaimedOfflineMeal(operation.id, syncOwner)
      } catch (error) {
        const failureSaved = await saveClaimedOfflineMeal({
          ...operation,
          status: isPermanentFailure(error) ? 'failed' : 'pending',
          attempts: operation.attempts + 1,
          error: getErrorMessage(error, 'Não foi possível sincronizar esta refeição.'),
          syncOwner: undefined,
          syncLeaseUntil: undefined,
        }, syncOwner)
        if (failureSaved && !isPermanentFailure(error)) break
      }
    }
  })().finally(() => activeSyncs.delete(userId))
  activeSyncs.set(userId, synchronization)
  return synchronization
}

export function OfflineMealProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth()
  const [operations, setOperations] = useState<OfflineMealOperation[]>([])
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (!user) {
        setOperations([])
        return
      }
      const queued = await listOfflineMeals(user.id).catch(() => [])
      if (active) setOperations(queued)
    }
    void refresh()
    const unsubscribe = subscribeOfflineMeals(() => void refresh())
    return () => {
      active = false
      unsubscribe()
    }
  }, [user])

  async function syncNow() {
    if (!user || !token || isDemoMode) return
    setSyncing(true)
    try {
      await synchronize(user.id, token)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (!user || !token || isDemoMode) return
    const trigger = () => void syncNow().catch(() => undefined)
    const handleVisibility = () => { if (document.visibilityState === 'visible') trigger() }
    const handleServerStatus = (event: Event) => {
      if ((event as CustomEvent<ServerStatus>).detail === 'ready') trigger()
    }
    trigger()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') trigger()
    }, 30_000)
    window.addEventListener('online', trigger)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener(SERVER_STATUS_EVENT, handleServerStatus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', trigger)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener(SERVER_STATUS_EVENT, handleServerStatus)
    }
  }, [token, user?.id])

  async function enqueue(input: QueueMealInput) {
    if (!user) throw new Error('Sua sessão expirou. Entre novamente.')
    const existing = input.operationId ? operations.find((operation) => operation.id === input.operationId) : undefined
    const operation: OfflineMealOperation = {
      id: existing?.id ?? createUuid(),
      userId: user.id,
      dietId: input.dietId,
      dietName: input.dietName,
      authorName: user.fullName,
      request: input.request,
      photo: input.photo === undefined ? existing?.photo : toStoredPhoto(input.photo),
      photoName: input.photo === undefined ? existing?.photoName : input.photo?.name,
      uploadedPhotoUrl: input.photo === undefined ? existing?.uploadedPhotoUrl : undefined,
      status: 'pending',
      attempts: existing?.attempts ?? 0,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      syncOwner: undefined,
      syncLeaseUntil: undefined,
    }
    if (existing) await saveOfflineMeal(operation)
    else await addOfflineMeal(operation)
    void syncNow().catch(() => undefined)
  }

  async function retry(id: string) {
    const operation = operations.find((item) => item.id === id)
    if (!operation) return
    await saveOfflineMeal({ ...operation, status: 'pending', error: undefined })
    void syncNow().catch(() => undefined)
  }

  const offlineMeals: Meal[] = operations.map((operation) => ({
    id: `offline-${operation.id}`,
    mealType: operation.request.mealType,
    description: operation.request.description,
    mealDate: operation.request.mealDate,
    photoUrl: operation.uploadedPhotoUrl ?? null,
    authorId: operation.userId,
    authorName: operation.authorName,
    createdAt: operation.createdAt,
    syncStatus: operation.status,
    syncError: operation.error,
    operationId: operation.id,
  }))

  return (
    <OfflineMealContext.Provider value={{
      operations,
      offlineMeals,
      syncing,
      enqueue,
      retry,
      discard: removeOfflineMeal,
      syncNow,
    }}>
      {children}
    </OfflineMealContext.Provider>
  )
}

export function useOfflineMeals() {
  const context = useContext(OfflineMealContext)
  if (!context) throw new Error('useOfflineMeals deve ser usado dentro de OfflineMealProvider')
  return context
}
