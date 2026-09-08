import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, isDemoMode, UNAUTHORIZED_EVENT } from '../lib/api'
import { clearUserCache } from '../lib/resourceCache'
import type { AuthResponse, RegisterRequest, UpdateProfileRequest, User } from '../types'

type AuthContextValue = {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  updateUser: (data: UpdateProfileRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isStoredUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false
  return 'id' in value && typeof value.id === 'string' &&
    'email' in value && typeof value.email === 'string' &&
    'fullName' in value && typeof value.fullName === 'string'
}

function readStoredUser(): User | null {
  try {
    const stored = localStorage.getItem('Dietaday_user')
    if (!stored) return null
    const value: unknown = JSON.parse(stored)
    return isStoredUser(value) ? value : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('Dietaday_token'))
  const [user, setUser] = useState<User | null>(readStoredUser)

  function persist(data: AuthResponse) {
    const authenticatedUser: User = { id: data.userId, email: data.email, fullName: data.fullName }
    localStorage.setItem('Dietaday_token', data.token)
    localStorage.setItem('Dietaday_user', JSON.stringify(authenticatedUser))
    setToken(data.token)
    setUser(authenticatedUser)
  }

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
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout)
  })

  async function login(email: string, password: string) {
    const data = isDemoMode
      ? { token: 'demo-jwt-token', userId: '1', fullName: 'Marina Alves', email }
      : await api<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    persist(data)
  }

  async function register(data: RegisterRequest) {
    const response = isDemoMode
      ? { token: 'demo-jwt-token', userId: crypto.randomUUID(), fullName: data.fullName, email: data.email }
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
    if (user) clearUserCache(user.id)
    localStorage.removeItem('Dietaday_token')
    localStorage.removeItem('Dietaday_user')
    localStorage.removeItem('Dietaday_active_diet')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, updateUser, logout }}>
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
