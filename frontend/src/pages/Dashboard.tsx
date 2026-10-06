import { ArrowRight, Camera, Droplets, Plus, Sparkles, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DailyGoalCard } from '../components/DailyGoalCard'
import { AnimatedCard } from '../components/motion/AnimatedCard'
import { AnimatedError } from '../components/motion/AnimatedError'
import { AnimatedProgress } from '../components/motion/AnimatedProgress'
import { SkeletonCard, SkeletonList } from '../components/motion/SkeletonCard'
import { StreakAnimation } from '../components/motion/StreakAnimation'
import { FeatureHint } from '../components/FeatureHint'
import { EmptyState, PageTitle } from '../components/Ui'
import { initialMeals, initialMembers } from '../data'
import { useDietResource } from '../hooks/useDietResource'
import { useFeatureDiscovery } from '../hooks/useFeatureDiscovery'
import { useHydrationDiscoveryStatus } from '../hooks/useHydrationDiscoveryStatus'
import { isDemoMode } from '../lib/api'
import { completeFeatureCampaign } from '../lib/featureDiscoveryTelemetry'
import { useDailyProgress } from '../hooks/useDailyProgress'
import { localDateKey, mealDateKey, mealTime, parseLocalDate } from '../lib/date'
import { getCalendarMealStatus } from '../lib/dailyCalendar'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import { useOfflineMeals } from '../state/OfflineMealContext'
import { useWater } from '../state/WaterContext'
import { useCelebration } from '../state/CelebrationContext'
import { HalloweenMessage } from '../seasonal/halloween'
import { useHalloween } from '../seasonal/halloween'
import type { FeatureDiscoveryContext, FeatureDiscoveryResource } from '../lib/featureDiscovery'
import type { Meal, Member, WaterToday } from '../types'

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

function TodayMeals({ meals, loading, dateKey, dietName, firstOwnMeal }: { meals: Meal[]; loading: boolean; dateKey: string; dietName: string; firstOwnMeal: boolean }) {
  const isToday = dateKey === localDateKey()
  const showFirstMealPrompt = firstOwnMeal && isToday
  return (
    <section>
      <div className="section-heading">
        <div><span>{isToday ? 'HOJE' : parseLocalDate(dateKey).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</span><h2>Refeições da dieta</h2></div>
        <Link to="/historico">Ver histórico <ArrowRight size={16} /></Link>
      </div>
      {showFirstMealPrompt && <p className="first-meal-guidance">Comece com o que você comeu hoje. O registro vai para {dietName}; a foto é opcional.</p>}
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
      ) : !showFirstMealPrompt && <p className="muted-text">Nenhuma refeição registrada hoje.</p>}
      <Link className="button outline mobile-meal-button" to="/refeicoes/nova"><Plus size={18} /> {firstOwnMeal ? 'Registrar primeira refeição' : 'Registrar refeição'}</Link>
    </section>
  )
}

export function MembersSummary({
  members,
  loading,
  error,
  shareHint,
  onShareVisible,
  onShareClicked,
  onShareDismissed,
  onInvite,
}: {
  members: Member[]
  loading: boolean
  error: boolean
  shareHint: boolean
  onShareVisible: () => void
  onShareClicked: () => void
  onShareDismissed: () => void
  onInvite: () => void
}) {
  if (loading || error) return <SkeletonCard lines={3} className="members-card" />
  if (!members.length) return null
  const isIndividual = members.length === 1
  return (
    <aside className="members-card">
      <div className="members-icon"><Users /></div>
      <span>{isIndividual ? 'DIETA INDIVIDUAL' : 'DIETA COMPARTILHADA'}</span>
      <h2>{isIndividual ? 'Sua rotina individual' : 'Vocês estão juntos'}</h2>
      <p>{members.length} {members.length === 1 ? 'membro acompanha' : 'membros acompanham'} esta dieta.</p>
      <div className="avatar-stack">
        {members.slice(0, 2).map((member) => <i key={member.userId}>{getInitials(member.fullName)}</i>)}
        {members.length > 2 && <i>+{members.length - 2}</i>}
      </div>
      {shareHint && <FeatureHint
        title="Acompanhe sua rotina com alguém"
        description="Convide alguém para registrar refeições nesta dieta com você."
        actionLabel="Convidar alguém"
        onVisible={onShareVisible}
        onAction={() => { onShareClicked(); onInvite() }}
        onDismiss={onShareDismissed}
      />}
      <Link to="/membros">Gerenciar membros <ArrowRight size={16} /></Link>
    </aside>
  )
}

function WaterSummary({
  water,
  hydrationHint,
  onHintVisible,
  onHintClicked,
  onHintDismissed,
  onDiscoverHydration,
}: {
  water: WaterToday | null
  hydrationHint: boolean
  onHintVisible: () => void
  onHintClicked: () => void
  onHintDismissed: () => void
  onDiscoverHydration: () => void
}) {
  if (hydrationHint) return <FeatureHint
    title="Conheça a hidratação"
    description="Seus registros de água também têm espaço aqui."
    actionLabel="Conhecer hidratação"
    onVisible={onHintVisible}
    onAction={() => { onHintClicked(); onDiscoverHydration() }}
    onDismiss={onHintDismissed}
  />
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
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const { diets, activeDiet, loading: dietsLoading, error: dietsError } = useDiets()
  const { offlineMeals, operations, operationsLoaded } = useOfflineMeals()
  const waterState = useWater()
  const hydrationDiscoveryStatus = useHydrationDiscoveryStatus()
  const { active: activeCelebration } = useCelebration()
  const { enabled: seasonalMessageActive } = useHalloween()
  const mealsResource = useDietResource('meals', initialMeals, NO_MEALS, 'Não foi possível carregar as refeições.')
  const demoOwnMealStatus = isDemoMode && mealsResource.data.some((meal) => meal.authorId === user?.id)
  const ownMealHistoryResource = useDietResource<boolean>(
    'meals/mine/status',
    demoOwnMealStatus,
    false,
    'Não foi possível verificar seu histórico de refeições.',
  )
  const membersResource = useDietResource('members', initialMembers, NO_MEMBERS, 'Não foi possível carregar os membros.')
  const dailyProgress = useDailyProgress()
  const [selectedDate, setSelectedDate] = useState(localDateKey())
  const meals = activeDiet
    ? [...offlineMeals.filter((meal) => operations.some((operation) => operation.id === meal.operationId && operation.dietId === activeDiet.id)), ...mealsResource.data]
    : mealsResource.data
  const members = membersResource.data
  const currentMember = members.find((member) => member.userId === user?.id)
  const canInvite = currentMember?.role === 'OWNER'
  const hasPendingOwnMeal = Boolean(activeDiet && user && operations.some((operation) =>
    operation.userId === user.id && operation.dietId === activeDiet.id))
  const needsFirstMealPrompt = Boolean(activeDiet
    && operationsLoaded
    && !hasPendingOwnMeal
    && !ownMealHistoryResource.loading
    && !ownMealHistoryResource.error
    && !ownMealHistoryResource.data)
  const error = dietsError || mealsResource.error || ownMealHistoryResource.error || membersResource.error || dailyProgress.error || waterState.error
  const dietDiscoveryState: FeatureDiscoveryResource<{ competitiveMode: boolean } | null> = dietsLoading
    ? { status: 'loading' }
    : dietsError
      ? { status: 'error' }
      : { status: 'ready', data: activeDiet ? { competitiveMode: activeDiet.competitiveMode } : null }
  const ownMealDiscoveryState: FeatureDiscoveryResource<boolean> = !activeDiet
    ? { status: 'ready', data: false }
    : !operationsLoaded || ownMealHistoryResource.loading
      ? { status: 'loading' }
      : ownMealHistoryResource.error
        ? { status: 'error' }
        : { status: 'ready', data: Boolean(ownMealHistoryResource.data || hasPendingOwnMeal) }
  const membersDiscoveryState: FeatureDiscoveryResource<{ count: number; canInvite: boolean }> = membersResource.loading
    ? { status: 'loading' }
    : membersResource.error
      ? { status: 'error' }
      : { status: 'ready', data: { count: members.length, canInvite } }
  const hydrationDiscoveryState: FeatureDiscoveryResource<'unknown' | 'known'> = waterState.loading
    ? { status: 'loading' }
    : waterState.error
      ? { status: 'error' }
      : hydrationDiscoveryStatus
  const featureDiscoveryContext: FeatureDiscoveryContext = {
    diet: dietDiscoveryState,
    ownMealHistory: ownMealDiscoveryState,
    members: membersDiscoveryState,
    hydrationDiscovery: hydrationDiscoveryState,
    waterCheck: { status: 'loading' },
    waterReminders: { status: 'loading' },
    socialInteraction: { status: 'loading' },
    completedCampaigns: { status: 'ready', data: {} },
  }
  const campaignDietIds = useMemo(() => activeDiet ? { share_diet: activeDiet.id } : {}, [activeDiet?.id])
  const campaignEventDietIds = useMemo(() => activeDiet
    ? { share_diet: activeDiet.id, discover_hydration: activeDiet.id }
    : {}, [activeDiet?.id])
  const discoveryDataStatus: 'ready' | 'loading' | 'error' = dietsLoading
    || membersResource.loading
    || waterState.loading
    || !operationsLoaded
    || ownMealHistoryResource.loading
    ? 'loading'
    : error ? 'error' : 'ready'
  const featureDiscovery = useFeatureDiscovery({
    userId: user?.id ?? null,
    context: featureDiscoveryContext,
    conditions: {
      authenticated: Boolean(user),
      dataStatus: discoveryDataStatus,
      formStatus: 'idle',
      modalOpen: false,
      celebrationActive: Boolean(activeCelebration),
      seasonalMessageActive,
      operationalError: Boolean(error),
    },
    dietIdsByCampaign: campaignDietIds,
    eventDietIdsByCampaign: campaignEventDietIds,
  })
  const showShareHint = featureDiscovery.campaign?.id === 'share_diet' && canInvite
  const showHydrationHint = featureDiscovery.campaign?.id === 'discover_hydration'
  const openMemberInvites = () => {
    if (!activeDiet) return
    navigate('/membros', { state: { featureDiscoveryCampaignId: 'share_diet', featureDiscoveryDietId: activeDiet.id } })
  }
  const openWaterPage = () => navigate('/agua')
  useEffect(() => {
    if (!user || !activeDiet || membersResource.loading || membersResource.error || members.length <= 1) return
    completeFeatureCampaign(token, user.id, 'share_diet', 1, {
      dietId: activeDiet.id,
      eventDietId: activeDiet.id,
      page: '/',
    })
  }, [activeDiet?.id, members.length, membersResource.error, membersResource.loading, token, user?.id])
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

  const showCompetitiveProgress = Boolean(activeDiet?.competitiveMode && dailyProgress.data.dietId === activeDiet.id)

  return (
    <div className="page dashboard">
      <PageTitle eyebrow={today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} title={`Olá, ${firstName}.`} action={activeDiet && <Link className="button desktop-action" to="/refeicoes/nova"><Plus size={18} /> {needsFirstMealPrompt ? 'Registrar primeira refeição' : 'Registrar refeição'}</Link>} />
      <HalloweenMessage />
      {error && <AnimatedError>{error}</AnimatedError>}
      {activeDiet ? (
        <>
          <AnimatedCard delay={0}>
           <section className="hero-card">
            <div>
              <span className="pill"><Sparkles size={14} /> Dieta ativa</span>
              <h2>{activeDiet.name}</h2>
              <p>Você está no {elapsed}º dia de {totalDays}. Um passo de cada vez.</p>
              <AnimatedProgress className="progress" value={progress} label="Período decorrido" />
              <small>Período decorrido <b>{progress}%</b></small>
            </div>
            <div className="hero-number"><strong>{remaining}</strong><span>dias restantes</span></div>
           </section>
           </AnimatedCard>
            <AnimatedCard delay={1}><WaterSummary
              water={waterState.water}
              hydrationHint={showHydrationHint}
              onHintVisible={featureDiscovery.onVisible}
              onHintClicked={featureDiscovery.onClicked}
              onHintDismissed={featureDiscovery.onDismissed}
              onDiscoverHydration={openWaterPage}
            /></AnimatedCard>
           {showCompetitiveProgress && <div className="daily-progress-grid"><AnimatedCard delay={2}><DailyGoalCard progress={dailyProgress.data} /></AnimatedCard><AnimatedCard delay={3}><StreakAnimation days={dailyProgress.data.streakDays} dietId={dailyProgress.data.dietId} eventDate={dailyProgress.data.date} /></AnimatedCard></div>}
            <AnimatedCard delay={showCompetitiveProgress ? 4 : 2}><WeekCalendar dates={days} meals={meals} todayKey={todayKey} selectedKey={selectedDate} periodStart={start} onSelect={setSelectedDate} /></AnimatedCard>
            <div className="dashboard-grid">
              <AnimatedCard delay={showCompetitiveProgress ? 5 : 3}><TodayMeals meals={selectedMeals} loading={mealsResource.loading} dateKey={selectedDate} dietName={activeDiet.name} firstOwnMeal={needsFirstMealPrompt} /></AnimatedCard>
              <AnimatedCard delay={showCompetitiveProgress ? 6 : 4}><MembersSummary
                members={members}
                loading={membersResource.loading}
                error={Boolean(membersResource.error)}
                shareHint={showShareHint}
                onShareVisible={featureDiscovery.onVisible}
                onShareClicked={featureDiscovery.onClicked}
                onShareDismissed={featureDiscovery.onDismissed}
                onInvite={openMemberInvites}
              /></AnimatedCard>
          </div>
        </>
      ) : !dietsLoading && !dietsError && (
        <>
          <EmptyState
            icon={<Sparkles />}
            title={diets.length ? 'Selecione uma dieta' : 'Crie sua primeira dieta'}
            text={diets.length
              ? 'Escolha uma dieta para continuar seus registros.'
              : 'Dê um nome à sua rotina e escolha um período para começar.'}
          />
          <Link className="button empty-action" to="/dietas">
            {diets.length ? 'Selecionar dieta' : 'Criar minha primeira dieta'}
          </Link>
        </>
      )}
    </div>
  )
}
