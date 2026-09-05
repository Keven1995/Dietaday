import { Mail, UserPlus, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, EmptyState, PageTitle } from '../components/Ui'
import { initialMembers } from '../data'
import { useDietResource } from '../hooks/useDietResource'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import type { InviteMemberRequest, Member } from '../types'

const NO_MEMBERS: Member[] = []

function getInitials(fullName: string) {
  return fullName.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('')
}

export function Members() {
  const { token } = useAuth()
  const { activeDiet } = useDiets()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [inviting, setInviting] = useState(false)
  const membersResource = useDietResource('members', initialMembers, NO_MEMBERS, 'Não foi possível carregar os membros.')

  async function invite(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (!activeDiet || !token) {
      setError('Selecione uma dieta antes de enviar um convite.')
      return
    }
    setInviting(true)
    try {
      const request: InviteMemberRequest = { email: email.trim() }
      if (!isDemoMode) await api<void>(`/diets/${activeDiet.id}/members/invite`, { method: 'POST', token, body: JSON.stringify(request) })
      setMessage(`${request.email} agora participa da dieta.`)
      setEmail('')
      if (!isDemoMode) membersResource.reload()
    } catch (inviteError) {
      setError(getErrorMessage(inviteError, 'Não foi possível enviar o convite.'))
    } finally {
      setInviting(false)
    }
  }

  const displayedError = error || membersResource.error
  const members = membersResource.data

  return (
    <div className="page">
      <PageTitle eyebrow="DIETA COMPARTILHADA" title="Membros" />
      <p className="page-lead">Adicione pessoas já cadastradas para acompanhar o plano e registrar refeições em conjunto.</p>
      {displayedError && <div className="error-message" role="alert">{displayedError}</div>}
      {activeDiet ? (
        <>
          <form className="invite-card" onSubmit={invite}>
            <div className="members-icon"><UserPlus /></div>
            <div><h2>Adicione alguém a {activeDiet.name}</h2><p>A pessoa precisa ter uma conta no Dietaday.</p></div>
            <label>
              <span className="sr-only">E-mail do novo membro</span>
              <Mail aria-hidden="true" />
              <input required type="email" autoComplete="email" placeholder="email@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <Button loading={inviting}>Adicionar</Button>
          </form>
          {message && <div className="success-message" role="status"><span aria-hidden="true">✓</span> {message}</div>}
          <section className="member-section">
            <div className="section-heading"><div><span>ACESSO ATUAL</span><h2>{members.length} {members.length === 1 ? 'membro' : 'membros'}</h2></div></div>
            {membersResource.loading ? <p className="loading-text">Carregando membros...</p> : members.map((member) => (
              <article className="member-row" key={member.userId}>
                <div className="avatar large" aria-hidden="true">{getInitials(member.fullName)}</div>
                <div><h3>{member.fullName}</h3><span>{member.email}</span></div>
                <div className="member-role">{member.role === 'OWNER' ? 'Responsável' : 'Membro'}</div>
              </article>
            ))}
          </section>
        </>
      ) : <EmptyState icon={<Users />} title="Nenhuma dieta selecionada" text="Crie ou selecione uma dieta para gerenciar membros." />}
    </div>
  )
}
