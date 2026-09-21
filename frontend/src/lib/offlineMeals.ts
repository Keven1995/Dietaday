import type { CreateMealRequest } from '../types'

const DATABASE_NAME = 'Dietaday_offline'
const STORE_NAME = 'meal_queue'
const MAX_QUEUED_MEALS = 30
const SYNC_LEASE_MS = 5 * 60_000
const QUEUE_SIGNAL_KEY = 'Dietaday_meal_queue_signal'
let databasePromise: Promise<IDBDatabase> | null = null

export type OfflineMealStatus = 'pending' | 'syncing' | 'failed'
export type OfflineMealPhase = 'queued' | 'signature' | 'cloudinary-upload' | 'cloudinary-uploaded' | 'meal-create' | 'completed'

export type OfflineMealOperation = {
  id: string
  userId: string
  dietId: string
  dietName: string
  authorName: string
  request: Omit<CreateMealRequest, 'photoUrl'>
  photo?: Blob
  photoName?: string
  uploadedPhotoUrl?: string
  status: OfflineMealStatus
  phase?: OfflineMealPhase
  error?: string
  debugError?: string
  attempts: number
  nextRetryAt?: number
  lastAttemptAt?: string
  lastFailureAt?: string
  lastHttpStatus?: number
  createdAt: string
  syncOwner?: string
  syncLeaseUntil?: number
}

export function toStoredPhoto(photo: File | null | undefined) {
  if (!photo) return undefined
  return new Blob([photo], { type: photo.type || 'application/octet-stream' })
}

const listeners = new Set<() => void>()
const queueChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('Dietaday_meal_queue')
  : null

queueChannel?.addEventListener('message', () => notify())
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === QUEUE_SIGNAL_KEY) notify()
  })
}

function notify(broadcast = false) {
  for (const listener of listeners) listener()
  if (broadcast) {
    queueChannel?.postMessage('changed')
    try {
      localStorage.setItem(QUEUE_SIGNAL_KEY, `${Date.now()}:${Math.random()}`)
    } catch {
      // IndexedDB remains authoritative if cross-tab signaling is unavailable.
    }
  }
}

function openDatabase() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('Este navegador não oferece armazenamento offline.'))
  if (databasePromise) return databasePromise
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      store.createIndex('userId', 'userId')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir a fila offline.'))
    request.onblocked = () => reject(new Error('Feche outras abas do Dietaday e tente novamente.'))
  })
  databasePromise.catch(() => { databasePromise = null })
  return databasePromise
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha no armazenamento offline.'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Falha no armazenamento offline.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Operação offline cancelada.'))
  })
}

export async function listOfflineMeals(userId: string) {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readonly')
  const operations = await requestResult(transaction.objectStore(STORE_NAME).index('userId').getAll(userId)) as OfflineMealOperation[]
  return operations.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export async function addOfflineMeal(operation: OfflineMealOperation) {
  const existing = await listOfflineMeals(operation.userId)
  if (existing.length >= MAX_QUEUED_MEALS) {
    throw new Error('A fila offline atingiu o limite de 30 refeições. Conecte-se para sincronizar antes de adicionar outras.')
  }
  await saveOfflineMeal(operation)
  if (typeof navigator !== 'undefined') void navigator.storage?.persist?.().catch(() => false)
}

export async function saveOfflineMeal(operation: OfflineMealOperation) {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).put(operation)
  await transactionDone(transaction)
  notify(true)
}

export async function claimOfflineMeal(id: string, syncOwner: string) {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  const operation = await requestResult(store.get(id)) as OfflineMealOperation | undefined
  if (!operation || operation.status === 'failed'
      || (operation.status === 'syncing' && operation.syncOwner !== syncOwner && (operation.syncLeaseUntil ?? 0) > Date.now())) {
    return null
  }
  const claimed: OfflineMealOperation = {
    ...operation,
    status: 'syncing',
    error: undefined,
    syncOwner,
    syncLeaseUntil: Date.now() + SYNC_LEASE_MS,
  }
  store.put(claimed)
  await transactionDone(transaction)
  notify(true)
  return claimed
}

export async function saveClaimedOfflineMeal(operation: OfflineMealOperation, syncOwner: string) {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  const current = await requestResult(store.get(operation.id)) as OfflineMealOperation | undefined
  if (!current || current.syncOwner !== syncOwner) return false
  store.put(operation)
  await transactionDone(transaction)
  notify(true)
  return true
}

export async function removeClaimedOfflineMeal(id: string, syncOwner: string) {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  const current = await requestResult(store.get(id)) as OfflineMealOperation | undefined
  if (!current || current.syncOwner !== syncOwner) return false
  store.delete(id)
  await transactionDone(transaction)
  notify(true)
  return true
}

export async function removeOfflineMeal(id: string) {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).delete(id)
  await transactionDone(transaction)
  notify(true)
}

export function subscribeOfflineMeals(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
