import { Check, Droplets, Save, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AnimatedCheck, type AnimatedCheckStatus } from '../components/motion/AnimatedCheck'
import { AnimatedCounter } from '../components/motion/AnimatedCounter'
import { AnimatedError } from '../components/motion/AnimatedError'
import { AnimatedProgress } from '../components/motion/AnimatedProgress'
import { WaterBottle } from '../components/motion/WaterBottle'
import { Button, PageTitle } from '../components/Ui'
import { useCompetitiveMode } from '../hooks/useCompetitiveMode'
import { crossedThreshold } from '../lib/motionRules'
import { useCelebration } from '../state/CelebrationContext'
import { useWater } from '../state/WaterContext'

const WATER_OPTIONS = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000]

function formatLiters(amountMl: number) {
  return `${amountMl / 1000}`.replace('.', ',') + ' L'
}

export function Water() {
  const { water, loading, saving, error, saveGoal, addCheck } = useWater()
  const { dietId: competitiveDietId } = useCompetitiveMode()
  const { celebrate } = useCelebration()
  const [goal, setGoal] = useState(2000)
  const [checkAmount, setCheckAmount] = useState('')
  const [message, setMessage] = useState('')
  const [feedbackStatus, setFeedbackStatus] = useState<AnimatedCheckStatus>('idle')

  useEffect(() => {
    if (water) {
      setGoal(water.goalMl)
      const firstAvailable = WATER_OPTIONS.find((amount) => amount <= water.remainingMl)
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
    } catch {
      setFeedbackStatus('error')
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
      const pointsMessage = next.pointsEarned ? ` +${next.pointsEarned} pontos confirmados.` : ''
      const completedNow = crossedThreshold(previousConsumed, next.consumedMl, next.goalMl)
      if (completedNow && competitiveDietId) {
        celebrate({ type: 'HYDRATION_GOAL_COMPLETED', id: `${competitiveDietId}:${next.date}` })
      }
      setMessage(completedNow ? `Meta de hidratação concluída!${pointsMessage}` : `Check registrado. Continue cuidando da sua hidratação! 💧${pointsMessage}`)
      setFeedbackStatus('success')
    } catch {
      setFeedbackStatus('error')
    }
  }

  const remainingOptions = water ? WATER_OPTIONS.filter((amount) => amount <= water.remainingMl) : []
  const complete = water?.remainingMl === 0

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
            </div>

            <div className="card water-goal-card">
              <div className="section-heading">
                <div><span>SUA META</span><h2>Meta diária</h2></div>
                <Sparkles className="water-heading-icon" />
              </div>
              <p>Sua meta padrão é de 2 L por dia. Ajuste esse valor de acordo com o que melhor se adapta às suas necessidades.</p>
              <label htmlFor="water-goal">Litros por dia</label>
              <select id="water-goal" value={goal} onChange={(event) => setGoal(Number(event.target.value))} disabled={saving}>
                {WATER_OPTIONS.map((amount) => <option value={amount} key={amount}>{formatLiters(amount)}</option>)}
              </select>
              <Button type="button" className="outline" loading={saving} onClick={() => void handleGoalSave()}>
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
