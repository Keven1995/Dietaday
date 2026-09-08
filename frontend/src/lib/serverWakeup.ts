import { api, isDemoMode } from './api'

const READY_FOR_MS = 5 * 60_000
const FIRST_REQUEST_TIMEOUT_MS = 70_000
const RETRY_TIMEOUT_MS = 20_000
let readyAt = 0
let wakeupRequest: Promise<void> | null = null

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

async function requestHealth() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timeout = window.setTimeout(
      () => controller.abort(),
      attempt === 0 ? FIRST_REQUEST_TIMEOUT_MS : RETRY_TIMEOUT_MS,
    )
    try {
      const health = await api<{ status: string }>('/health', { signal: controller.signal })
      if (health.status !== 'UP') throw new Error('API unavailable')
      readyAt = Date.now()
      return
    } catch (error) {
      if (attempt === 2) {
        throw new Error('Não foi possível preparar o aplicativo. Verifique sua conexão e tente novamente.', { cause: error })
      }
      await delay(1500 * (attempt + 1))
    } finally {
      window.clearTimeout(timeout)
    }
  }
}

export function prepareApi() {
  if (isDemoMode || Date.now() - readyAt < READY_FOR_MS) return Promise.resolve()
  if (!wakeupRequest) {
    wakeupRequest = requestHealth().finally(() => { wakeupRequest = null })
  }
  return wakeupRequest
}
