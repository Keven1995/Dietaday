import { Bell, BellOff, LogOut, Save, UserRound, Shield } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, PageTitle } from '../components/Ui'
import { api, getErrorMessage } from '../lib/api'
import { usePushStatus } from '../hooks/usePushStatus'
import { completeFeatureCampaign } from '../lib/featureDiscoveryTelemetry'
import { useAuth } from '../state/AuthContext'
import type { User, UserSex } from '../types'
import { disablePushNotifications, enablePushNotifications } from '../lib/pushNotifications'

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
  const { user, token, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const reminderHeadingRef = useRef<HTMLHeadingElement>(null)
  const { status: pushStatus, refresh: refreshPushStatus } = usePushStatus()
  const [form, setForm] = useState(() => userToForm(user))
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [pushLoading, setPushLoading] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const [pushError, setPushError] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')

  useEffect(() => {
    setForm(userToForm(user))
  }, [user])

  useEffect(() => {
    if (location.hash !== '#lembretes-agua') return
    reminderHeadingRef.current?.scrollIntoView({ block: 'center' })
    reminderHeadingRef.current?.focus({ preventScroll: true })
  }, [location.hash])

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

  async function togglePush() {
    if (!user) return
    setPushLoading(true)
    setPushMessage('')
    setPushError('')
    try {
      if (pushStatus === 'enabled') {
        if (!token) return
        await disablePushNotifications(token)
        await refreshPushStatus()
        setPushMessage('Lembretes de água desativados.')
      } else if (pushStatus === 'disabled') {
        if (!token) return
        await enablePushNotifications(token)
        if (user) completeFeatureCampaign(token, user.id, 'water_reminders', 1, { page: '/perfil' })
        await refreshPushStatus()
        setPushMessage('Lembretes de água ativados! 💧')
      } else {
        return
      }
    } catch (pushError) {
      setPushError(pushError instanceof Error ? pushError.message : 'Não foi possível configurar os lembretes.')
      await refreshPushStatus()
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
        <h2 id="lembretes-agua" ref={reminderHeadingRef} tabIndex={-1}>Lembretes de água</h2>
        <p>Receba lembretes para não esquecer de se hidratar durante o dia.</p>
        {pushStatus === 'loading' ? <p>Verificando a disponibilidade dos lembretes...</p>
          : pushStatus === 'unsupported' ? <p>As notificações não estão disponíveis neste dispositivo.</p>
            : pushStatus === 'install-required' ? <p>No iPhone, instale o Dietaday na tela inicial para configurar os lembretes.</p>
              : pushStatus === 'blocked' ? <p>As notificações estão bloqueadas nas configurações do navegador. Libere a permissão para ativar os lembretes.</p>
                : pushStatus === 'error' ? <div>
                  <p>Não foi possível verificar o status das notificações.</p>
                  <Button type="button" className="outline" onClick={() => void refreshPushStatus()}>Tentar novamente</Button>
                </div> : (
          <Button type="button" loading={pushLoading} className={pushStatus === 'enabled' ? 'outline' : ''} onClick={() => void togglePush()}>
            {pushStatus === 'enabled' ? <BellOff /> : <Bell />} {pushStatus === 'enabled' ? 'Desativar lembretes' : 'Ativar lembretes'}
          </Button>
        )}
        {pushError && <div className="error-message" role="alert">{pushError}</div>}
        {pushMessage && <div className="success-message" role="status">{pushMessage}</div>}
      </section>
      <button type="button" className="logout-button" onClick={signOut}><LogOut /> Sair da conta</button>
    </div>
  )
}
