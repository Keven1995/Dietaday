import { API_URL, isDemoMode } from './apiConfig'

const READY_FOR_MS = 5 * 60_000
const FIRST_REQUEST_TIMEOUT_MS = 70_000
const RETRY_TIMEOUT_MS = 20_000
let readyAt = 0
let wakeupRequest: Promise<void> | null = null

export const SERVER_STATUS_EVENT = 'Dietaday:server-status'
export type ServerStatus = 'waking' | 'ready' | 'failed'

function announce(status: ServerStatus) {
  window.dispatchEvent(new CustomEvent<ServerStatus>(SERVER_STATUS_EVENT, { detail: status }))
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

async function requestHealth() {
  let announced = false
  const noticeTimer = window.setTimeout(() => {
    announced = true
    announce('waking')
  }, 500)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timeout = window.setTimeout(
      () => controller.abort(),
      attempt === 0 ? FIRST_REQUEST_TIMEOUT_MS : RETRY_TIMEOUT_MS,
    )
    try {
      const response = await fetch(`${API_URL}/health`, { signal: controller.signal })
      if (!response.ok) throw new Error(`Health check failed with status ${response.status}`)
      const health = await response.json() as { status?: unknown }
      if (health.status !== 'UP') throw new Error('API unavailable')
      readyAt = Date.now()
      window.clearTimeout(noticeTimer)
      if (announced) announce('ready')
      return
    } catch (error) {
      if (attempt === 2) {
        window.clearTimeout(noticeTimer)
        if (announced) announce('failed')
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

export function markApiUnavailable() {
  readyAt = 0
  announce('failed')
}
