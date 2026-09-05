const configuredApiUrl: unknown = import.meta.env.VITE_API_URL
const API_URL = typeof configuredApiUrl === 'string' ? configuredApiUrl.replace(/\/$/, '') : ''

type RequestOptions = RequestInit & { token?: string | null }
type ErrorResponse = { message?: string }

export const UNAUTHORIZED_EVENT = 'Dietaday:unauthorized'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const isDemoMode = !API_URL

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null &&
    (!('message' in value) || typeof value.message === 'string')
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...init } = options
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null)
    if (response.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    const message = isErrorResponse(data) ? data.message : undefined
    throw new ApiError(message || 'Não foi possível concluir a solicitação.', response.status)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
