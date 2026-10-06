import { useCallback, useEffect, useState } from 'react'
import { currentPushStatus, type PushStatus } from '../lib/pushNotifications'

export type PushStatusState = PushStatus | 'loading' | 'error'

export function usePushStatus() {
  const [status, setStatus] = useState<PushStatusState>('loading')

  const refresh = useCallback(async () => {
    setStatus('loading')
    try {
      const next = await currentPushStatus()
      setStatus(next)
      return next
    } catch {
      setStatus('error')
      return null
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  return { status, refresh }
}
