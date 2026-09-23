import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, PageTitle } from '../components/Ui'
import { api, getErrorMessage } from '../lib/api'

export function PasswordResetPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      if (token) {
        await api('/auth/password-reset/confirm', {
          method: 'POST',
          body: JSON.stringify({ token, password }),
        })
        setMessage('Senha redefinida. Você já pode entrar na sua conta.')
        window.setTimeout(() => navigate('/login'), 1200)
      } else {
        await api('/auth/password-reset/request', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim() }),
        })
        setMessage('Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.')
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Não foi possível concluir a solicitação.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page narrow-page">
      <PageTitle eyebrow="SEGURANÇA" title={token ? 'Redefinir senha' : 'Recuperar senha'} />
      <form className="card profile-form" onSubmit={submit}>
        <p>{token ? 'Escolha uma nova senha para sua conta.' : 'Informe seu e-mail e enviaremos as instruções, se a conta existir.'}</p>
        {!token && <label>E-mail<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
        {token && <label>Nova senha<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
        {error && <div className="error-message" role="alert">{error}</div>}
        {message && <div className="success-message" role="status">{message}</div>}
        <Button loading={loading}>{token ? 'Redefinir senha' : 'Enviar instruções'}</Button>
        <Link to="/login">Voltar para o login</Link>
      </form>
    </div>
  )
}

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [message, setMessage] = useState('Confirmando seu e-mail...')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Link de verificação inválido.')
      return
    }
    void api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => setMessage('E-mail confirmado com sucesso.'))
      .catch((requestError) => {
        setError(getErrorMessage(requestError, 'Não foi possível confirmar o e-mail.'))
      })
  }, [token])

  return (
    <div className="page narrow-page">
      <PageTitle eyebrow="SEGURANÇA" title="Verificação de e-mail" />
      <section className="card profile-form">
        {error ? <div className="error-message" role="alert">{error}</div> : <div className="success-message" role="status">{message}</div>}
        <Link to="/login">Ir para o login</Link>
      </section>
    </div>
  )
}
