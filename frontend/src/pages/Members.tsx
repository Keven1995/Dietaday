import { LogOut, Mail, UserPlus, Users, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, PageTitle } from '../components/Ui'
import { initialMembers, leaveDemoDiet } from '../data'
import { useDietResource } from '../hooks/useDietResource'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import type { Invitation, InviteMemberRequest, LeaveDietRequest, Member } from '../types'

const NO_MEMBERS: Member[] = []

function getInitials(fullName: string) {
  return fullName.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('')
}

export function Members() {
  const navigate = useNavigate()
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
  const leaveTitleRef = useRef<HTMLHeadingElement | null>(null)
  const leavingRef = useRef(false)
  const membersResource = useDietResource('members', initialMembers, NO_MEMBERS, 'Não foi possível carregar os membros.')

  useEffect(() => () => {
    inviteControllerRef.current?.abort()
    leaveControllerRef.current?.abort()
  }, [])

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
            {membersResource.loading ? <p className="loading-text">Carregando membros...</p> : members.map((member) => (
              <article className="member-row" key={member.userId}>
                <div className="avatar large" aria-hidden="true">{getInitials(member.fullName)}</div>
                <div><h3>{member.fullName}</h3><span>{member.email}</span></div>
                <div className="member-actions">
                  <div className="member-role">{member.role === 'OWNER' ? 'Responsável' : 'Membro'}</div>
                  {member.userId === user?.id && <button type="button" className="leave-diet-trigger" onClick={openLeaveModal}>SAIR</button>}
                </div>
              </article>
            ))}
          </section>
        </>
      ) : <EmptyState icon={<Users />} title="Nenhuma dieta selecionada" text="Crie ou selecione uma dieta para gerenciar membros." />}
      {leaveModalOpen && currentMember && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeLeaveModal()}>
          <div ref={leaveDialogRef} className="modal leave-diet-modal" role="dialog" aria-modal="true" aria-labelledby="leave-diet-title" aria-describedby="leave-diet-description">
            <button type="button" className="close" onClick={closeLeaveModal} disabled={leaving} aria-label="Fechar"><X aria-hidden="true" /></button>
            <LogOut className="leave-diet-icon" aria-hidden="true" />
            <h2 id="leave-diet-title" ref={leaveTitleRef} tabIndex={-1}>Sair da dieta</h2>
            <p id="leave-diet-description">Tem certeza de que vai querer sair? Você já chegou tão longe.</p>
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
              {ownerCannotLeave && <div className="leave-owner-warning">Você precisa convidar alguém antes de sair ou excluir a dieta.</div>}
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
