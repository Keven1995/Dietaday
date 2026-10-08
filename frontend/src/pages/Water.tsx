import { Check, Droplets, Save, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FeatureHint } from '../components/FeatureHint'
import { AnimatedCheck, type AnimatedCheckStatus } from '../components/motion/AnimatedCheck'
import { AnimatedCounter } from '../components/motion/AnimatedCounter'
import { AnimatedError } from '../components/motion/AnimatedError'
import { AnimatedProgress } from '../components/motion/AnimatedProgress'
import { WaterBottle } from '../components/motion/WaterBottle'
import { Button, PageTitle } from '../components/Ui'
import { useCompetitiveMode } from '../hooks/useCompetitiveMode'
import { useFeatureDiscovery } from '../hooks/useFeatureDiscovery'
import { usePushStatus } from '../hooks/usePushStatus'
import { crossedThreshold } from '../lib/motionRules'
import { useCelebration } from '../state/CelebrationContext'
import { useWater } from '../state/WaterContext'
import { useToast } from '../state/ToastContext'
import { useAuth } from '../state/AuthContext'
import { reportUxEvent } from '../lib/uxTelemetry'
import type { FeatureDiscoveryContext, FeatureDiscoveryResource } from '../lib/featureDiscovery'
import { WATER_CHECK_OPTIONS, WATER_GOAL_OPTIONS } from '../lib/water'

function formatLiters(amountMl: number) {
  return `${amountMl / 1000}`.replace('.', ',') + ' L'
}

export function Water() {
  const { water, loading, saving, error, saveGoal, addCheck } = useWater()
  const { activeDiet, dietId: competitiveDietId } = useCompetitiveMode()
  const { token, user } = useAuth()
  const { status: pushStatus } = usePushStatus()
  const { active: activeCelebration, celebrate } = useCelebration()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [goal, setGoal] = useState(2000)
  const [checkAmount, setCheckAmount] = useState('')
  const [message, setMessage] = useState('')
  const [feedbackStatus, setFeedbackStatus] = useState<AnimatedCheckStatus>('idle')
  const [justRecordedWater, setJustRecordedWater] = useState(false)
  const campaignEventDietIds = useMemo(() => activeDiet ? { water_reminders: activeDiet.id } : {}, [activeDiet?.id])

  const remindersStatus: FeatureDiscoveryResource<{ supported: boolean; enabled: boolean; blocked: boolean }> =
    pushStatus === 'loading'
      ? { status: 'loading' }
      : pushStatus === 'error'
        ? { status: 'error' }
        : { status: 'ready', data: {
          supported: pushStatus !== 'unsupported' && pushStatus !== 'install-required',
          enabled: pushStatus === 'enabled',
          blocked: pushStatus === 'blocked',
        } }
  const featureDiscoveryContext: FeatureDiscoveryContext = {
    diet: { status: 'ready', data: activeDiet ? { competitiveMode: activeDiet.competitiveMode } : null },
    ownMealHistory: { status: 'ready', data: false },
    members: { status: 'ready', data: { count: 0, canInvite: false } },
    hydrationDiscovery: { status: 'ready', data: 'known' },
    waterCheck: { status: 'ready', data: justRecordedWater },
    waterReminders: remindersStatus,
    socialInteraction: { status: 'ready', data: { hasSyncedMealFromOtherMember: false, hasInteracted: false } },
    completedCampaigns: { status: 'ready', data: {} },
  }
  const discoveryDataStatus = loading || pushStatus === 'loading'
    ? 'loading'
    : error || pushStatus === 'error' ? 'error' : 'ready'
  const featureDiscovery = useFeatureDiscovery({
    userId: user?.id ?? null,
    context: featureDiscoveryContext,
    conditions: {
      authenticated: Boolean(user),
      dataStatus: discoveryDataStatus,
      formStatus: saving ? 'saving' : 'idle',
      modalOpen: false,
      celebrationActive: Boolean(activeCelebration),
      seasonalMessageActive: false,
      operationalError: Boolean(error) || pushStatus === 'error',
    },
    campaignIds: ['water_reminders'],
    eventDietIdsByCampaign: campaignEventDietIds,
  })

  useEffect(() => {
    if (water) {
      setGoal(water.goalMl)
      const firstAvailable = WATER_CHECK_OPTIONS.find((amount) => amount <= water.remainingMl)
      setCheckAmount(firstAvailable ? String(firstAvailable) : '')
    }
  }, [water?.goalMl, water?.remainingMl])

  async function handleGoalSave() {
    setMessage('')
    setFeedbackStatus('loading')
    try {
      await saveGoal(goal)
      setMessage('Sua meta diária foi atualizada.')
      setFeedbackStatus('success')
      showToast({ message: 'Meta de hidratação atualizada.', tone: 'success' })
    } catch {
      setFeedbackStatus('error')
      showToast({ message: 'Não foi possível atualizar sua meta de hidratação.', tone: 'error' })
    }
  }

  async function handleCheck() {
    const amount = Number(checkAmount)
    if (!amount) return
    setMessage('')
    setFeedbackStatus('loading')
    try {
      const previousConsumed = water?.consumedMl ?? 0
      const next = await addCheck(amount)
      setJustRecordedWater(true)
      const pointsMessage = next.pointsEarned ? ` +${next.pointsEarned} pontos confirmados.` : ''
      const completedNow = crossedThreshold(previousConsumed, next.consumedMl, next.goalMl)
      if (completedNow && competitiveDietId) {
        celebrate({ type: 'HYDRATION_GOAL_COMPLETED', id: `${competitiveDietId}:${next.date}` })
      }
      if (completedNow && activeDiet) {
        void reportUxEvent(token, {
          eventName: 'hydration_goal_completed',
          eventId: `hydration-goal:${activeDiet.id}:${next.date}`,
          dietId: activeDiet.id,
          details: { consumedMl: next.consumedMl, goalMl: next.goalMl },
        })
      }
      setMessage(completedNow ? `Meta de hidratação concluída!${pointsMessage}` : `Check registrado. Continue cuidando da sua hidratação! 💧${pointsMessage}`)
      setFeedbackStatus('success')
      showToast({ message: completedNow ? 'Meta de hidratação concluída.' : `Check de ${amount} ml registrado.`, tone: 'success' })
    } catch {
      setFeedbackStatus('error')
      showToast({ message: 'Não foi possível registrar esse check de água.', tone: 'error' })
    }
  }

  const remainingOptions = water ? WATER_CHECK_OPTIONS.filter((amount) => amount <= water.remainingMl) : []
  const complete = water?.remainingMl === 0
  const showReminderHint = featureDiscovery.campaign?.id === 'water_reminders'

  return (
    <div className="page water-page">
      <PageTitle eyebrow="SEU BEM-ESTAR" title="Hidratação" />
      <p className="page-lead">Acompanhe seus checks de água ao longo do dia e transforme pequenos goles em um hábito.</p>
      {error && <AnimatedError>{error}</AnimatedError>}
      {loading && !water ? <p className="loading-text">Carregando sua hidratação...</p> : water && (
        <>
          <section className="water-hero card">
            <div className="water-hero-copy">
              <span className="pill water-pill"><Droplets size={14} /> HOJE</span>
              <h2><span className="water-amount">{formatLiters(water.consumedMl)}</span><span className="water-amount-separator">de</span><span className="water-amount">{formatLiters(water.goalMl)}</span></h2>
              <p>{complete ? 'Meta concluída! Seu corpo agradece.' : `Faltam ${formatLiters(water.remainingMl)} para sua meta de hoje.`}</p>
               <AnimatedProgress className="water-progress" value={water.percentage} label="Progresso da hidratação" />
               <strong><AnimatedCounter value={water.percentage} suffix="% da meta diária" /></strong>
            </div>
            <WaterBottle current={water.consumedMl} goal={water.goalMl} />
          </section>

          <section className="water-grid">
            <div className="card water-action-card">
              <div className="section-heading">
                <div><span>REGISTRAR</span><h2>Já tomou água?</h2></div>
                <Droplets className="water-heading-icon" />
              </div>
              <p>Escolha quanto você bebeu e confirme seu check.</p>
              <label htmlFor="water-check-amount">Quantidade bebida</label>
              <select id="water-check-amount" value={checkAmount} onChange={(event) => setCheckAmount(event.target.value)} disabled={saving || complete}>
                <option value="">Selecione uma quantidade</option>
                {remainingOptions.map((amount) => <option value={amount} key={amount}>{formatLiters(amount)}</option>)}
              </select>
              <Button type="button" loading={saving} disabled={!checkAmount || complete} onClick={() => void handleCheck()}>
                <Check size={18} /> {complete ? 'Meta concluída' : 'Já tomei isso de água'}
              </Button>
                {message && <AnimatedCheck status={feedbackStatus} label={message} />}
              {showReminderHint && <FeatureHint
                title="Lembretes de água"
                description="Quer receber lembretes de água ao longo do dia?"
                actionLabel="Configurar lembretes"
                onVisible={featureDiscovery.onVisible}
                onAction={() => {
                  featureDiscovery.onClicked()
                  navigate('/perfil#lembretes-agua')
                }}
                onDismiss={featureDiscovery.onDismissed}
              />}
            </div>

            <div className="card water-goal-card">
              <div className="section-heading">
                <div><span>SUA META</span><h2>Meta diária</h2></div>
                <Sparkles className="water-heading-icon" />
              </div>
              <p>Sua meta padrão é de 2 L por dia. Ajuste esse valor de acordo com o que melhor se adapta às suas necessidades.</p>
              <label htmlFor="water-goal">Litros por dia</label>
              <select id="water-goal" value={goal} onChange={(event) => setGoal(Number(event.target.value))} disabled={saving || loading}>
                {!WATER_GOAL_OPTIONS.includes(goal) && <option value={goal} disabled>Meta anterior: {formatLiters(goal)} — selecione uma nova</option>}
                {WATER_GOAL_OPTIONS.map((amount) => <option value={amount} key={amount}>{formatLiters(amount)}</option>)}
              </select>
              <Button type="button" className="outline" loading={saving} disabled={loading || !WATER_GOAL_OPTIONS.includes(goal)} onClick={() => void handleGoalSave()}>
                <Save size={18} /> Salvar meta
              </Button>
            </div>
          </section>

          <section className="card water-history-card">
            <div className="section-heading"><div><span>HOJE</span><h2>Checks realizados</h2></div><strong>{water.checks.length}</strong></div>
            {water.checks.length ? <div className="water-check-list">{water.checks.map((check) => <div key={check.id}><span><Check size={15} /> {formatLiters(check.amountMl)}</span><time>{new Date(check.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></div>)}</div> : <p className="muted-text">Nenhum check registrado ainda. Comece pelo próximo copo.</p>}
          </section>
        </>
      )}
    </div>
  )
}
