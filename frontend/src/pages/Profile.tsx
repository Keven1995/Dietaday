import { LogOut, Save, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, PageTitle } from '../components/Ui'
import { getErrorMessage } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import type { User } from '../types'

type ProfileForm = { fullName: string; weight: string; height: string }

function userToForm(user: User | null): ProfileForm {
  return {
    fullName: user?.fullName ?? '',
    weight: user?.weightKg?.toString() ?? '',
    height: user?.heightCm?.toString() ?? '',
  }
}

export function Profile() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(() => userToForm(user))
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(userToForm(user))
  }, [user])

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
      <button type="button" className="logout-button" onClick={signOut}><LogOut /> Sair da conta</button>
    </div>
  )
}
