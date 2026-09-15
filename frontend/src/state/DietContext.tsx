import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { deleteDemoDiet, getDemoDiets } from '../data'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { clearDietCache, readCachedResource, writeCachedResource } from '../lib/resourceCache'
import type { CreateDietRequest, Diet } from '../types'
import { createUuid } from '../lib/uuid'
import { useAuth } from './AuthContext'

type DietContextValue = {
  diets: Diet[]
  activeDiet: Diet | null
  activeDietId: string | null
  loading: boolean
  error: string
  selectDiet: (id: string) => void
  createDiet: (data: CreateDietRequest) => Promise<Diet>
  deleteDiet: (id: string) => Promise<void>
  reload: () => Promise<void>
}

const DietContext = createContext<DietContextValue | null>(null)

export function DietProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth()
  const [diets, setDiets] = useState<Diet[]>(() => user ? readCachedResource<Diet[]>(user.id, 'diets')?.data ?? [] : [])
  const [dietsUserId, setDietsUserId] = useState<string | null>(() => user?.id ?? null)
  const [activeDietId, setActiveDietId] = useState<string | null>(() => localStorage.getItem('Dietaday_active_diet'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)

  function keepValidActiveDiet(data: Diet[]) {
    setActiveDietId((current) => {
      const next = current && data.some((diet) => diet.id === current) ? current : data[0]?.id ?? null
      if (next) localStorage.setItem('Dietaday_active_diet', next)
      else localStorage.removeItem('Dietaday_active_diet')
      return next
    })
  }

  async function loadDiets(signal?: AbortSignal, force = false) {
    const requestId = ++requestIdRef.current
    if (!token || !user) {
      setDiets([])
      setDietsUserId(null)
      setLoading(false)
      setError('')
      return
    }
    const cached = isDemoMode ? null : readCachedResource<Diet[]>(user.id, 'diets')
    const cachedHasActiveDiet = !activeDietId || Boolean(cached?.data.some((diet) => diet.id === activeDietId))
    if (cached) {
      setDiets(cached.data)
      setDietsUserId(user.id)
      if (cachedHasActiveDiet) keepValidActiveDiet(cached.data)
    } else {
      setDiets([])
      setDietsUserId(user.id)
    }
    setLoading(!cached)
    setError('')
    if (!force && cached?.fresh && cachedHasActiveDiet) return
    try {
      const data = isDemoMode ? getDemoDiets() : await api<Diet[]>('/diets', { token, signal })
      if (signal?.aborted || requestId !== requestIdRef.current) return
      setDiets(data)
      setDietsUserId(user.id)
      if (!isDemoMode) writeCachedResource(user.id, 'diets', data)
      keepValidActiveDiet(data)
    } catch (err) {
      if (!signal?.aborted && requestId === requestIdRef.current) setError(getErrorMessage(err, 'Não foi possível carregar as dietas.'))
    } finally {
      if (!signal?.aborted && requestId === requestIdRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void loadDiets(controller.signal)
    return () => controller.abort()
  }, [token, user?.id])

  function reload() {
    return loadDiets(undefined, true)
  }

  function selectDiet(id: string) {
    localStorage.setItem('Dietaday_active_diet', id)
    setActiveDietId(id)
  }

  async function createDiet(data: CreateDietRequest) {
    if (!token || !user) throw new Error('Sua sessão expirou. Entre novamente.')
    requestIdRef.current += 1
    const created = isDemoMode
      ? { id: createUuid(), ...data }
      : await api<Diet>('/diets', { method: 'POST', token, body: JSON.stringify(data) })
    setDiets((current) => {
      const next = [...current, created]
      if (!isDemoMode) writeCachedResource(user.id, 'diets', next)
      return next
    })
    setDietsUserId(user.id)
    selectDiet(created.id)
    return created
  }

  async function deleteDiet(id: string) {
    if (!token || !user) throw new Error('Sua sessão expirou. Entre novamente.')
    requestIdRef.current += 1
    if (isDemoMode) deleteDemoDiet(id)
    else await api<void>(`/diets/${id}`, { method: 'DELETE', token })
    setDiets((current) => {
      const next = current.filter((diet) => diet.id !== id)
      if (!isDemoMode) writeCachedResource(user.id, 'diets', next)
      return next
    })
    if (!isDemoMode) clearDietCache(user.id, id)
    await loadDiets(undefined, true)
  }

  const visibleDiets = dietsUserId === user?.id ? diets : []
  const activeDiet = visibleDiets.find((diet) => diet.id === activeDietId) ?? null
  return (
    <DietContext.Provider value={{ diets: visibleDiets, activeDiet, activeDietId, loading, error, selectDiet, createDiet, deleteDiet, reload }}>
      {children}
    </DietContext.Provider>
  )
}

export function useDiets() {
  const context = useContext(DietContext)
  if (!context) {
    throw new Error('useDiets deve ser usado dentro de DietProvider')
  }
  return context
}
