import { Check, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Ui'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import type { DietInvitationLinkPreview } from '../types'

export function InvitationLinkPage() {
  const { token: inviteToken = '' } = useParams<{ token: string }>()
  const { user, token, ready } = useAuth()
  const { diets, loading: dietsLoading, reload, selectDiet } = useDiets()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<DietInvitationLinkPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready) return
    if (isDemoMode) {
      setError('Os links de convite estão disponíveis quando você entra no aplicativo online.')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError('')
    api<DietInvitationLinkPreview>(`/invitation-links/${encodeURIComponent(inviteToken)}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setPreview(data)
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(getErrorMessage(requestError, 'Este link de convite não está disponível.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [inviteToken, ready, token])

  async function acceptInvitation() {
    if (!token || processing) return
    setProcessing(true)
    setError('')
    try {
      const response = await api<{ dietId: string }>(`/invitation-links/${encodeURIComponent(inviteToken)}/accept`, {
        method: 'POST', token,
      })
      await reload()
      selectDiet(response.dietId)
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Não foi possível aceitar o convite.'))
    } finally {
      setProcessing(false)
    }
  }

  function declineInvitation() {
    navigate('/', { replace: true })
  }

  function openDiet() {
    if (!preview) return
    selectDiet(preview.dietId)
    navigate('/', { replace: true })
  }

  const alreadyMember = Boolean(preview && diets.some((diet) => diet.id === preview.dietId))
  const authState = { from: `/convite/${encodeURIComponent(inviteToken)}` }

  return (
    <main className="invitation-link-page">
      <section className="invitation-link-panel" aria-labelledby="invitation-page-title">
        <div className="invitation-link-page-icon" aria-hidden="true"><Users /></div>
        <span className="overline">DIETA COMPARTILHADA</span>
        <h1 id="invitation-page-title">Convite para participar de um grupo</h1>
        {loading ? <p className="loading-text" role="status">Carregando convite...</p> : preview ? <>
          <p className="invitation-link-description"><strong>{preview.inviterName}</strong> convidou você para participar da dieta <strong>{preview.dietName}</strong>.</p>
          {user && dietsLoading ? <p className="loading-text" role="status">Verificando sua participação...</p> : alreadyMember ? <>
            <p className="invitation-link-feedback" role="status"><Check aria-hidden="true" /> Você já faz parte deste grupo.</p>
            <Button type="button" onClick={openDiet}>Abrir dieta</Button>
          </> : user ? <>
            <p className="invitation-link-description">Ao aceitar, a dieta aparecerá na sua lista e você poderá acompanhar o grupo.</p>
            {error && <div className="error-message" role="alert">{error}</div>}
            <div className="invitation-link-page-actions">
              <Button type="button" loading={processing} onClick={() => void acceptInvitation()}>Aceitar convite</Button>
              <Button type="button" className="outline" disabled={processing} onClick={declineInvitation}>Agora não</Button>
            </div>
          </> : <>
            <p className="invitation-link-description">Entre na sua conta para aceitar ou recusar o convite. Se ainda não tem cadastro, crie uma conta e você voltará a esta página.</p>
            <div className="invitation-link-page-actions">
              <Link className="button" to="/login" state={authState}>Entrar e responder</Link>
              <Link className="button outline" to="/cadastro" state={authState}>Criar conta</Link>
            </div>
          </>}
          <small className="invitation-link-expiry">Link válido até {new Date(preview.expiresAt).toLocaleDateString('pt-BR')}.</small>
        </> : <>
          <p className="invitation-link-description">{error || 'Este link de convite não está disponível.'}</p>
          <Link to={user ? '/' : '/login'}>Voltar ao Dietaday</Link>
        </>}
      </section>
    </main>
  )
}
