import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getErrorMessage } from '../lib/api'
import { addWaterCheck, getWaterToday, updateWaterGoal } from '../lib/water'
import { useAuth } from './AuthContext'
import type { WaterToday } from '../types'

type WaterContextValue = {
  water: WaterToday | null
  loading: boolean
  saving: boolean
  error: string
  refresh: () => Promise<void>
  saveGoal: (goalMl: number) => Promise<void>
  addCheck: (amountMl: number) => Promise<void>
}

const WaterContext = createContext<WaterContextValue | null>(null)

export function WaterProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth()
  const [water, setWater] = useState<WaterToday | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    if (!user) {
      setWater(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      setWater(await getWaterToday(token, user.id))
    } catch (refreshError) {
      setError(getErrorMessage(refreshError, 'Não foi possível carregar o acompanhamento de água.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [user?.id, token])

  async function saveGoal(goalMl: number) {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      setWater(await updateWaterGoal(token, user.id, goalMl))
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Não foi possível salvar sua meta.'))
      throw saveError
    } finally {
      setSaving(false)
    }
  }

  async function addCheck(amountMl: number) {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      setWater(await addWaterCheck(token, user.id, amountMl))
    } catch (checkError) {
      setError(getErrorMessage(checkError, 'Não foi possível registrar esse check.'))
      throw checkError
    } finally {
      setSaving(false)
    }
  }

  return <WaterContext.Provider value={{ water, loading, saving, error, refresh, saveGoal, addCheck }}>{children}</WaterContext.Provider>
}

export function useWater() {
  const context = useContext(WaterContext)
  if (!context) throw new Error('useWater deve ser usado dentro de WaterProvider')
  return context
}
