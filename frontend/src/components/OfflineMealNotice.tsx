import { AlertTriangle, CloudUpload, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useOfflineMeals } from '../state/OfflineMealContext'

export function OfflineMealNotice() {
  const { operations, syncing, syncNow } = useOfflineMeals()
  if (!operations.length) return null
  const failed = operations.filter((operation) => operation.status === 'failed').length

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
