import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, api, isDemoMode } from '../lib/api'
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
import { reportSyncEvent, type SyncTelemetryPhase } from '../lib/syncTelemetry'
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
const SYNC_ERROR_MESSAGE = 'Não foi possível sincronizar esta refeição agora. Ela continua salva neste dispositivo.'
const RETRY_DELAYS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000]
const MEAL_CREATE_TIMEOUT_MS = 60_000

class SyncPersistenceError extends Error {
  constructor() {
    super('A fila offline perdeu a posse da operação.')
    this.name = 'SyncPersistenceError'
  }
}

class SyncTimeoutError extends Error {
  constructor(phase: string) {
    super(`${phase}-timeout`)
    this.name = 'SyncTimeoutError'
  }
}

function isPermanentFailure(error: unknown) {
  const status = error instanceof ApiError || error instanceof PhotoUploadError ? error.status : 0
  return status >= 400 && status < 500 && ![401, 408, 429].includes(status)
}

function diagnosticErrorType(error: unknown) {
  if (error instanceof PhotoUploadError) return error.status ? `cloudinary-http-${error.status}` : 'cloudinary-no-response'
  if (error instanceof ApiError) return `api-http-${error.status}`
  if (error instanceof SyncPersistenceError) return 'offline-persistence'
  if (error instanceof SyncTimeoutError) return error.message
  if (error instanceof DOMException && error.name === 'AbortError') return 'upload-timeout'
  if (error instanceof Error) return error.name || 'Error'
  return 'UnknownError'
}

async function synchronize(userId: string, token: string) {
  if (activeSyncs.has(userId)) return activeSyncs.get(userId)!
  const synchronization = (async () => {
    const operations = await listOfflineMeals(userId)
    for (const stored of operations) {
      if (stored.status === 'failed') continue
      if (stored.status === 'pending' && (stored.nextRetryAt ?? 0) > Date.now()) continue
      const claimed = await claimOfflineMeal(stored.id, syncOwner)
      if (!claimed) continue
      let operation = claimed
      const syncStartedAt = Date.now()
      const updatePhase = async (phase: SyncTelemetryPhase) => {
        operation = { ...operation, phase, lastAttemptAt: new Date().toISOString() }
        if (!await saveClaimedOfflineMeal(operation, syncOwner)) throw new SyncPersistenceError()
        void reportSyncEvent(token, {
          operationId: operation.id,
          dietId: operation.dietId,
          phase,
          attempt: operation.attempts + 1,
          fileType: operation.photo?.type,
          fileSizeBytes: operation.photo?.size,
        })
      }
      try {
        if (operation.photo && !operation.uploadedPhotoUrl) {
          const controller = new AbortController()
          const timeout = window.setTimeout(() => controller.abort(), 120_000)
          try {
            const uploadedPhotoUrl = await uploadPhoto(
              operation.photo,
              operation.photoName ?? 'refeicao.jpg',
              token,
              controller.signal,
              updatePhase,
            )
            operation = { ...operation, uploadedPhotoUrl }
            if (!await saveClaimedOfflineMeal(operation, syncOwner)) throw new SyncPersistenceError()
          } finally {
            window.clearTimeout(timeout)
          }
        }

        const renewed = await claimOfflineMeal(operation.id, syncOwner)
        if (!renewed) continue
        operation = renewed
        await updatePhase('meal-create')
        const mealController = new AbortController()
        const mealTimeout = window.setTimeout(() => mealController.abort(), MEAL_CREATE_TIMEOUT_MS)
        let created: Meal
        try {
          created = await api<Meal>(`/diets/${operation.dietId}/meals`, {
            method: 'POST',
            token,
            signal: mealController.signal,
            headers: { 'Idempotency-Key': operation.id },
            body: JSON.stringify({ ...operation.request, photoUrl: operation.uploadedPhotoUrl ?? null }),
          })
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw new SyncTimeoutError('meal-create')
          }
          throw error
        } finally {
          window.clearTimeout(mealTimeout)
        }
        const resource = dietResourceKey(operation.dietId, 'meals')
        const cachedMeals = readCachedResource<Meal[]>(userId, resource)?.data ?? []
        writeCachedResource(userId, resource, [
          created,
          ...cachedMeals.filter((meal) => meal.id !== created.id),
        ])
        operation = { ...operation, phase: 'completed' }
        void reportSyncEvent(token, {
          operationId: operation.id,
          dietId: operation.dietId,
          phase: 'completed',
          attempt: operation.attempts + 1,
          durationMs: Date.now() - syncStartedAt,
          fileType: operation.photo?.type,
          fileSizeBytes: operation.photo?.size,
        })
        await removeClaimedOfflineMeal(operation.id, syncOwner)
      } catch (error) {
        const status = error instanceof ApiError || error instanceof PhotoUploadError ? error.status : 0
        const permanent = isPermanentFailure(error)
        const failureSaved = await saveClaimedOfflineMeal({
          ...operation,
          status: permanent ? 'failed' : 'pending',
          attempts: operation.attempts + 1,
          error: SYNC_ERROR_MESSAGE,
          debugError: `${operation.phase ?? 'unknown'}:${error instanceof Error ? error.name : 'UnknownError'}`,
          nextRetryAt: permanent ? undefined : Date.now() + RETRY_DELAYS_MS[Math.min(operation.attempts, RETRY_DELAYS_MS.length - 1)],
          lastAttemptAt: new Date().toISOString(),
          lastFailureAt: new Date().toISOString(),
          lastHttpStatus: status || undefined,
          syncOwner: undefined,
          syncLeaseUntil: undefined,
        }, syncOwner)
        if (failureSaved) {
          void reportSyncEvent(token, {
            operationId: operation.id,
            dietId: operation.dietId,
            phase: operation.phase === 'signature' || operation.phase === 'cloudinary-upload' || operation.phase === 'meal-create'
              ? operation.phase
              : operation.phase === 'cloudinary-uploaded' ? 'cloudinary-uploaded' : 'meal-create',
            attempt: operation.attempts + 1,
            durationMs: Date.now() - syncStartedAt,
            httpStatus: status,
            errorType: diagnosticErrorType(error),
            fileType: operation.photo?.type,
            fileSizeBytes: operation.photo?.size,
          })
        }
        if (failureSaved && !permanent) break
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
      phase: 'queued',
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
    await saveOfflineMeal({
      ...operation,
      status: 'pending',
      phase: 'queued',
      error: undefined,
      debugError: undefined,
      nextRetryAt: undefined,
    })
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
