import { Bell, BellOff, Info, LogOut, Save, UserRound, Shield, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, PageTitle } from '../components/Ui'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { ageOnDate, calculateBmi, classifyAdultBmi } from '../lib/bmi'
import { brazilDateKey } from '../lib/date'
import { useCompetitiveMode } from '../hooks/useCompetitiveMode'
import { usePushStatus } from '../hooks/usePushStatus'
import { completeFeatureCampaign } from '../lib/featureDiscoveryTelemetry'
import { useAuth } from '../state/AuthContext'
import { useWater } from '../state/WaterContext'
import type { User, UserSex } from '../types'
import { disablePushNotifications, enablePushNotifications } from '../lib/pushNotifications'

type ProfileForm = { fullName: string; weight: string; height: string; sex: UserSex | ''; birthDate: string }

function userToForm(user: User | null): ProfileForm {
  return {
    fullName: user?.fullName ?? '',
    weight: user?.weightKg?.toString() ?? '',
    height: user?.heightCm?.toString() ?? '',
    sex: user?.sex === 'MALE' || user?.sex === 'FEMALE' ? user.sex : '',
    birthDate: user?.birthDate ?? '',
  }
}

function formatBmi(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function formatLiters(amountMl: number) {
  return `${amountMl / 1000}`.replace('.', ',') + ' L'
}

export function Profile() {
  const { user, token, updateUser, refreshProfile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const reminderHeadingRef = useRef<HTMLHeadingElement>(null)
  const goalReviewDialogRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const { dietId: competitiveDietId } = useCompetitiveMode()
  const { water, loading: waterLoading, refresh: refreshWater } = useWater()
  const { status: pushStatus, refresh: refreshPushStatus } = usePushStatus()
  const [form, setForm] = useState(() => userToForm(user))
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [pushLoading, setPushLoading] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const [pushError, setPushError] = useState('')
  const [mealNudgesEnabled, setMealNudgesEnabled] = useState(user?.receiveMealNudges !== false)
  const [mealNudgesLoading, setMealNudgesLoading] = useState(false)
  const [mealNudgesMessage, setMealNudgesMessage] = useState('')
  const [mealNudgesError, setMealNudgesError] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const [bmiInfoOpen, setBmiInfoOpen] = useState(false)
  const [goalReviewOpen, setGoalReviewOpen] = useState(false)
  const [goalReviewDeferred, setGoalReviewDeferred] = useState(false)
  const [goalReviewSaving, setGoalReviewSaving] = useState(false)
  const [goalReviewError, setGoalReviewError] = useState('')
  const goalReview = user?.waterGoalSuggestionReview
  const suggestedGoalMl = goalReview?.suggestedGoalMl ?? null
  const hasPendingGoalReview = goalReview?.status === 'PENDING' && suggestedGoalMl !== null

  const deferGoalReview = useCallback(() => {
    setGoalReviewDeferred(true)
    setGoalReviewOpen(false)
    setGoalReviewError('')
  }, [])

  useEffect(() => {
    setForm(userToForm(user))
  }, [user])

  useEffect(() => {
    setMealNudgesEnabled(user?.receiveMealNudges !== false)
  }, [user?.receiveMealNudges])

  useEffect(() => {
    if (location.hash !== '#lembretes-agua') return
    reminderHeadingRef.current?.scrollIntoView({ block: 'center' })
    reminderHeadingRef.current?.focus({ preventScroll: true })
  }, [location.hash])

  useEffect(() => {
    if (!hasPendingGoalReview || goalReviewDeferred) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setGoalReviewOpen(true)
  }, [hasPendingGoalReview, goalReviewDeferred])

  useEffect(() => {
    if (!goalReviewOpen) return
    const focusTimer = window.setTimeout(() => document.getElementById('keep-current-water-goal')?.focus(), 0)
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') deferGoalReview()
    }
    function keepFocusInsideDialog(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !goalReviewDialogRef.current) return
      const focusable = Array.from(goalReviewDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('keydown', keepFocusInsideDialog)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('keydown', keepFocusInsideDialog)
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus()
    }
  }, [goalReviewOpen, deferGoalReview])

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
    if (form.birthDate && form.birthDate > brazilDateKey()) {
      setError('A data de nascimento não pode ser no futuro.')
      return
    }
    setLoading(true)
    try {
      await updateUser({
        fullName,
        weightKg: Number(form.weight),
        heightCm: Number(form.height),
        sex: form.sex,
        birthDate: form.birthDate || null,
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

  async function toggleMealNudges() {
    if (!token) return
    const enabled = !mealNudgesEnabled
    setMealNudgesLoading(true)
    setMealNudgesMessage('')
    setMealNudgesError('')
    try {
      const updated = await api<User>('/profile/meal-nudges', {
        method: 'PUT',
        token,
        body: JSON.stringify({ enabled }),
      })
      setMealNudgesEnabled(updated.receiveMealNudges ?? enabled)
      setMealNudgesMessage(enabled ? 'Você receberá cutucadas sobre refeições.' : 'Recebimento de cutucadas desativado.')
      await refreshProfile().catch(() => undefined)
    } catch (preferenceError) {
      setMealNudgesError(getErrorMessage(preferenceError, 'Não foi possível atualizar essa preferência.'))
    } finally {
      setMealNudgesLoading(false)
    }
  }

  async function decideWaterGoal(decision: 'KEEP_CURRENT' | 'APPLY_RECOMMENDATION') {
    if (!token || !user || !hasPendingGoalReview || goalReviewSaving) return
    setGoalReviewSaving(true)
    setGoalReviewError('')
    try {
      await api('/profile/water-goal-suggestion', {
        method: 'PUT',
        token,
        body: JSON.stringify({ decision, dietId: competitiveDietId }),
      })
      await refreshProfile()
      if (decision === 'APPLY_RECOMMENDATION') await refreshWater()
      setGoalReviewDeferred(true)
      setGoalReviewOpen(false)
    } catch (decisionError) {
      setGoalReviewError(getErrorMessage(decisionError, 'Não foi possível salvar sua escolha. Tente novamente.'))
    } finally {
      setGoalReviewSaving(false)
    }
  }

  const bmi = calculateBmi(form.weight === '' ? null : Number(form.weight), form.height === '' ? null : Number(form.height))
  const age = ageOnDate(form.birthDate || null, brazilDateKey())
  const bmiClassification = age !== null && age >= 18 ? classifyAdultBmi(bmi) : null

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
      {hasPendingGoalReview && !goalReviewOpen && (
        <section className="card water-goal-review-reminder" role="status">
          <p>Sua escolha sobre a sugestão de meta de hidratação continua pendente.</p>
          <Button type="button" className="outline" onClick={() => {
            previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            setGoalReviewDeferred(false)
            setGoalReviewOpen(true)
          }}>Rever sugestão de meta</Button>
        </section>
      )}
      {goalReviewOpen && hasPendingGoalReview && suggestedGoalMl !== null && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && deferGoalReview()}>
          <section ref={goalReviewDialogRef} className="modal water-goal-review-modal" role="dialog" aria-modal="true" aria-labelledby="water-goal-review-title" aria-describedby="water-goal-review-description">
            <button type="button" className="close" onClick={deferGoalReview} disabled={goalReviewSaving} aria-label="Fechar"><X /></button>
            <span className="overline">SUGESTÃO DO SEU PERFIL</span>
            <h2 id="water-goal-review-title">Quer atualizar sua meta de hidratação?</h2>
            <p id="water-goal-review-description">A estimativa é uma referência simplificada, não uma prescrição médica. Você decide se quer manter sua meta ou usar a sugestão.</p>
            <dl className="water-goal-review-values">
              <div><dt>Meta atual</dt><dd>{water ? formatLiters(water.goalMl) : waterLoading ? 'Carregando…' : 'Não disponível'}</dd></div>
              <div><dt>Sugestão</dt><dd>{formatLiters(suggestedGoalMl)}</dd></div>
            </dl>
            {goalReviewError && <div className="error-message" role="alert">{goalReviewError}</div>}
            {goalReviewSaving && <p className="water-goal-review-saving" role="status">Salvando sua escolha…</p>}
            <div className="water-goal-review-actions">
              <Button id="keep-current-water-goal" type="button" className="outline" disabled={goalReviewSaving} onClick={() => void decideWaterGoal('KEEP_CURRENT')}>Manter meta atual</Button>
              <Button type="button" disabled={goalReviewSaving} onClick={() => void decideWaterGoal('APPLY_RECOMMENDATION')}>Usar meta recomendada</Button>
              <button type="button" className="water-goal-review-later" disabled={goalReviewSaving} onClick={deferGoalReview}>Agora não</button>
            </div>
          </section>
        </div>
      )}
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
        <label>
          Data de nascimento
          <input
            type="date"
            autoComplete="bday"
            max={brazilDateKey()}
            value={form.birthDate}
            onChange={(event) => setForm({ ...form, birthDate: event.target.value })}
          />
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
        <section className="profile-bmi" aria-labelledby="profile-bmi-title" aria-live="polite">
          <div className="profile-bmi-heading">
            <h3 id="profile-bmi-title">Índice de Massa Corporal (IMC)</h3>
            <button
              type="button"
              className="profile-bmi-info-trigger"
              aria-label="Como o IMC é calculado?"
              aria-expanded={bmiInfoOpen}
              aria-controls="profile-bmi-info-panel"
              onClick={() => setBmiInfoOpen((open) => !open)}
            >
              <Info size={18} aria-hidden="true" />
            </button>
          </div>
          {bmi === null ? (
            <p className="profile-bmi-result-message">Informe peso e altura válidos para calcular o IMC.</p>
          ) : (
            <p className="profile-bmi-result">
              <strong>{formatBmi(bmi)}</strong>
              {bmiClassification && <span> — {bmiClassification}</span>}
            </p>
          )}
          {bmi !== null && !bmiClassification && (
            <p className="profile-bmi-result-message">
              {age !== null && age < 18
                ? 'Para menores de 18 anos, a interpretação depende da idade e do sexo; a classificação adulta não se aplica.'
                : 'Informe sua data de nascimento para mostrar a classificação de referência para adultos.'}
            </p>
          )}
          {bmiInfoOpen && (
            <div className="profile-bmi-info-panel" id="profile-bmi-info-panel">
              <p>O IMC é calculado dividindo o peso em quilos pela altura em metros ao quadrado. Exemplo: 70 kg ÷ (1,70 × 1,70) = 24,2.</p>
              <p>É uma medida de referência, não um diagnóstico, e não diferencia músculo de gordura. Para menores de 18 anos, a interpretação considera idade e sexo; esta classificação adulta não se aplica.</p>
              <div className="profile-bmi-sources">
                <a href="https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight" target="_blank" rel="noopener noreferrer">OMS: sobrepeso e obesidade</a>
                <a href="https://www.nhs.uk/health-assessment-tools/calculate-your-body-mass-index/calculate-bmi-for-adults/" target="_blank" rel="noopener noreferrer">NHS: cálculo do IMC em adultos</a>
              </div>
            </div>
          )}
        </section>
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
      {!isDemoMode && <section className="card profile-form">
        <h2>Cutucadas de refeição</h2>
        <p>Escolha se seus amigos podem enviar cutucadas quando uma refeição ainda não foi registrada.</p>
        <Button type="button" aria-pressed={mealNudgesEnabled} loading={mealNudgesLoading} className={mealNudgesEnabled ? 'outline' : ''} onClick={() => void toggleMealNudges()}>
          {mealNudgesEnabled ? 'Desativar recebimento' : 'Ativar recebimento'}
        </Button>
        {mealNudgesError && <div className="error-message" role="alert">{mealNudgesError}</div>}
        {mealNudgesMessage && <div className="success-message" role="status">{mealNudgesMessage}</div>}
      </section>}
      <button type="button" className="logout-button" onClick={signOut}><LogOut /> Sair da conta</button>
    </div>
  )
}
