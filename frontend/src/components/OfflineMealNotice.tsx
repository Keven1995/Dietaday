import { AlertTriangle, CloudUpload, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MEAL_SYNCED_EVENT, useOfflineMeals } from '../state/OfflineMealContext'

export function OfflineMealNotice() {
  const { operations, syncing, syncNow } = useOfflineMeals()
  const [synced, setSynced] = useState(false)
  const [syncedPoints, setSyncedPoints] = useState(0)
  useEffect(() => {
    let timer: number | null = null
    const handleSynced = (event: Event) => {
      const pointsEarned = (event as CustomEvent<{ pointsEarned?: number }>).detail?.pointsEarned ?? 0
      setSynced(true)
      setSyncedPoints(pointsEarned)
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => setSynced(false), 4000)
    }
    window.addEventListener(MEAL_SYNCED_EVENT, handleSynced)
    return () => {
      window.removeEventListener(MEAL_SYNCED_EVENT, handleSynced)
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [])

  if (!operations.length && !synced) return null
  const failed = operations.filter((operation) => operation.status === 'failed').length

  if (synced && !failed) {
    return <div className="offline-meal-notice sync-complete" role="status" aria-live="polite"><CloudUpload aria-hidden="true" /><div><strong>Refeição sincronizada</strong><small>O registro foi confirmado pelo servidor.{syncedPoints ? ` +${syncedPoints} pontos confirmados.` : ''}</small></div></div>
  }

  return (
    <div className={`offline-meal-notice${failed ? ' has-failure' : ''}`} role="status" aria-live="polite">
      {failed ? <AlertTriangle aria-hidden="true" /> : syncing ? <LoaderCircle className="spin" aria-hidden="true" /> : <CloudUpload aria-hidden="true" />}
      <div>
        <strong>{failed ? `${failed} ${failed === 1 ? 'refeição precisa' : 'refeições precisam'} de atenção` : `${operations.length} ${operations.length === 1 ? 'refeição pendente' : 'refeições pendentes'}`}</strong>
        <small>{syncing ? 'Sincronizando agora...' : 'Os registros estão seguros neste dispositivo.'}</small>
      </div>
      {failed ? <Link to="/historico">Revisar</Link> : <button type="button" disabled={syncing} onClick={() => void syncNow()}>Sincronizar</button>}
    </div>
  )
}
