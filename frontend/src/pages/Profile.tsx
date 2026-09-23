import { Bell, BellOff, LogOut, Save, UserRound, Shield, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, PageTitle } from '../components/Ui'
import { api, getErrorMessage } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import type { Session, User, UserSex } from '../types'
import { currentPushStatus, disablePushNotifications, enablePushNotifications, type PushStatus } from '../lib/pushNotifications'

type ProfileForm = { fullName: string; weight: string; height: string; sex: UserSex | '' }

function userToForm(user: User | null): ProfileForm {
  return {
    fullName: user?.fullName ?? '',
    weight: user?.weightKg?.toString() ?? '',
    height: user?.heightCm?.toString() ?? '',
    sex: user?.sex === 'MALE' || user?.sex === 'FEMALE' ? user.sex : '',
  }
}

export function Profile() {
  const { user, token, updateUser, logout, logoutAll } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(() => userToForm(user))
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [pushStatus, setPushStatus] = useState<PushStatus>('disabled')
  const [pushLoading, setPushLoading] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const [pushError, setPushError] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionError, setSessionError] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')

  useEffect(() => {
    setForm(userToForm(user))
  }, [user])

  useEffect(() => {
    void currentPushStatus().then(setPushStatus).catch(() => setPushStatus('unsupported'))
  }, [])

  useEffect(() => {
    if (!token) return
    void api<Session[]>('/auth/sessions', { token }).then(setSessions).catch(() => setSessionError('Não foi possível carregar as sessões.'))
  }, [token])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSuccess(false)
    setError('')
    const fullName = form.fullName.trim()
    if (!fullName) {
      setError('Informe seu nome completo.')
      return
    }
    if (!form.sex) {
      setError('Selecione seu sexo.')
      return
    }
    setLoading(true)
    try {
      await updateUser({
        fullName,
        weightKg: Number(form.weight),
        heightCm: Number(form.height),
        sex: form.sex,
      })
      setSuccess(true)
    } catch (updateError) {
      setError(getErrorMessage(updateError, 'Não foi possível atualizar o perfil.'))
    } finally {
      setLoading(false)
    }
  }

  function signOut() {
    logout()
    navigate('/login')
  }

  async function resendVerification() {
    try {
      await api('/auth/verification/resend', { method: 'POST', token })
      setVerificationMessage('Se o envio estiver configurado, um novo link será enviado.')
    } catch (requestError) {
      setVerificationMessage(getErrorMessage(requestError, 'Não foi possível solicitar o e-mail.'))
    }
  }

  async function revokeSession(id: string) {
    if (!token) return
    await api(`/auth/sessions/${id}`, { method: 'DELETE', token })
    setSessions((current) => current.filter((session) => session.id !== id))
  }

  async function revokeAllSessions() {
    await logoutAll()
    navigate('/login')
  }

  async function togglePush() {
    if (!user) return
    setPushLoading(true)
    setPushMessage('')
    setPushError('')
    try {
      if (pushStatus === 'enabled') {
        if (!token) return
        await disablePushNotifications(token)
        setPushStatus('disabled')
        setPushMessage('Lembretes de água desativados.')
      } else {
        if (!token) return
        await enablePushNotifications(token)
        setPushStatus('enabled')
        setPushMessage('Lembretes de água ativados! 💧')
      }
    } catch (pushError) {
      setPushError(pushError instanceof Error ? pushError.message : 'Não foi possível configurar os lembretes.')
    } finally {
      setPushLoading(false)
    }
  }

  return (
    <div className="page narrow-page">
      <PageTitle eyebrow="SUA CONTA" title="Perfil" />
      <section className="profile-head">
        <div className="profile-avatar" aria-hidden="true"><UserRound /></div>
        <div><h2>{user?.fullName}</h2><p>{user?.email}</p></div>
      </section>
      {user?.emailVerified === false && <section className="card profile-form">
        <h2><Shield /> E-mail não verificado</h2>
        <p>Confirme seu e-mail para proteger melhor sua conta.</p>
        <Button type="button" className="outline" onClick={() => void resendVerification()}>Reenviar confirmação</Button>
        {verificationMessage && <div className="success-message" role="status">{verificationMessage}</div>}
      </section>}
      <form className="card profile-form" onSubmit={submit}>
        <h2>Informações pessoais</h2>
        <p>Esses dados ajudam a acompanhar sua jornada.</p>
        <label>
          Nome completo
          <input required autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        </label>
        <label>
          Sexo
          <select required value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value as UserSex })}>
            <option value="">Selecione uma opção</option>
            <option value="FEMALE">Feminino</option>
            <option value="MALE">Masculino</option>
          </select>
        </label>
        <div className="form-row">
          <label>
            Peso atual <span>(kg)</span>
            <input required min="20" max="400" step="0.1" type="number" inputMode="decimal" value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} />
          </label>
          <label>
            Altura <span>(cm)</span>
            <input required min="80" max="250" step="0.1" type="number" inputMode="decimal" value={form.height} onChange={(event) => setForm({ ...form, height: event.target.value })} />
          </label>
        </div>
        {error && <div className="error-message" role="alert">{error}</div>}
        {success && <div className="success-message" role="status">Perfil atualizado com sucesso.</div>}
        <Button loading={loading}><Save /> Salvar alterações</Button>
      </form>
      <section className="card profile-form">
        <h2>Lembretes de água</h2>
        <p>Receba lembretes para não esquecer de se hidratar durante o dia.</p>
        {pushStatus === 'unsupported' ? <p>As notificações não estão disponíveis neste dispositivo.</p> : (
          <Button type="button" loading={pushLoading} className={pushStatus === 'enabled' ? 'outline' : ''} onClick={() => void togglePush()}>
            {pushStatus === 'enabled' ? <BellOff /> : <Bell />} {pushStatus === 'enabled' ? 'Desativar lembretes' : 'Ativar lembretes'}
          </Button>
        )}
        {pushError && <div className="error-message" role="alert">{pushError}</div>}
        {pushMessage && <div className="success-message" role="status">{pushMessage}</div>}
      </section>
      <section className="card profile-form">
        <h2>Sessões ativas</h2>
        <p>Revogue acessos antigos ou encerre todos os dispositivos.</p>
        {sessionError && <div className="error-message" role="alert">{sessionError}</div>}
        {sessions.map((session) => <div key={session.id} className="session-row">
          <span>{session.current ? 'Este dispositivo' : 'Outro dispositivo'}<small> Expira em {new Date(session.expiresAt).toLocaleDateString('pt-BR')}</small></span>
          {!session.current && <button type="button" aria-label="Revogar sessão" onClick={() => void revokeSession(session.id)}><X /></button>}
        </div>)}
        <Button type="button" className="outline" onClick={() => void revokeAllSessions()}>Sair de todos os dispositivos</Button>
      </section>
      <button type="button" className="logout-button" onClick={signOut}><LogOut /> Sair da conta</button>
    </div>
  )
}
