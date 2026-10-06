import { CalendarDays, ChevronLeft, ChevronRight, Coffee, ImageOff, LoaderCircle, MessageCircle, Pencil, RotateCcw, SmilePlus, Trash2, Moon, Sun } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CommentsModal } from '../components/CommentsModal'
import { FeatureHint } from '../components/FeatureHint'
import { AnimatedCard } from '../components/motion/AnimatedCard'
import { AnimatedError } from '../components/motion/AnimatedError'
import { FloatingEmoji } from '../components/motion/FloatingEmoji'
import { SkeletonList } from '../components/motion/SkeletonCard'
import { ReactionPicker } from '../components/ReactionPicker'
import { EmptyState, PageTitle } from '../components/Ui'
import { MOTION_DURATION, MOTION_OFFSET } from '../constants/motion'
import { initialMeals } from '../data'
import { useDietResource } from '../hooks/useDietResource'
import { useFeatureDiscovery } from '../hooks/useFeatureDiscovery'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { mealCommentCount } from '../lib/comments'
import { localDateKey, mealDateKey, mealTime, parseLocalDate } from '../lib/date'
import { nextReactionEmoji, optimisticReactions } from '../lib/mealReactions'
import { createUxEventId, reportUxEvent } from '../lib/uxTelemetry'
import { completeFeatureCampaign } from '../lib/featureDiscoveryTelemetry'
import type { FeatureDiscoveryContext, FeatureDiscoveryResource } from '../lib/featureDiscovery'
import { dietResourceKey, expireCachedResource, readCachedResource, writeCachedResource } from '../lib/resourceCache'
import { useAuth } from '../state/AuthContext'
import { useCelebration } from '../state/CelebrationContext'
import { useDiets } from '../state/DietContext'
import { useOfflineMeals } from '../state/OfflineMealContext'
import type { Meal, MealReaction } from '../types'

const NO_MEALS: Meal[] = []
const MEAL_ICONS = [Coffee, Sun, Moon]
type HistoryDirection = -1 | 0 | 1

function QueuedPhoto({ photo, description }: { photo: Blob; description: string }) {
  const [source, setSource] = useState('')
  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo)
    setSource(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])
  return source ? <img className="meal-thumb" src={source} alt={`Refeição: ${description}`} /> : null
}

function MealPhoto({ source, description }: { source: string; description: string }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  if (failed) return <div className="meal-photo-fallback" role="img" aria-label={`Foto indisponível: ${description}`}><ImageOff aria-hidden="true" /></div>
  return <img className={`meal-thumb${loaded ? ' is-revealed' : ' is-loading'}`} src={source} alt={`Refeição: ${description}`} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
}

export function History() {
  const { token, user } = useAuth()
  const { activeDiet, diets, selectDiet, loading: dietsLoading, error: dietsError } = useDiets()
  const { offlineMeals, operations, retry, discard } = useOfflineMeals()
  const { active: activeCelebration } = useCelebration()
  const [date, setDate] = useState(localDateKey())
  const [pickerMealId, setPickerMealId] = useState<string | null>(null)
  const [reactingMealIds, setReactingMealIds] = useState<Set<string>>(() => new Set())
  const [reactionOverrides, setReactionOverrides] = useState<Record<string, MealReaction[]>>({})
  const [commentsMealId, setCommentsMealId] = useState<string | null>(null)
  const [reactionError, setReactionError] = useState('')
  const [floatingReaction, setFloatingReaction] = useState<{ mealId: string; emoji: string; key: number } | null>(null)
  const [socialUsedDietId, setSocialUsedDietId] = useState<string | null>(null)
  const [dayDirection, setDayDirection] = useState<HistoryDirection>(0)
  const reducedMotion = useReducedMotionPreference()
  const linkedMealRefreshRef = useRef('')
  const [searchParams, setSearchParams] = useSearchParams()
  const mealsResource = useDietResource('meals', initialMeals, NO_MEALS, 'Não foi possível carregar o histórico.')
  const { data: remoteMeals, loading, error } = mealsResource
  const socialHistoryResource = useDietResource<boolean>(
    'meals/social/status',
    isDemoMode,
    true,
    'Não foi possível verificar suas interações sociais.',
  )
  const refreshHistory = useEffectEvent(() => mealsResource.reload())

  useEffect(() => {
    if (!activeDiet) return
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) refreshHistory()
    }
    const timer = window.setInterval(refreshWhenVisible, 60_000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [activeDiet?.id])

  function changeDay(offset: number) {
    const next = parseLocalDate(date)
    next.setDate(next.getDate() + offset)
    setFloatingReaction(null)
    setDayDirection(offset < 0 ? -1 : 1)
    setDate(localDateKey(next))
  }
  const activeOfflineMeals = activeDiet
    ? offlineMeals.filter((meal) => operations.some((operation) => operation.id === meal.operationId && operation.dietId === activeDiet.id))
    : []
  const displayedRemoteMeals = remoteMeals.map((meal) => ({
    ...meal,
    ...(reactionOverrides[meal.id] ? { reactions: reactionOverrides[meal.id] } : {}),
  }))
  const allMeals = [...activeOfflineMeals, ...displayedRemoteMeals]
  const meals = allMeals.filter((meal) => mealDateKey(meal.mealDate) === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const failedOperations = operations.filter((operation) => operation.status === 'failed')
  const commentsMeal = allMeals.find((meal) => meal.id === commentsMealId) ?? null
  const socialHintMeal = !isDemoMode && activeDiet && user
    ? meals.find((meal) => !meal.syncStatus && meal.authorId !== user.id) ?? null
    : null
  const visibleSocialInteraction = allMeals.some((meal) =>
    meal.authorId !== user?.id && !meal.syncStatus && meal.reactions?.some((reaction) => reaction.reactedByMe))
  const hasInteractedWithSocial = Boolean(socialHistoryResource.data
    || socialUsedDietId === activeDiet?.id
    || visibleSocialInteraction)
  const socialInteractionState: FeatureDiscoveryResource<{ hasSyncedMealFromOtherMember: boolean; hasInteracted: boolean }> = !activeDiet
    ? { status: 'ready', data: { hasSyncedMealFromOtherMember: false, hasInteracted: false } }
    : dietsLoading || loading || socialHistoryResource.loading
      ? { status: 'loading' }
      : dietsError || error || socialHistoryResource.error
        ? { status: 'error' }
        : { status: 'ready', data: {
          hasSyncedMealFromOtherMember: Boolean(socialHintMeal),
          hasInteracted: hasInteractedWithSocial,
        } }
  const featureDiscoveryContext: FeatureDiscoveryContext = {
    diet: dietsLoading ? { status: 'loading' } : dietsError
      ? { status: 'error' }
      : { status: 'ready', data: activeDiet ? { competitiveMode: activeDiet.competitiveMode } : null },
    ownMealHistory: { status: 'ready', data: false },
    members: { status: 'ready', data: { count: 0, canInvite: false } },
    hydrationDiscovery: { status: 'ready', data: 'known' },
    waterCheck: { status: 'ready', data: false },
    waterReminders: { status: 'ready', data: { supported: false, enabled: false, blocked: false } },
    socialInteraction: socialInteractionState,
    completedCampaigns: { status: 'ready', data: {} },
  }
  const campaignDietIds = useMemo(() => activeDiet ? { social_interactions: activeDiet.id } : {}, [activeDiet?.id])
  const historyError = error || dietsError || socialHistoryResource.error || reactionError
  const discoveryDataStatus = dietsLoading || loading || socialHistoryResource.loading
    ? 'loading'
    : historyError ? 'error' : 'ready'
  const featureDiscovery = useFeatureDiscovery({
    userId: user?.id ?? null,
    context: featureDiscoveryContext,
    conditions: {
      authenticated: Boolean(user),
      dataStatus: discoveryDataStatus,
      formStatus: 'idle',
      modalOpen: Boolean(commentsMealId || pickerMealId),
      celebrationActive: Boolean(activeCelebration),
      seasonalMessageActive: false,
      operationalError: Boolean(historyError),
    },
    campaignIds: ['social_interactions'],
    dietIdsByCampaign: campaignDietIds,
  })
  const shownSocialHintMeal = featureDiscovery.campaign?.id === 'social_interactions' ? socialHintMeal : null

  function completeSocialDiscovery(dietId: string) {
    if (!user) return
    completeFeatureCampaign(token, user.id, 'social_interactions', 1, { dietId, eventDietId: dietId, page: '/historico' })
    setSocialUsedDietId(dietId)
  }

  useEffect(() => {
    const linkedDietId = searchParams.get('dietId')
    const linkedDate = searchParams.get('date')
    const linkedMealId = searchParams.get('mealId')
    if (linkedDietId && linkedDietId !== activeDiet?.id && diets.some((diet) => diet.id === linkedDietId)) {
      selectDiet(linkedDietId)
      return
    }
    if (linkedDate && /^\d{4}-\d{2}-\d{2}$/.test(linkedDate)) setDate(linkedDate)
    if (!linkedMealId) {
      linkedMealRefreshRef.current = ''
      return
    }
    if (activeDiet && activeDiet.id === (linkedDietId ?? activeDiet.id)) {
      if (allMeals.some((meal) => meal.id === linkedMealId)) {
        setCommentsMealId(linkedMealId)
      } else {
        const refreshKey = `${activeDiet.id}:${linkedMealId}`
        if (linkedMealRefreshRef.current !== refreshKey) {
          linkedMealRefreshRef.current = refreshKey
          refreshHistory()
        }
      }
    }
  }, [activeDiet?.id, diets, remoteMeals, searchParams])

  async function discardOperation(id: string) {
    if (window.confirm('Descartar esta refeição pendente deste dispositivo?')) await discard(id)
  }

  function writeConfirmedReactions(mealId: string, reactions: MealReaction[]) {
    if (!user || !activeDiet) return
    const resource = dietResourceKey(activeDiet.id, 'meals')
    const cachedMeals = readCachedResource<Meal[]>(user.id, resource)?.data ?? remoteMeals
    writeCachedResource(user.id, resource, cachedMeals.map((meal) => meal.id === mealId ? { ...meal, reactions } : meal))
    expireCachedResource(user.id, resource)
    mealsResource.reload()
  }

  function setReactionOverride(mealId: string, reactions: MealReaction[] | null) {
    setReactionOverrides((current) => {
      const next = { ...current }
      if (reactions) next[mealId] = reactions
      else delete next[mealId]
      return next
    })
  }

  function changeCommentCount(meal: Meal, delta: number) {
    if (!user || !activeDiet) return
    const resource = dietResourceKey(activeDiet.id, 'meals')
    const cachedMeals = readCachedResource<Meal[]>(user.id, resource)?.data ?? remoteMeals
    const cachedMeal = cachedMeals.find((item) => item.id === meal.id) ?? meal
    const nextCount = Math.max(0, mealCommentCount(cachedMeal) + delta)
    writeCachedResource(user.id, resource, cachedMeals.map((cachedMeal) => cachedMeal.id === meal.id ? { ...cachedMeal, commentCount: nextCount } : cachedMeal))
  }

  function settleCommentCount() {
    if (!user || !activeDiet) return
    expireCachedResource(user.id, dietResourceKey(activeDiet.id, 'meals'))
    mealsResource.reload()
  }

  function closeComments() {
    setCommentsMealId(null)
    if (!['dietId', 'date', 'mealId', 'commentId'].some((parameter) => searchParams.has(parameter))) return
    const next = new URLSearchParams(searchParams)
    next.delete('dietId')
    next.delete('date')
    next.delete('mealId')
    next.delete('commentId')
    setSearchParams(next, { replace: true })
  }

  async function react(meal: Meal, selectedEmoji: string) {
    if (!activeDiet || !token || !user || reactingMealIds.has(meal.id) || meal.authorId === user.id || meal.syncStatus || isDemoMode) return
    const previous = meal.reactions ?? []
    const ownReaction = previous.find((reaction) => reaction.reactedByMe)?.emoji
    const nextEmoji = nextReactionEmoji(ownReaction, selectedEmoji)
    setPickerMealId(null)
    setReactionError('')
    setReactingMealIds((current) => new Set(current).add(meal.id))
    setReactionOverride(meal.id, optimisticReactions(previous, nextEmoji))
    try {
      const result = await api<{ reactions: MealReaction[] }>(`/diets/${activeDiet.id}/meals/${meal.id}/reaction`, {
        method: nextEmoji ? 'PUT' : 'DELETE',
        token,
        body: nextEmoji ? JSON.stringify({ emoji: nextEmoji }) : undefined,
      })
      writeConfirmedReactions(meal.id, result.reactions)
      setReactionOverride(meal.id, null)
      if (nextEmoji) {
        completeSocialDiscovery(activeDiet.id)
        setFloatingReaction({ mealId: meal.id, emoji: nextEmoji, key: Date.now() })
        void reportUxEvent(token, {
          eventName: 'reaction_created',
          eventId: createUxEventId(`reaction:${meal.id}`),
          dietId: activeDiet.id,
          details: { emoji: nextEmoji },
        })
      }
    } catch (reactionRequestError) {
      setReactionOverride(meal.id, null)
      setReactionError(getErrorMessage(reactionRequestError, 'Não foi possível salvar sua reação.'))
    } finally {
      setReactingMealIds((current) => {
        const next = new Set(current)
        next.delete(meal.id)
        return next
      })
    }
  }

  return (
    <div className="page history-page">
      <PageTitle eyebrow="REGISTROS" title="Histórico por dia" />
       {error && <AnimatedError>{error}</AnimatedError>}
       {reactionError && <AnimatedError>{reactionError}</AnimatedError>}
      {failedOperations.length > 0 && (
        <section className="sync-failures" aria-labelledby="sync-failures-title">
          <div><span>SINCRONIZAÇÃO</span><h2 id="sync-failures-title">Registros que precisam de atenção</h2></div>
          {failedOperations.map((operation) => (
            <article key={operation.id}>
               <div><strong>{operation.request.description}</strong><small>{operation.dietName} · {parseLocalDate(operation.request.mealDate).toLocaleDateString('pt-BR')}</small><p>Não foi possível sincronizar esta refeição agora. Ela continua salva neste dispositivo.</p></div>
              <div className="sync-failure-actions">
                <Link className="button outline" to="/refeicoes/nova" state={{ offlineOperationId: operation.id }}><Pencil /> Editar</Link>
                <button className="button outline" type="button" onClick={() => void retry(operation.id)}><RotateCcw /> Tentar novamente</button>
                <button className="icon-danger" type="button" aria-label={`Descartar ${operation.request.description}`} onClick={() => void discardOperation(operation.id)}><Trash2 /></button>
              </div>
            </article>
          ))}
        </section>
      )}
      <div className="date-switcher">
        <button type="button" onClick={() => changeDay(-1)} aria-label="Dia anterior"><ChevronLeft /></button>
        <div><CalendarDays /><span>{parseLocalDate(date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
        <button type="button" onClick={() => changeDay(1)} aria-label="Próximo dia"><ChevronRight /></button>
      </div>
       {!activeDiet ? (
         <EmptyState icon={<CalendarDays />} title="Nenhuma dieta selecionada" text="Selecione uma dieta para consultar o histórico." />
        ) : (
          <AnimatePresence initial={false} mode="wait">
            {loading && !meals.length ? (
              <motion.div key={`${date}-loading`} className="history-day-content" initial={reducedMotion ? false : { opacity: 0, x: dayDirection * MOTION_OFFSET }} animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? undefined : { opacity: 0, x: -dayDirection * MOTION_OFFSET }} transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.normal / 1000 }}>
                <SkeletonList count={3} />
              </motion.div>
            ) : meals.length ? (
              <motion.div key={date} className="history-day-content" initial={reducedMotion ? false : { opacity: 0, x: dayDirection * MOTION_OFFSET }} animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? undefined : { opacity: 0, x: -dayDirection * MOTION_OFFSET }} transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.normal / 1000 }}>
         <div className="timeline">
          {meals.map((meal, mealIndex) => {
            const Icon = MEAL_ICONS[mealIndex] ?? Sun
            const queuedOperation = operations.find((operation) => operation.id === meal.operationId)
            return (
              <article key={meal.id}>
                <time className="timeline-time" dateTime={meal.createdAt}>{mealTime(meal.createdAt)}</time>
                <div className="timeline-dot" />
                <AnimatedCard delay={mealIndex} className="timeline-card-motion">
                 <div className="timeline-card" tabIndex={-1}>
                   {meal.photoUrl
                     ? <MealPhoto source={meal.photoUrl} description={meal.description} />
                    : queuedOperation?.photo
                      ? <QueuedPhoto photo={queuedOperation.photo} description={meal.description} />
                      : <Icon aria-hidden="true" />}
                  <div className="meal-details">
                    <span>{meal.mealType}</span><h3>{meal.description}</h3><small>Por {meal.authorName}</small>
                    {meal.syncStatus && <b className={`sync-status ${meal.syncStatus}`}>{meal.syncStatus === 'syncing' ? 'Sincronizando' : meal.syncStatus === 'failed' ? 'Falha na sincronização' : 'Aguardando sincronização'}</b>}
                    <div className="meal-engagement">
                      {(meal.reactions?.length || (!meal.syncStatus && meal.authorId !== user?.id && !isDemoMode)) && <div className="meal-reactions" aria-label="Reações da refeição">
                        {meal.reactions?.map((reaction) => (
                           <motion.button
                             type="button"
                             className={`reaction-pill${reaction.reactedByMe ? ' selected' : ''}`}
                             key={reaction.emoji}
                             layout={!reducedMotion ? 'position' : false}
                             whileTap={reducedMotion ? undefined : { scale: 0.9 }}
                             transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.fast / 1000 }}
                             disabled={meal.authorId === user?.id || reactingMealIds.has(meal.id)}
                            aria-label={`${reaction.emoji}, ${reaction.count} ${reaction.count === 1 ? 'reação' : 'reações'}${reaction.reactedByMe ? ', sua reação' : ''}`}
                            onClick={() => void react(meal, reaction.emoji)}
                          >
                            <span>{reaction.emoji}</span><b>{reaction.count}</b>
                           </motion.button>
                        ))}
                        {!meal.syncStatus && meal.authorId !== user?.id && !isDemoMode && (
                          <button
                            type="button"
                            className="add-reaction"
                            disabled={reactingMealIds.has(meal.id)}
                            aria-label="Adicionar reação"
                            aria-expanded={pickerMealId === meal.id}
                            onClick={() => setPickerMealId(meal.id)}
                          >
                            {reactingMealIds.has(meal.id) ? <LoaderCircle className="spin" /> : <SmilePlus />}
                          </button>
                        )}
                       </div>}
                       {floatingReaction?.mealId === meal.id && <FloatingEmoji emoji={floatingReaction.emoji} onComplete={() => setFloatingReaction(null)} />}
                      <button type="button" className="meal-comments-button" disabled={Boolean(meal.syncStatus)} aria-label={`Abrir comentários, ${mealCommentCount(meal)} ${mealCommentCount(meal) === 1 ? 'comentário' : 'comentários'}`} onClick={() => setCommentsMealId(meal.id)}><MessageCircle /><b>{mealCommentCount(meal)}</b></button>
                    </div>
                    {shownSocialHintMeal?.id === meal.id && <FeatureHint
                      title="Converse sobre esta refeição"
                      description="Você pode reagir ou deixar um comentário nesta refeição."
                      actionLabel="Entendi"
                      onVisible={featureDiscovery.onVisible}
                      onAction={featureDiscovery.onClicked}
                      onDismiss={featureDiscovery.onDismissed}
                    />}
                    {pickerMealId === meal.id && <ReactionPicker onClose={() => setPickerMealId(null)} onSelect={(emoji) => void react(meal, emoji)} />}
                  </div>
                 </div>
                </AnimatedCard>
              </article>
            )
          })}
         </div>
              </motion.div>
            ) : (
              <motion.div key={`${date}-empty`} className="history-day-content" initial={reducedMotion ? false : { opacity: 0, x: dayDirection * MOTION_OFFSET }} animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? undefined : { opacity: 0, x: -dayDirection * MOTION_OFFSET }} transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.normal / 1000 }}>
                <EmptyState icon={<CalendarDays />} title="Nenhuma refeição neste dia" text="Seus novos registros aparecerão aqui em ordem de horário." />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      {activeDiet && commentsMeal && <CommentsModal
        key={`${activeDiet.id}:${commentsMeal.id}`}
        dietId={activeDiet.id}
        meal={commentsMeal}
        highlightedCommentId={searchParams.get('commentId')}
        onClose={closeComments}
        onCommentCountChange={(delta) => changeCommentCount(commentsMeal, delta)}
        onCommentCreated={() => { if (commentsMeal.authorId !== user?.id) completeSocialDiscovery(activeDiet.id) }}
        onCommentsSettled={settleCommentCount}
      />}
    </div>
  )
}
