import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { getDemoDiets } from '../data'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import type { CreateDietRequest, Diet } from '../types'
import { useAuth } from './AuthContext'

type DietContextValue = {
  diets: Diet[]
  activeDiet: Diet | null
  activeDietId: string | null
  loading: boolean
  error: string
  selectDiet: (id: string) => void
  createDiet: (data: CreateDietRequest) => Promise<Diet>
  reload: () => Promise<void>
}

const DietContext = createContext<DietContextValue | null>(null)

export function DietProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const [diets, setDiets] = useState<Diet[]>([])
  const [activeDietId, setActiveDietId] = useState<string | null>(() => localStorage.getItem('Dietaday_active_diet'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)

  async function loadDiets(signal?: AbortSignal) {
    const requestId = ++requestIdRef.current
    if (!token) {
      setDiets([])
      setLoading(false)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = isDemoMode ? getDemoDiets() : await api<Diet[]>('/diets', { token, signal })
      if (signal?.aborted || requestId !== requestIdRef.current) return
      setDiets(data)
      setActiveDietId((current) => {
        const next = current && data.some((diet) => diet.id === current) ? current : data[0]?.id ?? null
        if (next) localStorage.setItem('Dietaday_active_diet', next)
        else localStorage.removeItem('Dietaday_active_diet')
        return next
      })
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
  }, [token])

  function reload() {
    return loadDiets()
  }

  function selectDiet(id: string) {
    localStorage.setItem('Dietaday_active_diet', id)
    setActiveDietId(id)
  }

  async function createDiet(data: CreateDietRequest) {
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
    const created = isDemoMode
      ? { id: crypto.randomUUID(), ...data }
      : await api<Diet>('/diets', { method: 'POST', token, body: JSON.stringify(data) })
    setDiets((current) => [...current, created])
    selectDiet(created.id)
    return created
  }

  const activeDiet = diets.find((diet) => diet.id === activeDietId) ?? null
  return (
    <DietContext.Provider value={{ diets, activeDiet, activeDietId, loading, error, selectDiet, createDiet, reload }}>
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
