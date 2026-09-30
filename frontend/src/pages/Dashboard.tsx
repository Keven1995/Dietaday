import { ArrowRight, Camera, Droplets, Plus, Sparkles, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DailyGoalCard } from '../components/DailyGoalCard'
import { AnimatedCard } from '../components/motion/AnimatedCard'
import { AnimatedError } from '../components/motion/AnimatedError'
import { AnimatedProgress } from '../components/motion/AnimatedProgress'
import { SkeletonCard, SkeletonList } from '../components/motion/SkeletonCard'
import { StreakAnimation } from '../components/motion/StreakAnimation'
import { EmptyState, PageTitle } from '../components/Ui'
import { initialMeals, initialMembers } from '../data'
import { useDietResource } from '../hooks/useDietResource'
import { useDailyProgress } from '../hooks/useDailyProgress'
import { localDateKey, mealDateKey, mealTime, parseLocalDate } from '../lib/date'
import { getCalendarMealStatus } from '../lib/dailyCalendar'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import { useOfflineMeals } from '../state/OfflineMealContext'
import { useWater } from '../state/WaterContext'
import type { Meal, Member } from '../types'

const NO_MEALS: Meal[] = []
const NO_MEMBERS: Member[] = []

function WeekCalendar({ dates, meals, todayKey, selectedKey, periodStart, onSelect }: { dates: Date[]; meals: Meal[]; todayKey: string; selectedKey: string; periodStart: Date; onSelect: (dateKey: string) => void }) {
  return (
    <section className="calendar-card">
      <div className="section-heading">
        <div><span>SEU PERÍODO</span><h2>{periodStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2></div>
      </div>
      <div className="week" aria-label="Refeições nesta semana">
        {dates.map((date) => {
          const key = localDateKey(date)
          const dayMeals = meals.filter((meal) => mealDateKey(meal.mealDate) === key)
          const status = getCalendarMealStatus(dayMeals)
          const isSelected = key === selectedKey
          const isToday = key === todayKey
          return (
            <button
              className={`calendar-day is-${status}${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
              type="button"
              key={key}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSelected}
              aria-label={`${date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}: ${status === 'completed' ? 'meta completa' : status === 'partial' ? 'progresso parcial' : 'sem refeições'}${isToday ? ', hoje' : ''}`}
              onClick={() => onSelect(key)}
            >
              <span>{date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase()}</span>
              <strong>{date.getDate()}</strong>
              <i aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </section>
  )
}

function TodayMeals({ meals, loading, dateKey }: { meals: Meal[]; loading: boolean; dateKey: string }) {
  const isToday = dateKey === localDateKey()
  return (
    <section>
      <div className="section-heading">
        <div><span>{isToday ? 'HOJE' : parseLocalDate(dateKey).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</span><h2>Refeições da dieta</h2></div>
        <Link to="/historico">Ver histórico <ArrowRight size={16} /></Link>
      </div>
      {loading && !meals.length ? <SkeletonList count={3} /> : meals.length ? (
        <div className="meal-list">
          {meals.map((meal, index) => (
            <article className="meal-row" key={meal.id}>
              <div className={`meal-icon tone-${index}`}><Camera size={19} /></div>
              <div className="meal-content">
                <span>{meal.mealType}{meal.syncStatus && <> · {meal.syncStatus === 'syncing' ? 'Sincronizando' : meal.syncStatus === 'failed' ? 'Falha' : 'Pendente'}</>}</span>
                <h3>{meal.description}</h3>
                <div className="meal-author"><i aria-hidden="true">{getInitials(meal.authorName)}</i><small>{meal.authorName}</small></div>
              </div>
              <time dateTime={meal.createdAt}>{mealTime(meal.createdAt)}</time>
            </article>
          ))}
        </div>
      ) : <p className="muted-text">Nenhuma refeição registrada hoje.</p>}
      <Link className="button outline mobile-meal-button" to="/refeicoes/nova"><Plus size={18} /> Registrar refeição</Link>
    </section>
  )
}

function MembersSummary({ members, loading }: { members: Member[]; loading: boolean }) {
  if (loading && !members.length) return <SkeletonCard lines={3} className="members-card" />
  return (
    <aside className="members-card">
      <div className="members-icon"><Users /></div>
      <span>DIETA COMPARTILHADA</span>
      <h2>Vocês estão juntos</h2>
      <p>{members.length} {members.length === 1 ? 'membro acompanha' : 'membros acompanham'} esta dieta.</p>
      <div className="avatar-stack">
        {members.slice(0, 2).map((member) => <i key={member.userId}>{getInitials(member.fullName)}</i>)}
        {members.length > 2 && <i>+{members.length - 2}</i>}
      </div>
      <Link to="/membros">Gerenciar membros <ArrowRight size={16} /></Link>
    </aside>
  )
}

function WaterSummary() {
  const { water } = useWater()
  if (!water) return null
  const consumed = (water.consumedMl / 1000).toString().replace('.', ',')
  const goal = (water.goalMl / 1000).toString().replace('.', ',')
  return (
    <Link to="/agua" className="water-summary-card">
      <div className="water-summary-icon"><Droplets size={21} /></div>
      <div>
        <span>HIDRATAÇÃO</span>
        <h2>{consumed} L <small>de {goal} L</small></h2>
        <AnimatedProgress className="water-summary-progress" value={water.percentage} label="Progresso da hidratação" />
      </div>
      <ArrowRight size={18} />
    </Link>
  )
}

function getInitials(fullName: string) {
  return fullName.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('')
}

export function Dashboard() {
  const { user } = useAuth()
  const { activeDiet, loading: dietsLoading, error: dietsError } = useDiets()
  const { offlineMeals, operations } = useOfflineMeals()
  const mealsResource = useDietResource('meals', initialMeals, NO_MEALS, 'Não foi possível carregar as refeições.')
  const membersResource = useDietResource('members', initialMembers, NO_MEMBERS, 'Não foi possível carregar os membros.')
  const dailyProgress = useDailyProgress()
  const [selectedDate, setSelectedDate] = useState(localDateKey())
  const meals = activeDiet
    ? [...offlineMeals.filter((meal) => operations.some((operation) => operation.id === meal.operationId && operation.dietId === activeDiet.id)), ...mealsResource.data]
    : mealsResource.data
  const members = membersResource.data
  const today = new Date()
  const todayKey = localDateKey(today)

  const start = activeDiet ? parseLocalDate(activeDiet.startDate) : today
  const end = activeDiet ? parseLocalDate(activeDiet.endDate) : today
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1)
  const elapsed = Math.min(totalDays, Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000) + 1))
  const remaining = Math.max(0, totalDays - elapsed)
  const progress = Math.round(elapsed / totalDays * 100)
  const selectedMeals = meals.filter((meal) => mealDateKey(meal.mealDate) === selectedDate)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return date
  })
  const firstName = user?.fullName.split(' ')[0] ?? ''

  const error = dietsError || mealsResource.error || membersResource.error || dailyProgress.error
  const showCompetitiveProgress = Boolean(activeDiet?.competitiveMode && dailyProgress.data.dietId === activeDiet.id)

  return (
    <div className="page dashboard">
      <PageTitle eyebrow={today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} title={`Olá, ${firstName}.`} action={activeDiet && <Link className="button desktop-action" to="/refeicoes/nova"><Plus size={18} /> Registrar refeição</Link>} />
      {error && <AnimatedError>{error}</AnimatedError>}
      {activeDiet ? (
        <>
          <AnimatedCard delay={0}>
           <section className="hero-card">
            <div>
              <span className="pill"><Sparkles size={14} /> Dieta ativa</span>
              <h2>{activeDiet.name}</h2>
              <p>Você está no {elapsed}º dia de {totalDays}. Um passo de cada vez.</p>
              <AnimatedProgress className="progress" value={progress} label="Progresso da dieta" />
              <small>{elapsed} dias no período <b>{progress}%</b></small>
            </div>
            <div className="hero-number"><strong>{remaining}</strong><span>dias restantes</span></div>
           </section>
           </AnimatedCard>
           <AnimatedCard delay={1}><WaterSummary /></AnimatedCard>
           {showCompetitiveProgress && <div className="daily-progress-grid"><AnimatedCard delay={2}><DailyGoalCard progress={dailyProgress.data} /></AnimatedCard><AnimatedCard delay={3}><StreakAnimation days={dailyProgress.data.streakDays} dietId={dailyProgress.data.dietId} eventDate={dailyProgress.data.date} /></AnimatedCard></div>}
            <AnimatedCard delay={showCompetitiveProgress ? 4 : 2}><WeekCalendar dates={days} meals={meals} todayKey={todayKey} selectedKey={selectedDate} periodStart={start} onSelect={setSelectedDate} /></AnimatedCard>
            <div className="dashboard-grid">
              <AnimatedCard delay={showCompetitiveProgress ? 5 : 3}><TodayMeals meals={selectedMeals} loading={mealsResource.loading} dateKey={selectedDate} /></AnimatedCard>
             <AnimatedCard delay={showCompetitiveProgress ? 6 : 4}><MembersSummary members={members} loading={membersResource.loading} /></AnimatedCard>
          </div>
        </>
      ) : !dietsLoading && <EmptyState icon={<Sparkles />} title="Crie sua primeira dieta" text="Escolha um período para começar a registrar suas refeições." />}
    </div>
  )
}
