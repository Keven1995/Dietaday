import { LogOut, Mail, UserPlus, Users, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, EmptyState, PageTitle } from '../components/Ui'
import { MealNudgeButton } from '../components/MealNudgeButton'
import { initialMembers, leaveDemoDiet } from '../data'
import { useDietResource } from '../hooks/useDietResource'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { completeFeatureCampaign } from '../lib/featureDiscoveryTelemetry'
import { clearDietCache } from '../lib/resourceCache'
import { MEAL_SYNCED_EVENT } from '../state/OfflineMealContext'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import type { Invitation, InviteMemberRequest, LeaveDietRequest, MealNudgeEligibility, MealNudgeMealType, MealNudgeMemberEligibility, Member } from '../types'

const NO_MEMBERS: Member[] = []

function getInitials(fullName: string) {
  return fullName.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('')
}

export function Members() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, user } = useAuth()
  const { activeDiet, reload } = useDiets()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [inviting, setInviting] = useState(false)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [successorId, setSuccessorId] = useState('')
  const [leaveError, setLeaveError] = useState('')
  const [leaving, setLeaving] = useState(false)
  const inviteControllerRef = useRef<AbortController | null>(null)
  const leaveControllerRef = useRef<AbortController | null>(null)
  const leaveTriggerRef = useRef<HTMLButtonElement | null>(null)
  const leaveDialogRef = useRef<HTMLDivElement | null>(null)
  const nudgeRequestRef = useRef<AbortController | null>(null)
  const leaveTitleRef = useRef<HTMLHeadingElement | null>(null)
  const leavingRef = useRef(false)
  const membersResource = useDietResource('members', initialMembers, NO_MEMBERS, 'Não foi possível carregar os membros.')
  const [nudgeEligibility, setNudgeEligibility] = useState<Record<string, MealNudgeEligibility>>({})
  const [nudgeEligibilityLoading, setNudgeEligibilityLoading] = useState(false)
  const [nudgeEligibilityError, setNudgeEligibilityError] = useState('')
  const discoveryNavigation = typeof location.state === 'object' && location.state !== null
    ? location.state as { featureDiscoveryCampaignId?: unknown; featureDiscoveryDietId?: unknown }
    : null

  useEffect(() => () => {
    inviteControllerRef.current?.abort()
    leaveControllerRef.current?.abort()
    nudgeRequestRef.current?.abort()
  }, [])

  useEffect(() => {
    setNudgeEligibility({})
    setNudgeEligibilityError('')
    if (!activeDiet || !token || isDemoMode) {
      setNudgeEligibilityLoading(false)
      return
    }

    const refreshEligibility = () => {
      nudgeRequestRef.current?.abort()
      const controller = new AbortController()
      nudgeRequestRef.current = controller
      setNudgeEligibilityLoading(true)
      setNudgeEligibilityError('')
      void api<MealNudgeMemberEligibility[]>(`/diets/${activeDiet.id}/meal-nudges/eligibility/all`, {
        token,
        signal: controller.signal,
      }).then((entries) => {
        if (controller.signal.aborted) return
        setNudgeEligibility(Object.fromEntries(entries.map((entry) => [entry.recipientId, entry])))
      }).catch((loadError) => {
        if (!controller.signal.aborted) setNudgeEligibilityError(getErrorMessage(loadError, 'Não foi possível verificar as refeições pendentes.'))
      }).finally(() => {
        if (!controller.signal.aborted) setNudgeEligibilityLoading(false)
      })
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) refreshEligibility()
    }

    refreshEligibility()
    const timer = window.setInterval(refreshWhenVisible, 30_000)
    window.addEventListener('focus', refreshWhenVisible)
    window.addEventListener(MEAL_SYNCED_EVENT, refreshEligibility)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      window.removeEventListener(MEAL_SYNCED_EVENT, refreshEligibility)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      nudgeRequestRef.current?.abort()
    }
  }, [activeDiet?.id, token])

  useEffect(() => {
    if (!leaveModalOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    leaveTitleRef.current?.focus()

    function handleDialogKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (!leavingRef.current) closeLeaveModal()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(leaveDialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), [href], input:not(:disabled)') ?? [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const focusIsOutside = !leaveDialogRef.current?.contains(document.activeElement)
      if (event.shiftKey && (focusIsOutside || document.activeElement === first || document.activeElement === leaveTitleRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (focusIsOutside || document.activeElement === last)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleDialogKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleDialogKey)
    }
  }, [leaveModalOpen])

  async function invite(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (!activeDiet || !token) {
      setError('Selecione uma dieta antes de enviar um convite.')
      return
    }
    const controller = new AbortController()
    inviteControllerRef.current?.abort()
    inviteControllerRef.current = controller
    setInviting(true)
    try {
      const request: InviteMemberRequest = { email: email.trim() }
      if (!isDemoMode) await api<Invitation>(`/diets/${activeDiet.id}/invitations`, { method: 'POST', token, signal: controller.signal, body: JSON.stringify(request) })
      if (controller.signal.aborted) return
      setMessage(`Convite enviado para ${request.email}.`)
      setEmail('')
      if (user && discoveryNavigation?.featureDiscoveryCampaignId === 'share_diet'
          && discoveryNavigation.featureDiscoveryDietId === activeDiet.id) {
        completeFeatureCampaign(token, user.id, 'share_diet', 1, {
          dietId: activeDiet.id,
          eventDietId: activeDiet.id,
          page: '/membros',
        })
        navigate(location.pathname, { replace: true, state: null })
      }
    } catch (inviteError) {
      if (!controller.signal.aborted) setError(getErrorMessage(inviteError, 'Não foi possível enviar o convite.'))
    } finally {
      if (!controller.signal.aborted) setInviting(false)
    }
  }

  function openLeaveModal(event: MouseEvent<HTMLButtonElement>) {
    leaveTriggerRef.current = event.currentTarget
    setSuccessorId('')
    setLeaveError('')
    setLeaveModalOpen(true)
  }

  function closeLeaveModal() {
    if (leavingRef.current) return
    setLeaveModalOpen(false)
    setLeaveError('')
    leaveTriggerRef.current?.focus()
  }

  async function leaveDiet(event: FormEvent) {
    event.preventDefault()
    const currentMember = membersResource.data.find((member) => member.userId === user?.id)
    const successors = membersResource.data.filter((member) => member.userId !== user?.id)
    if (!activeDiet || !token || !currentMember) {
      setLeaveError('Não foi possível identificar sua participação nesta dieta.')
      return
    }
    if (currentMember.role === 'OWNER' && !successors.some((member) => member.userId === successorId)) {
      setLeaveError('Selecione outro membro como novo responsável.')
      return
    }

    const controller = new AbortController()
    leaveControllerRef.current?.abort()
    leaveControllerRef.current = controller
    leavingRef.current = true
    setLeaving(true)
    setLeaveError('')
    try {
      const request: LeaveDietRequest = { successorId: currentMember.role === 'OWNER' ? successorId : null }
      if (isDemoMode) leaveDemoDiet(activeDiet.id)
      else await api<void>(`/diets/${activeDiet.id}/leave`, { method: 'POST', token, signal: controller.signal, body: JSON.stringify(request) })
      if (controller.signal.aborted) return
      if (!isDemoMode && user) clearDietCache(user.id, activeDiet.id)
      await reload()
      if (controller.signal.aborted) return
      navigate('/dietas')
    } catch (leaveRequestError) {
      if (!controller.signal.aborted) setLeaveError(getErrorMessage(leaveRequestError, 'Não foi possível sair da dieta.'))
    } finally {
      if (!controller.signal.aborted) {
        leavingRef.current = false
        setLeaving(false)
      }
    }
  }

  const displayedError = error || membersResource.error
  const members = membersResource.data
  const currentMember = members.find((member) => member.userId === user?.id)
  const possibleSuccessors = members.filter((member) => member.userId !== user?.id)
  const ownerCannotLeave = currentMember?.role === 'OWNER' && possibleSuccessors.length === 0
  const selectedSuccessor = possibleSuccessors.find((member) => member.userId === successorId)
  const leaveDescription = currentMember?.role === 'OWNER'
    ? selectedSuccessor
      ? `Ao confirmar, ${selectedSuccessor.fullName} assumirá a responsabilidade. Você perderá acesso à dieta.`
      : 'Para sair, escolha um membro atual para assumir a responsabilidade. Você perderá acesso à dieta após a transferência.'
    : 'Ao confirmar, você perderá acesso à dieta. Ela e os registros permanecerão disponíveis aos demais membros.'

  return (
    <div className="page">
      <PageTitle eyebrow="DIETA COMPARTILHADA" title="Membros" />
      <p className="page-lead">Convide pessoas já cadastradas para acompanhar o plano e registrar refeições em conjunto.</p>
      {displayedError && <div className="error-message" role="alert">{displayedError}</div>}
      {activeDiet ? (
        <>
          <form className="invite-card" onSubmit={invite}>
            <div className="members-icon"><UserPlus /></div>
            <div><h2>Convide alguém para {activeDiet.name}</h2><p>A pessoa precisa ter uma conta no Dietaday.</p></div>
            <label>
              <span className="sr-only">E-mail do novo membro</span>
              <Mail aria-hidden="true" />
              <input required type="email" autoComplete="email" placeholder="email@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <Button loading={inviting}>Enviar convite</Button>
          </form>
          {message && <div className="success-message" role="status"><span aria-hidden="true">✓</span> {message}</div>}
          <section className="member-section">
            <div className="section-heading"><div><span>ACESSO ATUAL</span><h2>{members.length} {members.length === 1 ? 'membro' : 'membros'}</h2></div></div>
            {nudgeEligibilityError && <div className="error-message" role="alert">{nudgeEligibilityError}</div>}
            {nudgeEligibilityLoading && !Object.keys(nudgeEligibility).length && <p className="loading-text" role="status">Verificando refeições pendentes…</p>}
            {membersResource.loading ? <p className="loading-text">Carregando membros...</p> : members.map((member) => (
              <article className="member-row" key={member.userId}>
                <div className="avatar large" aria-hidden="true">{getInitials(member.fullName)}</div>
                <div><h3>{member.fullName}</h3><span>{member.email}</span></div>
                <div className="member-actions">
                  <div className="member-role">{member.role === 'OWNER' ? 'Responsável' : 'Membro'}</div>
                  {member.userId === user?.id && <button type="button" className="leave-diet-trigger" onClick={openLeaveModal}>SAIR</button>}
                  {!isDemoMode && member.userId !== user?.id && <MealNudgeButton
                    dietId={activeDiet.id}
                    recipientId={member.userId}
                    recipientName={member.fullName}
                    token={token}
                    eligibility={nudgeEligibility[member.userId] ?? null}
                    onSent={(mealType: MealNudgeMealType) => setNudgeEligibility((current) => {
                      const currentEntry = current[member.userId]
                      if (!currentEntry) return current
                      return {
                        ...current,
                        [member.userId]: {
                          ...currentEntry,
                          meals: currentEntry.meals.map((meal) => meal.mealType === mealType
                            ? { ...meal, eligible: false, alreadySentByMe: true, reason: 'ALREADY_SENT' }
                            : meal),
                        },
                      }
                    })}
                  />}
                </div>
              </article>
            ))}
          </section>
        </>
      ) : <EmptyState icon={<Users />} title="Nenhuma dieta selecionada" text="Crie ou selecione uma dieta para gerenciar membros." />}
      {leaveModalOpen && currentMember && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeLeaveModal()}>
          <div ref={leaveDialogRef} className="modal leave-diet-modal" role="dialog" aria-modal="true" aria-labelledby="leave-diet-title" aria-describedby={activeDiet?.competitiveMode ? 'leave-diet-description leave-diet-points-description' : 'leave-diet-description'}>
            <button type="button" className="close" onClick={closeLeaveModal} disabled={leaving} aria-label="Fechar"><X aria-hidden="true" /></button>
            <LogOut className="leave-diet-icon" aria-hidden="true" />
            <h2 id="leave-diet-title" ref={leaveTitleRef} tabIndex={-1}>Confirmar saída da dieta</h2>
            <p id="leave-diet-description">{leaveDescription}</p>
            {activeDiet?.competitiveMode && <p id="leave-diet-points-description" className="leave-owner-warning">Os pontos pendentes de confirmação no ranking serão revogados.</p>}
            <form onSubmit={leaveDiet}>
              {currentMember.role === 'OWNER' && possibleSuccessors.length > 0 && (
                <label>
                  Novo responsável
                  <select required value={successorId} onChange={(event) => setSuccessorId(event.target.value)} disabled={leaving}>
                    <option value="">Selecione outro membro</option>
                    {possibleSuccessors.map((member) => <option key={member.userId} value={member.userId}>{member.fullName}</option>)}
                  </select>
                </label>
              )}
              {ownerCannotLeave && <div className="leave-owner-warning">Você é o único responsável. Convide outro membro para que ele assuma a responsabilidade antes de sair.</div>}
              {leaveError && <div className="error-message" role="alert">{leaveError}</div>}
              <div className="leave-diet-actions">
                <Button type="submit" loading={leaving} disabled={ownerCannotLeave || (currentMember.role === 'OWNER' && !successorId)}>Confirmar saída</Button>
                <Button type="button" className="outline" onClick={closeLeaveModal} disabled={leaving}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
