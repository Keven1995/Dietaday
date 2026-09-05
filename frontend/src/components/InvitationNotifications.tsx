import { Bell, BellRing, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getDemoInvitations, respondToDemoInvitation } from '../data'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import type { Invitation } from '../types'
import { Button } from './Ui'

export function InvitationNotifications() {
  const { token } = useAuth()
  const { reload } = useDiets()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null)
  const actionControllerRef = useRef<AbortController | null>(null)
  const actionInProgressRef = useRef(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!token) {
      setInvitations([])
      return
    }

    let requestId = 0
    const load = async () => {
      if (actionInProgressRef.current) return
      requestRef.current?.controller.abort()
      const controller = new AbortController()
      const id = ++requestId
      requestRef.current = { id, controller }
      setLoading(true)
      try {
        const data = isDemoMode
          ? getDemoInvitations()
          : await api<Invitation[]>('/invitations', { token, signal: controller.signal })
        if (!controller.signal.aborted && requestRef.current?.id === id) {
          setInvitations(data)
          setError('')
        }
      } catch (loadError) {
        if (!controller.signal.aborted && requestRef.current?.id === id) {
          setError(getErrorMessage(loadError, 'Não foi possível carregar os convites.'))
        }
      } finally {
        if (!controller.signal.aborted && requestRef.current?.id === id) setLoading(false)
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => {
      window.clearInterval(timer)
      requestRef.current?.controller.abort()
    }
  }, [token])

  useEffect(() => () => actionControllerRef.current?.abort(), [])

  useEffect(() => {
    if (!open) return
    titleRef.current?.focus()
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePanel()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled)') ?? [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const focusIsOutside = !panelRef.current?.contains(document.activeElement)
      if (event.shiftKey && (focusIsOutside || document.activeElement === first || document.activeElement === titleRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (focusIsOutside || document.activeElement === last)) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleDialogKey)
    return () => window.removeEventListener('keydown', handleDialogKey)
  }, [open])

  function closePanel() {
    setOpen(false)
    bellRef.current?.focus()
  }

  async function respond(invitation: Invitation, response: 'accept' | 'decline') {
    if (!token || actionInProgressRef.current) return
    actionInProgressRef.current = true
    requestRef.current?.controller.abort()
    const controller = new AbortController()
    actionControllerRef.current = controller
    setProcessingId(invitation.id)
    setError('')
    try {
      if (isDemoMode) {
        respondToDemoInvitation(invitation.id, response)
      } else {
        await api<void>(`/invitations/${invitation.id}/${response}`, { method: 'POST', token, signal: controller.signal })
      }
      if (controller.signal.aborted) return
      setInvitations((current) => current.filter((item) => item.id !== invitation.id))
      if (response === 'accept') await reload()
    } catch (responseError) {
      if (!controller.signal.aborted) setError(getErrorMessage(responseError, 'Não foi possível responder ao convite.'))
    } finally {
      if (!controller.signal.aborted) setProcessingId(null)
      actionInProgressRef.current = false
    }
  }

  return (
    <div className="invitation-notifications">
      <button
        ref={bellRef}
        className="notification-trigger"
        type="button"
        aria-label={`Convites pendentes: ${invitations.length}`}
        aria-expanded={open}
        aria-controls="invitation-panel"
        onClick={() => setOpen(true)}
      >
        {invitations.length ? <BellRing aria-hidden="true" /> : <Bell aria-hidden="true" />}
        {invitations.length > 0 && <span className="notification-badge" aria-hidden="true">{invitations.length > 9 ? '9+' : invitations.length}</span>}
      </button>
      {open && (
        <div className="invitation-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closePanel()}>
          <section ref={panelRef} id="invitation-panel" className="invitation-panel" role="dialog" aria-modal="true" aria-labelledby="invitation-title">
            <button className="close" type="button" onClick={closePanel} aria-label="Fechar convites"><X aria-hidden="true" /></button>
            <BellRing className="invitation-panel-icon" aria-hidden="true" />
            <h2 id="invitation-title" ref={titleRef} tabIndex={-1}>Convites para dietas</h2>
            {error && <div className="error-message" role="alert">{error}</div>}
            {loading && !invitations.length ? <p className="loading-text">Carregando convites...</p> : invitations.length ? (
              <div className="invitation-list">
                {invitations.map((invitation) => (
                  <article key={invitation.id}>
                    <p><strong>{invitation.inviterName}</strong> está te adicionando na dieta <strong>{invitation.dietName}</strong>, você gostaria de se juntar?</p>
                    <div className="invitation-actions">
                      <Button aria-label={`Aceitar convite para ${invitation.dietName}`} loading={processingId === invitation.id} disabled={processingId !== null} onClick={() => void respond(invitation, 'accept')}>SIM</Button>
                      <Button aria-label={`Recusar convite para ${invitation.dietName}`} className="outline" disabled={processingId !== null} onClick={() => void respond(invitation, 'decline')}>NÃO</Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="invitation-empty">Você não tem convites pendentes.</p>}
          </section>
        </div>
      )}
    </div>
  )
}
