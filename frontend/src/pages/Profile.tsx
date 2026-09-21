import { Bell, BellOff, LogOut, Save, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, PageTitle } from '../components/Ui'
import { getErrorMessage } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import type { User } from '../types'
import { currentPushStatus, disablePushNotifications, enablePushNotifications, type PushStatus } from '../lib/pushNotifications'

type ProfileForm = { fullName: string; weight: string; height: string }

function userToForm(user: User | null): ProfileForm {
  return {
    fullName: user?.fullName ?? '',
    weight: user?.weightKg?.toString() ?? '',
    height: user?.heightCm?.toString() ?? '',
  }
}

export function Profile() {
  const { user, token, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(() => userToForm(user))
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [pushStatus, setPushStatus] = useState<PushStatus>('disabled')
  const [pushLoading, setPushLoading] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const [pushError, setPushError] = useState('')

  useEffect(() => {
    setForm(userToForm(user))
  }, [user])

  useEffect(() => {
    void currentPushStatus().then(setPushStatus).catch(() => setPushStatus('unsupported'))
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSuccess(false)
    setError('')
    const fullName = form.fullName.trim()
    if (!fullName) {
      setError('Informe seu nome completo.')
      return
    }
    setLoading(true)
    try {
      await updateUser({
        fullName,
        weightKg: Number(form.weight),
        heightCm: Number(form.height),
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
      <form className="card profile-form" onSubmit={submit}>
        <h2>Informações pessoais</h2>
        <p>Esses dados ajudam a acompanhar sua jornada.</p>
        <label>
          Nome completo
          <input required autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
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
        <p>Receba lembretes às 09h, 13h, 16h, 18h e 20h no horário de Brasília.</p>
        {pushStatus === 'unsupported' ? <p>As notificações não estão disponíveis neste dispositivo.</p> : (
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
