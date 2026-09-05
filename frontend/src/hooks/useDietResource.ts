import { useEffect, useState } from 'react'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'

type DietResource<T> = {
  data: T
  loading: boolean
  error: string
  reload: () => void
}

export function useDietResource<T>(resource: string, demoData: T, emptyData: T, fallbackError: string): DietResource<T> {
  const { token } = useAuth()
  const { activeDiet } = useDiets()
  const [data, setData] = useState<T>(emptyData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!activeDiet || !token) {
      setData(emptyData)
      setLoading(false)
      setError('')
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError('')

    const request = isDemoMode
      ? Promise.resolve(demoData)
      : api<T>(`/diets/${activeDiet.id}/${resource}`, { token, signal: controller.signal })

    request
      .then((responseData) => {
        if (!controller.signal.aborted) setData(responseData)
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(getErrorMessage(requestError, fallbackError))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [activeDiet, demoData, emptyData, fallbackError, resource, revision, token])

  return {
    data,
    loading,
    error,
    reload: () => setRevision((current) => current + 1),
  }
}
