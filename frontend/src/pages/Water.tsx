import { Check, Droplets, Save, Sparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Button, PageTitle } from '../components/Ui'
import { useWater } from '../state/WaterContext'

const WATER_OPTIONS = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000]

function formatLiters(amountMl: number) {
  return `${amountMl / 1000}`.replace('.', ',') + ' L'
}

function WaterBottle({ percentage }: { percentage: number }) {
  const reducedMotion = useReducedMotion()
  const fillHeight = 312 * percentage / 100
  const fillY = 375 - fillHeight

  return (
    <div className="water-bottle" aria-label={`Garrafa preenchida em ${percentage}%`} role="img">
      <svg viewBox="0 0 220 430" aria-hidden="true">
        <defs>
          <clipPath id="water-bottle-clip">
            <path d="M73 88h74l10 29v226c0 18-14 32-32 32H95c-18 0-32-14-32-32V117z" />
          </clipPath>
          <linearGradient id="water-gradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#80d8dd" />
            <stop offset="1" stopColor="#278ca2" />
          </linearGradient>
        </defs>
        <path className="bottle-shadow" d="M73 88h74l10 29v226c0 18-14 32-32 32H95c-18 0-32-14-32-32V117z" />
        <path className="bottle-body" d="M73 88h74l10 29v226c0 18-14 32-32 32H95c-18 0-32-14-32-32V117z" />
        <g clipPath="url(#water-bottle-clip)">
          <motion.rect
            className="bottle-water"
            x="55"
            width="110"
            initial={false}
            animate={{ y: fillY, height: fillHeight + 20 }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 75, damping: 16 }}
          />
          {percentage > 0 && <motion.path
            className="bottle-wave"
            d="M48 0 Q72 -10 96 0 T144 0 T192 0 V25 H48Z"
            initial={false}
            animate={{ y: fillY - 9 }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 70, damping: 16 }}
          />}
        </g>
        <path className="bottle-highlight" d="M80 133v171c0 10 4 18 10 22" />
        <path className="bottle-neck" d="M87 87V58h46v29" />
        <path className="bottle-cap" d="M84 56h52v-11c0-5-4-9-9-9H93c-5 0-9 4-9 9z" />
        <path className="bottle-label" d="M64 220h92v65H64z" />
        <text x="110" y="248" textAnchor="middle">ÁGUA</text>
        <text x="110" y="267" textAnchor="middle">{percentage}%</text>
      </svg>
    </div>
  )
}

export function Water() {
  const { water, loading, saving, error, saveGoal, addCheck } = useWater()
  const [goal, setGoal] = useState(2000)
  const [checkAmount, setCheckAmount] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (water) {
      setGoal(water.goalMl)
      const firstAvailable = WATER_OPTIONS.find((amount) => amount <= water.remainingMl)
      setCheckAmount(firstAvailable ? String(firstAvailable) : '')
    }
  }, [water?.goalMl, water?.remainingMl])

  async function handleGoalSave() {
    setMessage('')
    try {
      await saveGoal(goal)
      setMessage('Sua meta diária foi atualizada.')
    } catch {
      // The context exposes the translated API error.
    }
  }

  async function handleCheck() {
    const amount = Number(checkAmount)
    if (!amount) return
    setMessage('')
    try {
      await addCheck(amount)
      setMessage('Check registrado. Continue cuidando da sua hidratação! 💧')
    } catch {
      // The context exposes the translated API error.
    }
  }

  const remainingOptions = water ? WATER_OPTIONS.filter((amount) => amount <= water.remainingMl) : []
  const complete = water?.remainingMl === 0

  return (
    <div className="page water-page">
      <PageTitle eyebrow="SEU BEM-ESTAR" title="Hidratação" />
      <p className="page-lead">Acompanhe seus checks de água ao longo do dia e transforme pequenos goles em um hábito.</p>
      {error && <div className="error-message" role="alert">{error}</div>}
      {loading && !water ? <p className="loading-text">Carregando sua hidratação...</p> : water && (
        <>
          <section className="water-hero card">
            <div className="water-hero-copy">
              <span className="pill water-pill"><Droplets size={14} /> HOJE</span>
              <h2><span className="water-amount">{formatLiters(water.consumedMl)}</span><span className="water-amount-separator">de</span><span className="water-amount">{formatLiters(water.goalMl)}</span></h2>
              <p>{complete ? 'Meta concluída! Seu corpo agradece.' : `Faltam ${formatLiters(water.remainingMl)} para sua meta de hoje.`}</p>
              <div className="water-progress" role="progressbar" aria-label="Progresso da hidratação" aria-valuenow={water.percentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${water.percentage}%` }} /></div>
              <strong>{water.percentage}% da meta diária</strong>
            </div>
            <WaterBottle percentage={water.percentage} />
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
              {message && <div className="success-message" role="status">{message}</div>}
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
