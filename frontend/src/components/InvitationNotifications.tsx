import { Bell, BellRing, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDemoInvitations, respondToDemoInvitation } from '../data'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { notificationDeepLink, notificationMessage, unreadNotifications } from '../lib/notifications'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import type { CommentNotification, Invitation } from '../types'
import { Button } from './Ui'

export function InvitationNotifications() {
  const { token } = useAuth()
  const { reload, selectDiet } = useDiets()
  const navigate = useNavigate()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [notifications, setNotifications] = useState<CommentNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
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
      setNotifications([])
      setUnreadCount(0)
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
        const [invitationResult, notificationResult] = await Promise.allSettled([
          isDemoMode ? Promise.resolve(getDemoInvitations()) : api<Invitation[]>('/invitations', { token, signal: controller.signal }),
          isDemoMode ? Promise.resolve([] as CommentNotification[]) : api<CommentNotification[]>('/notifications', { token, signal: controller.signal }),
        ])
        if (!controller.signal.aborted && requestRef.current?.id === id) {
          const errors: string[] = []
          if (invitationResult.status === 'fulfilled') setInvitations(invitationResult.value)
          else errors.push(getErrorMessage(invitationResult.reason, 'Não foi possível carregar os convites.'))
          if (notificationResult.status === 'fulfilled') {
            setNotifications(notificationResult.value)
            setUnreadCount(unreadNotifications(notificationResult.value))
          } else {
            errors.push(getErrorMessage(notificationResult.reason, 'Não foi possível carregar as notificações.'))
          }
          setError(errors.join(' '))
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
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void load()
    }
    const timer = window.setInterval(refreshWhenVisible, 30_000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
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

  async function openNotification(notification: CommentNotification) {
    if (!token) return
    if (!notification.readAt) {
      const previousNotifications = notifications
      const previousUnreadCount = unreadCount
      actionInProgressRef.current = true
      requestRef.current?.controller.abort()
      const readAt = new Date().toISOString()
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt } : item))
      setUnreadCount((current) => Math.max(0, current - 1))
      try {
        if (!isDemoMode) await api<void>(`/notifications/${notification.id}/read`, { method: 'PUT', token })
      } catch (readError) {
        setNotifications(previousNotifications)
        setUnreadCount(previousUnreadCount)
        setError(getErrorMessage(readError, 'Não foi possível marcar a notificação como lida.'))
      } finally {
        actionInProgressRef.current = false
      }
    }
    selectDiet(notification.dietId)
    setOpen(false)
    navigate(notificationDeepLink(notification))
  }

  async function readAll() {
    if (!token || !unreadCount) return
    const previous = notifications
    const previousUnreadCount = unreadCount
    actionInProgressRef.current = true
    requestRef.current?.controller.abort()
    const readAt = new Date().toISOString()
    setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt ?? readAt })))
    setUnreadCount(0)
    try {
      if (!isDemoMode) await api<void>('/notifications/read-all', { method: 'PUT', token })
    } catch (readError) {
      setNotifications(previous)
      setUnreadCount(previousUnreadCount)
      setError(getErrorMessage(readError, 'Não foi possível marcar as notificações como lidas.'))
    } finally {
      actionInProgressRef.current = false
    }
  }

  const totalBadge = invitations.length + unreadCount

  return (
    <div className="invitation-notifications">
      <button
        ref={bellRef}
        className="notification-trigger"
        type="button"
        aria-label={`${totalBadge} notificações pendentes`}
        aria-expanded={open}
        aria-controls="invitation-panel"
        onClick={() => setOpen(true)}
      >
        {totalBadge ? <BellRing aria-hidden="true" /> : <Bell aria-hidden="true" />}
        {totalBadge > 0 && <span className="notification-badge" aria-hidden="true">{totalBadge > 9 ? '9+' : totalBadge}</span>}
      </button>
      {open && (
        <div className="invitation-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closePanel()}>
          <section ref={panelRef} id="invitation-panel" className="invitation-panel" role="dialog" aria-modal="true" aria-labelledby="invitation-title">
            <button className="close" type="button" onClick={closePanel} aria-label="Fechar notificações"><X aria-hidden="true" /></button>
            <BellRing className="invitation-panel-icon" aria-hidden="true" />
            <div className="notification-panel-title"><h2 id="invitation-title" ref={titleRef} tabIndex={-1}>Notificações</h2>{unreadCount > 0 && <button type="button" onClick={() => void readAll()}>Marcar todas como lidas</button>}</div>
            {error && <div className="error-message" role="alert">{error}</div>}
            {loading && !invitations.length && !notifications.length ? <p className="loading-text">Carregando notificações...</p> : (invitations.length || notifications.length) ? (<>
              {notifications.length > 0 && <div className="comment-notification-list">
                {notifications.map((notification) => <button type="button" key={notification.id} className={notification.readAt ? 'read' : 'unread'} onClick={() => void openNotification(notification)}><span aria-hidden="true"><Bell /></span><span><strong>{notificationMessage(notification)}</strong><time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></span></button>)}
              </div>}
              {invitations.length > 0 && <h3 className="invitation-subtitle">Convites para dietas</h3>}
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
            </>) : <p className="invitation-empty">Você não tem notificações.</p>}
          </section>
        </div>
      )}
    </div>
  )
}
