const configuredApiUrl: unknown = import.meta.env.VITE_API_URL

export const API_URL = typeof configuredApiUrl === 'string' ? configuredApiUrl.replace(/\/$/, '') : ''
export const isDemoMode = !API_URL
