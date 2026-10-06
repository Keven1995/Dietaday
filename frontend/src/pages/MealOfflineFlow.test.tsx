// @vitest-environment jsdom

import 'fake-indexeddb/auto'
// @ts-expect-error Vitest runs on Node; frontend source types intentionally omit @types/node.
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setReducedMotionPreference } from '../test/matchMedia'

const flow = vi.hoisted(() => ({
  api: vi.fn(),
  uploadPhoto: vi.fn(),
  user: { id: 'offline-flow-user', fullName: 'Pessoa Offline', email: 'offline@example.com' },
  diet: { id: 'offline-flow-diet', name: 'Dieta offline', startDate: '2026-10-01', endDate: '2026-10-31', competitiveMode: false },
  online: false,
  scenario: 'lost-create-response',
  postAttempts: [] as string[],
  postBodies: [] as Array<{ idempotencyKey: string; body: Record<string, unknown> }>,
  uploadAttempts: 0,
  serverMeals: new Map<string, unknown>(),
}))

vi.mock('../lib/api', () => ({
  api: flow.api,
  isDemoMode: false,
  getErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
  ApiError: class ApiError extends Error {
    readonly status: number
    constructor(message: string, status: number) { super(message); this.status = status }
  },
}))

vi.mock('../lib/cloudinary', () => ({
  PhotoUploadError: class PhotoUploadError extends Error {
    readonly status: number
    constructor(message: string, status: number) { super(message); this.status = status }
  },
  isPhotoUploadConfigured: true,
  validatePhoto: vi.fn(),
  compressPhoto: vi.fn(async (file: File) => file),
  uploadPhoto: flow.uploadPhoto,
}))

vi.mock('../lib/uxTelemetry', () => ({ reportUxEvent: vi.fn(), createUxEventId: () => 'test-event' }))
vi.mock('../lib/syncTelemetry', () => ({ reportSyncEvent: vi.fn(async () => undefined) }))
vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({ token: 'offline-flow-token', user: flow.user }),
}))
vi.mock('../state/DietContext', () => ({
  useDiets: () => ({
    activeDiet: flow.diet,
    diets: [flow.diet],
    activeDietId: flow.diet.id,
    loading: false,
    error: '',
    selectDiet: vi.fn(),
    createDiet: vi.fn(),
    deleteDiet: vi.fn(),
    reload: vi.fn(async () => undefined),
  }),
}))
vi.mock('../state/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../state/CelebrationContext', () => ({ useCelebration: () => ({ active: null, celebrate: vi.fn() }) }))

import { History } from './History'
import { MealForm } from './MealForm'
import { listOfflineMeals, removeOfflineMeal, saveOfflineMeal } from '../lib/offlineMeals'
import { OfflineMealProvider } from '../state/OfflineMealContext'

type TestRequestOptions = {
  method?: string
  headers?: Record<string, string>
  body?: BodyInit | null
}

let createObjectUrlDescriptor: PropertyDescriptor | undefined
let revokeObjectUrlDescriptor: PropertyDescriptor | undefined
let blobDescriptor: PropertyDescriptor | undefined
let fileDescriptor: PropertyDescriptor | undefined

function renderMealFlow() {
  return render(
    <MemoryRouter initialEntries={['/refeicoes/nova']}>
      <OfflineMealProvider>
        <Routes>
          <Route path="/refeicoes/nova" element={<MealForm />} />
          <Route path="/historico" element={<History />} />
        </Routes>
      </OfflineMealProvider>
    </MemoryRouter>,
  )
}

async function saveLocallyAndOpenHistory(description: string, photo?: File) {
  fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: description } })
  if (photo) {
    const photoInput = document.querySelector<HTMLInputElement>('.photo-input input[type="file"]')
    if (!photoInput) throw new Error('Campo de foto não encontrado')
    fireEvent.change(photoInput, { target: { files: [photo] } })
  }

  fireEvent.click(screen.getByRole('button', { name: 'Salvar refeição' }))
  await waitFor(() => expect(screen.getByRole('link', { name: 'Ver histórico' })).toBeTruthy())
  const saveButton = screen.getByRole('button', { name: /Aguardando sincronização/ }) as HTMLButtonElement
  expect(saveButton.disabled).toBe(true)
  fireEvent.click(screen.getByRole('link', { name: 'Ver histórico' }))
  await waitFor(() => expect(screen.getByText('Aguardando sincronização')).toBeTruthy())
}

async function retryAfterConnection() {
  const queued = await listOfflineMeals(flow.user.id)
  expect(queued).toHaveLength(1)
  await saveOfflineMeal({ ...queued[0], status: 'pending', nextRetryAt: 0 })
  flow.online = true
  await act(async () => { window.dispatchEvent(new Event('online')) })
}

describe('offline meal flow from form to history', () => {
  beforeEach(() => {
    flow.user = { id: `offline-user-${Date.now()}-${Math.random()}`, fullName: 'Pessoa Offline', email: 'offline@example.com' }
    flow.diet = { id: `offline-diet-${Date.now()}-${Math.random()}`, name: 'Dieta offline', startDate: '2026-10-01', endDate: '2026-10-31', competitiveMode: false }
    flow.online = false
    flow.scenario = 'lost-create-response'
    flow.postAttempts = []
    flow.postBodies = []
    flow.uploadAttempts = 0
    flow.serverMeals.clear()
    flow.api.mockReset()
    flow.uploadPhoto.mockReset()
    vi.stubEnv('VITE_FEATURE_DISCOVERY_ENABLED', 'false')
    setReducedMotionPreference(true)
    blobDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Blob')
    fileDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'File')
    Object.defineProperty(globalThis, 'Blob', { configurable: true, value: NodeBlob })
    Object.defineProperty(globalThis, 'File', { configurable: true, value: NodeFile })
    createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:queued-meal-photo') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })

    flow.api.mockImplementation(async (path: string, options: TestRequestOptions = {}) => {
      const mealsPath = `/diets/${flow.diet.id}/meals`
      if (path === `${mealsPath}/social/status`) return true
      if (path === mealsPath && (options.method ?? 'GET') === 'GET') {
        return flow.online ? [...flow.serverMeals.values()] : []
      }
      if (path === mealsPath && options.method === 'POST') {
        const idempotencyKey = options.headers?.['Idempotency-Key'] ?? ''
        const body = JSON.parse(String(options.body)) as Record<string, unknown>
        flow.postAttempts.push(idempotencyKey)
        flow.postBodies.push({ idempotencyKey, body })
        let saved = flow.serverMeals.get(idempotencyKey) as Record<string, unknown> | undefined
        if (!saved) {
          saved = {
            id: `server-meal-${flow.serverMeals.size + 1}`,
            mealType: body.mealType,
            description: body.description,
            mealDate: body.mealDate,
            photoUrl: body.photoUrl ?? null,
            authorId: flow.user.id,
            authorName: flow.user.fullName,
            createdAt: new Date().toISOString(),
            reactions: [],
            commentCount: 0,
            pointsEarned: 0,
          }
          flow.serverMeals.set(idempotencyKey, saved)
        }
        if (flow.scenario === 'lost-create-response' && flow.postAttempts.length === 1) {
          throw new TypeError('Conexão interrompida após o envio')
        }
        return saved
      }
      throw new Error(`Solicitação inesperada no teste: ${options.method ?? 'GET'} ${path}`)
    })

    flow.uploadPhoto.mockImplementation(async () => {
      flow.uploadAttempts += 1
      if (flow.scenario === 'photo-upload-retry' && flow.uploadAttempts === 1) {
        throw new TypeError('Conexão interrompida durante o upload')
      }
      return 'https://images.example.test/meal.jpg'
    })
  })

  afterEach(async () => {
    cleanup()
    const queued = await listOfflineMeals(flow.user.id).catch(() => [])
    for (const operation of queued) await removeOfflineMeal(operation.id)
    localStorage.clear()
    sessionStorage.clear()
    vi.unstubAllEnvs()
    if (createObjectUrlDescriptor) Object.defineProperty(URL, 'createObjectURL', createObjectUrlDescriptor)
    else Reflect.deleteProperty(URL, 'createObjectURL')
    if (revokeObjectUrlDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrlDescriptor)
    else Reflect.deleteProperty(URL, 'revokeObjectURL')
    if (blobDescriptor) Object.defineProperty(globalThis, 'Blob', blobDescriptor)
    else Reflect.deleteProperty(globalThis, 'Blob')
    if (fileDescriptor) Object.defineProperty(globalThis, 'File', fileDescriptor)
    else Reflect.deleteProperty(globalThis, 'File')
  })

  it('retains a locally saved meal in history and retries an ambiguous create once by idempotency key', async () => {
    renderMealFlow()
    await saveLocallyAndOpenHistory('Aveia com frutas')
    await waitFor(() => expect(flow.postAttempts).toHaveLength(1))
    expect(flow.postAttempts).toHaveLength(1)
    expect(flow.serverMeals).toHaveLength(1)
    expect(screen.getByText('Aveia com frutas')).toBeTruthy()

    await retryAfterConnection()
    await waitFor(() => expect(flow.postAttempts).toHaveLength(2))
    await waitFor(() => expect(screen.queryByText('Aguardando sincronização')).toBeNull())

    expect(flow.postAttempts[1]).toBe(flow.postAttempts[0])
    expect(flow.serverMeals).toHaveLength(1)
    expect(screen.getAllByText('Aveia com frutas')).toHaveLength(1)
  })

  it('keeps the photo in IndexedDB through an offline upload failure and uploads once after retry', async () => {
    flow.scenario = 'photo-upload-retry'
    renderMealFlow()
    const photo = new NodeFile(['photo-bytes'], 'meal.jpg', { type: 'image/jpeg' })
    await saveLocallyAndOpenHistory('Salada com grãos', photo)
    await waitFor(() => expect(flow.uploadAttempts).toBe(1))
    expect(flow.uploadAttempts).toBe(1)
    expect(flow.postAttempts).toHaveLength(0)
    expect(screen.getByAltText('Refeição: Salada com grãos')).toBeTruthy()

    const queuedBeforeRetry = await listOfflineMeals(flow.user.id)
    expect(queuedBeforeRetry[0].photo).toBeInstanceOf(Blob)
    expect(await queuedBeforeRetry[0].photo?.text()).toBe('photo-bytes')

    await retryAfterConnection()
    await waitFor(() => expect(flow.postAttempts).toHaveLength(1))
    await waitFor(() => expect(screen.queryByText('Aguardando sincronização')).toBeNull())

    expect(flow.uploadAttempts).toBe(2)
    expect(flow.serverMeals).toHaveLength(1)
    expect(flow.postBodies[0].body.photoUrl).toBe('https://images.example.test/meal.jpg')
    expect(screen.getAllByText('Salada com grãos')).toHaveLength(1)
  })
})
