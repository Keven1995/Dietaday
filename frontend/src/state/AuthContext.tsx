import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, isDemoMode, TOKEN_REFRESHED_EVENT, UNAUTHORIZED_EVENT } from '../lib/api'
import { clearUserCache } from '../lib/resourceCache'
import type { AuthResponse, RegisterRequest, UpdateProfileRequest, User, UserSex } from '../types'
import { createUuid } from '../lib/uuid'

type AuthContextValue = {
  user: User | null
  token: string | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  updateUser: (data: UpdateProfileRequest) => Promise<void>
  logout: () => void
  logoutAll: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isStoredUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false
  return 'id' in value && typeof value.id === 'string' &&
    'email' in value && typeof value.email === 'string' &&
    'fullName' in value && typeof value.fullName === 'string' &&
    (!('sex' in value) || value.sex === 'MALE' || value.sex === 'FEMALE' || value.sex === 'NEUTRAL')
}

function readStoredUser(): User | null {
  try {
    const stored = localStorage.getItem('Dietaday_user')
    if (!stored) return null
    const value: unknown = JSON.parse(stored)
    if (!isStoredUser(value)) return null
    return { ...value, sex: value.sex === 'MALE' || value.sex === 'FEMALE' || value.sex === 'NEUTRAL' ? value.sex : 'NEUTRAL' }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(() => isDemoMode ? readStoredUser() : null)
  const [ready, setReady] = useState(isDemoMode)

  function persist(data: AuthResponse) {
    const authenticatedUser: User = { id: data.userId, email: data.email, fullName: data.fullName, sex: data.sex }
    localStorage.setItem('Dietaday_user', JSON.stringify(authenticatedUser))
    setToken(data.token)
    setUser(authenticatedUser)
  }

  useEffect(() => {
    localStorage.removeItem('Dietaday_token')
    if (isDemoMode) return
    api<AuthResponse>('/auth/refresh', { method: 'POST', skipRefresh: true })
      .then(persist)
      .catch(() => undefined)
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!token || isDemoMode) return
    const controller = new AbortController()
    api<User>('/profile', { token, signal: controller.signal })
      .then((profile) => {
        if (controller.signal.aborted) return
        localStorage.setItem('Dietaday_user', JSON.stringify(profile))
        setUser(profile)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [token])

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout)
    const onTokenRefreshed = (event: Event) => {
      const data = (event as CustomEvent<AuthResponse>).detail
      if (data) persist(data)
    }
    window.addEventListener(TOKEN_REFRESHED_EVENT, onTokenRefreshed)
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, logout)
      window.removeEventListener(TOKEN_REFRESHED_EVENT, onTokenRefreshed)
    }
  })

  async function login(email: string, password: string) {
    const data = isDemoMode
      ? { token: 'demo-jwt-token', userId: '1', fullName: 'Marina Alves', email, sex: 'FEMALE' as UserSex }
      : await api<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    persist(data)
  }

  async function register(data: RegisterRequest) {
    const response = isDemoMode
      ? { token: 'demo-jwt-token', userId: createUuid(), fullName: data.fullName, email: data.email, sex: data.sex }
      : await api<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) })
    persist(response)
  }

  async function updateUser(changes: UpdateProfileRequest) {
    if (!user) return
    const updated = isDemoMode
      ? { ...user, ...changes }
      : await api<User>('/profile', { method: 'PUT', token, body: JSON.stringify(changes) })
    localStorage.setItem('Dietaday_user', JSON.stringify(updated))
    setUser(updated)
  }

  function logout() {
    if (!isDemoMode) void api('/auth/logout', { method: 'POST', skipRefresh: true }).catch(() => undefined)
    if (user) clearUserCache(user.id)
    localStorage.removeItem('Dietaday_user')
    localStorage.removeItem('Dietaday_active_diet')
    setToken(null)
    setUser(null)
  }

  async function logoutAll() {
    if (!isDemoMode) await api('/auth/logout-all', { method: 'POST', token })
    logout()
  }

  return (
    <AuthContext.Provider value={{ user, token, ready, login, register, updateUser, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
