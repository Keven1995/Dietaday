import { ArrowRight, Camera, Plus, Sparkles, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, PageTitle } from '../components/Ui'
import { initialMeals, initialMembers } from '../data'
import { useDietResource } from '../hooks/useDietResource'
import { localDateKey, mealDateKey, mealTime, parseLocalDate } from '../lib/date'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import type { Meal, Member } from '../types'

const NO_MEALS: Meal[] = []
const NO_MEMBERS: Member[] = []

function WeekCalendar({ dates, meals, todayKey, periodStart }: { dates: Date[]; meals: Meal[]; todayKey: string; periodStart: Date }) {
  return (
    <section className="calendar-card">
      <div className="section-heading">
        <div><span>SEU PERÍODO</span><h2>{periodStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2></div>
      </div>
      <div className="week" aria-label="Refeições nesta semana">
        {dates.map((date) => {
          const key = localDateKey(date)
          const hasMeals = meals.some((meal) => mealDateKey(meal.mealDate) === key)
          return (
            <div className={key === todayKey ? 'active' : ''} key={key} aria-current={key === todayKey ? 'date' : undefined}>
              <span>{date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase()}</span>
              <strong>{date.getDate()}</strong>
              {hasMeals && <i aria-label="Possui refeição registrada" />}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TodayMeals({ meals, loading }: { meals: Meal[]; loading: boolean }) {
  return (
    <section>
      <div className="section-heading">
        <div><span>HOJE</span><h2>Refeições da dieta</h2></div>
        <Link to="/historico">Ver histórico <ArrowRight size={16} /></Link>
      </div>
      {loading ? <p className="loading-text">Carregando refeições...</p> : meals.length ? (
        <div className="meal-list">
          {meals.map((meal, index) => (
            <article className="meal-row" key={meal.id}>
              <div className={`meal-icon tone-${index}`}><Camera size={19} /></div>
              <div className="meal-content">
                <span>{meal.mealType}</span>
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

function MembersSummary({ members }: { members: Member[] }) {
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

function getInitials(fullName: string) {
  return fullName.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('')
}

export function Dashboard() {
  const { user } = useAuth()
  const { activeDiet, loading: dietsLoading, error: dietsError } = useDiets()
  const mealsResource = useDietResource('meals', initialMeals, NO_MEALS, 'Não foi possível carregar as refeições.')
  const membersResource = useDietResource('members', initialMembers, NO_MEMBERS, 'Não foi possível carregar os membros.')
  const meals = mealsResource.data
  const members = membersResource.data
  const today = new Date()
  const todayKey = localDateKey(today)

  const start = activeDiet ? parseLocalDate(activeDiet.startDate) : today
  const end = activeDiet ? parseLocalDate(activeDiet.endDate) : today
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1)
  const elapsed = Math.min(totalDays, Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000) + 1))
  const remaining = Math.max(0, totalDays - elapsed)
  const progress = Math.round(elapsed / totalDays * 100)
  const todayMeals = meals.filter((meal) => mealDateKey(meal.mealDate) === todayKey)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return date
  })
  const firstName = user?.fullName.split(' ')[0] ?? ''

  const error = dietsError || mealsResource.error || membersResource.error

  return (
    <div className="page dashboard">
      <PageTitle eyebrow={today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} title={`Olá, ${firstName}.`} action={activeDiet && <Link className="button desktop-action" to="/refeicoes/nova"><Plus size={18} /> Registrar refeição</Link>} />
      {error && <div className="error-message" role="alert">{error}</div>}
      {activeDiet ? (
        <>
          <section className="hero-card">
            <div>
              <span className="pill"><Sparkles size={14} /> Dieta ativa</span>
              <h2>{activeDiet.name}</h2>
              <p>Você está no {elapsed}º dia de {totalDays}. Um passo de cada vez.</p>
              <div className="progress" role="progressbar" aria-label="Progresso da dieta" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
              <small>{elapsed} dias no período <b>{progress}%</b></small>
            </div>
            <div className="hero-number"><strong>{remaining}</strong><span>dias restantes</span></div>
          </section>
          <WeekCalendar dates={days} meals={meals} todayKey={todayKey} periodStart={start} />
          <div className="dashboard-grid">
            <TodayMeals meals={todayMeals} loading={mealsResource.loading} />
            <MembersSummary members={members} />
          </div>
        </>
      ) : !dietsLoading && <EmptyState icon={<Sparkles />} title="Crie sua primeira dieta" text="Escolha um período para começar a registrar suas refeições." />}
    </div>
  )
}
