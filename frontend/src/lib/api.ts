import { API_URL } from './apiConfig'
import { markApiUnavailable, prepareApi } from './serverWakeup'

type RequestOptions = RequestInit & { token?: string | null; skipRefresh?: boolean }
type ErrorResponse = { message?: string }

export const UNAUTHORIZED_EVENT = 'Dietaday:unauthorized'
export const TOKEN_REFRESHED_EVENT = 'Dietaday:token-refreshed'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export { isDemoMode } from './apiConfig'

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError || (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message))) {
    return 'Não foi possível conectar ao aplicativo. Verifique sua conexão e tente novamente.'
  }
  return error instanceof Error ? error.message : fallback
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null &&
    (!('message' in value) || typeof value.message === 'string')
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  await prepareApi()
  const { token, headers, skipRefresh, ...init } = options
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: init.credentials ?? 'include',
      headers: {
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        'X-Requested-With': 'Dietaday',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    })
  } catch (error) {
    if (init.signal?.aborted) throw error
    markApiUnavailable()
    throw new Error('Não foi possível conectar ao aplicativo. Verifique sua conexão e tente novamente.', { cause: error })
  }

  if ([502, 503, 504].includes(response.status)) {
    markApiUnavailable()
    throw new Error('O aplicativo está temporariamente indisponível. Aguarde alguns segundos e tente novamente.')
  }

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null)
    if (response.status === 401 && token && !skipRefresh) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        return api<T>(path, { ...options, token: refreshed.token, skipRefresh: true })
      }
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    const message = isErrorResponse(data) ? data.message : undefined
    throw new ApiError(message || 'Não foi possível concluir a solicitação.', response.status)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function refreshAccessToken(): Promise<import('../types').AuthResponse | null> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'Dietaday' },
    })
    if (!response.ok) return null
    const data = await response.json() as import('../types').AuthResponse
    window.dispatchEvent(new CustomEvent(TOKEN_REFRESHED_EVENT, { detail: data }))
    return data
  } catch {
    return null
  }
}
