import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Check, Eye, EyeOff, Leaf } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { MemoryGame } from '../components/MemoryGame'
import { CreatorCredit } from '../components/CreatorCredit'
import { Button } from '../components/Ui'
import { isDemoMode } from '../lib/api'
import { prepareApi } from '../lib/serverWakeup'
import { useAuth } from '../state/AuthContext'
import type { LoginRequest, UserSex } from '../types'

type AuthMode = 'login' | 'register'
type PreparationState = 'idle' | 'waiting' | 'ready'
type AuthForm = LoginRequest & { fullName: string; sex: UserSex | '' }

function getRedirectPath(state: unknown) {
  if (typeof state !== 'object' || state === null || !('from' in state)) return '/'
  return typeof state.from === 'string' && state.from.startsWith('/') ? state.from : '/'
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { user, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mountedRef = useRef(true)
  const preparationTimerRef = useRef<number | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preparation, setPreparation] = useState<PreparationState>('idle')
  const [error, setError] = useState('')
  const [form, setForm] = useState<AuthForm>({
    fullName: '',
    email: isDemoMode ? 'marina@exemplo.com' : '',
    password: isDemoMode ? '12345678' : '',
    sex: isDemoMode ? 'FEMALE' : '',
  })

  useEffect(() => {
    mountedRef.current = true
    void prepareApi().catch(() => undefined)
    return () => {
      mountedRef.current = false
      if (preparationTimerRef.current !== null) window.clearTimeout(preparationTimerRef.current)
    }
  }, [])

  if (user) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const request = { ...form, fullName: form.fullName.trim(), email: form.email.trim() }
    if (mode === 'register' && !request.fullName) {
      setError('Informe seu nome.')
      return
    }
    if (mode === 'register' && !request.sex) {
      setError('Selecione seu sexo.')
      return
    }
    setLoading(true)
    let preparationShown = false
    try {
      if (!isDemoMode) {
        preparationTimerRef.current = window.setTimeout(() => {
          if (!mountedRef.current) return
          preparationShown = true
          setPreparation('waiting')
        }, 300)
        await prepareApi()
        if (preparationTimerRef.current !== null) window.clearTimeout(preparationTimerRef.current)
        preparationTimerRef.current = null
        if (!mountedRef.current) return
        if (preparationShown) {
          setPreparation('ready')
          await new Promise((resolve) => window.setTimeout(resolve, 500))
          if (!mountedRef.current) return
        }
      }
      if (mode === 'login') await login(request.email, request.password)
      else await register({ ...request, sex: request.sex as UserSex })
      if (!mountedRef.current) return
      navigate(getRedirectPath(location.state), { replace: true })
    } catch (err) {
      if (mountedRef.current) {
        setPreparation('idle')
        setError(err instanceof Error ? err.message : 'Ocorreu um erro inesperado.')
      }
    } finally {
      if (preparationTimerRef.current !== null) window.clearTimeout(preparationTimerRef.current)
      preparationTimerRef.current = null
      if (mountedRef.current) setLoading(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="auth-page">
      <section className="auth-intro">
        <div className="brand light"><span className="brand-mark">N</span><span>Dietaday</span></div>
        <div>
          <span className="eyebrow-light"><Leaf size={15} /> Sua rotina, mais leve</span>
          <h1>Comer bem começa por enxergar o caminho.</h1>
          <p>Organize sua dieta, registre refeições e compartilhe o progresso com quem importa.</p>
        </div>
        <ul>
          <li><Check /> Planejamento sem complicação</li>
          <li><Check /> Histórico visual da sua evolução</li>
        </ul>
      </section>
      <section className="auth-form-wrap">
        {preparation !== 'idle' ? (
          <div className="server-wakeup">
            <div className="brand"><span className="brand-mark">N</span><span>Dietaday</span></div>
            {preparation === 'ready' ? (
              <div className="server-ready" role="status" aria-live="polite">
                <span><Check aria-hidden="true" /></span>
                <h2>Aplicativo pronto!</h2>
                <p>Entrando na sua conta...</p>
              </div>
            ) : (
              <>
                <div className="server-wakeup-copy" role="status" aria-live="polite">
                  <span className="overline">Só mais um momento</span>
                  <h2>Preparando aplicativo...</h2>
                  <p>Enquanto os serviços iniciam, encontre os pares de frutas.</p>
                </div>
                <MemoryGame />
              </>
            )}
          </div>
        ) : <div className="auth-form">
          <div className="brand auth-mobile-brand"><span className="brand-mark">N</span><span>Dietaday</span></div>
          <span className="overline">{isLogin ? 'Bem-vindo de volta' : 'Comece agora'}</span>
          <h2>{isLogin ? 'Entre na sua conta' : 'Crie sua conta'}</h2>
          <p>{isLogin ? 'Continue cuidando da sua rotina alimentar.' : 'Leva menos de um minuto.'}</p>
          <form onSubmit={submit}>
            {!isLogin && (
              <>
                <label>
                  Seu nome
                  <input required autoComplete="name" placeholder="Como podemos chamar você?" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
                </label>
                <label>
                  Sexo
                  <select required value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value as UserSex })}>
                    <option value="">Selecione uma opção</option>
                    <option value="FEMALE">Feminino</option>
                    <option value="MALE">Masculino</option>
                  </select>
                </label>
              </>
            )}
            <label>
              E-mail
              <input required type="email" autoComplete="email" placeholder="voce@exemplo.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            <label>
              Senha
              <div className="password-field">
                <input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="Mínimo de 8 caracteres" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
            {error && <div className="error-message" role="alert">{error}</div>}
            {isDemoMode && isLogin && <div className="demo-note">Modo demonstração: os dados já estão preenchidos.</div>}
            <Button type="submit" loading={loading}>{isLogin ? 'Entrar' : 'Criar conta'}<ArrowRight size={18} /></Button>
          </form>
          <p className="auth-switch">
            {isLogin ? 'Ainda não tem conta?' : 'Já possui uma conta?'}{' '}
            <Link to={isLogin ? '/cadastro' : '/login'}>{isLogin ? 'Cadastre-se' : 'Entrar'}</Link>
          </p>
        </div>}
      </section>
      <CreatorCredit className="auth-creator-credit" />
    </div>
  )
}
