import { CalendarDays, ChevronLeft, ChevronRight, Coffee, LoaderCircle, MessageCircle, Pencil, RotateCcw, SmilePlus, Trash2, Moon, Sun } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CommentsModal } from '../components/CommentsModal'
import { ReactionPicker } from '../components/ReactionPicker'
import { EmptyState, PageTitle } from '../components/Ui'
import { initialMeals } from '../data'
import { useDietResource } from '../hooks/useDietResource'
import { api, getErrorMessage, isDemoMode } from '../lib/api'
import { mealCommentCount } from '../lib/comments'
import { localDateKey, mealDateKey, mealTime, parseLocalDate } from '../lib/date'
import { optimisticReactions } from '../lib/mealReactions'
import { dietResourceKey, expireCachedResource, readCachedResource, writeCachedResource } from '../lib/resourceCache'
import { useAuth } from '../state/AuthContext'
import { useDiets } from '../state/DietContext'
import { useOfflineMeals } from '../state/OfflineMealContext'
import type { Meal, MealReaction } from '../types'

const NO_MEALS: Meal[] = []
const MEAL_ICONS = [Coffee, Sun, Moon]

function QueuedPhoto({ photo, description }: { photo: Blob; description: string }) {
  const [source, setSource] = useState('')
  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo)
    setSource(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])
  return source ? <img className="meal-thumb" src={source} alt={`Refeição: ${description}`} /> : null
}

export function History() {
  const { token, user } = useAuth()
  const { activeDiet, diets, selectDiet } = useDiets()
  const { offlineMeals, operations, retry, discard } = useOfflineMeals()
  const [date, setDate] = useState(localDateKey())
  const [pickerMealId, setPickerMealId] = useState<string | null>(null)
  const [reactingMealIds, setReactingMealIds] = useState<Set<string>>(() => new Set())
  const [reactionOverrides, setReactionOverrides] = useState<Record<string, MealReaction[]>>({})
  const [commentsMealId, setCommentsMealId] = useState<string | null>(null)
  const [reactionError, setReactionError] = useState('')
  const linkedMealRefreshRef = useRef('')
  const [searchParams, setSearchParams] = useSearchParams()
  const mealsResource = useDietResource('meals', initialMeals, NO_MEALS, 'Não foi possível carregar o histórico.')
  const { data: remoteMeals, loading, error } = mealsResource
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
    const nextEmoji = ownReaction === selectedEmoji ? null : selectedEmoji
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
      {error && <div className="error-message" role="alert">{error}</div>}
      {reactionError && <div className="error-message" role="alert">{reactionError}</div>}
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
      ) : loading && !meals.length ? (
        <p className="loading-text">Carregando histórico...</p>
      ) : meals.length ? (
        <div className="timeline">
          {meals.map((meal, mealIndex) => {
            const Icon = MEAL_ICONS[mealIndex] ?? Sun
            const queuedOperation = operations.find((operation) => operation.id === meal.operationId)
            return (
              <article key={meal.id}>
                <time className="timeline-time" dateTime={meal.createdAt}>{mealTime(meal.createdAt)}</time>
                <div className="timeline-dot" />
                <div className="timeline-card" tabIndex={-1}>
                  {meal.photoUrl
                    ? <img className="meal-thumb" src={meal.photoUrl} alt={`Refeição: ${meal.description}`} />
                    : queuedOperation?.photo
                      ? <QueuedPhoto photo={queuedOperation.photo} description={meal.description} />
                      : <Icon aria-hidden="true" />}
                  <div className="meal-details">
                    <span>{meal.mealType}</span><h3>{meal.description}</h3><small>Por {meal.authorName}</small>
                    {meal.syncStatus && <b className={`sync-status ${meal.syncStatus}`}>{meal.syncStatus === 'syncing' ? 'Sincronizando' : meal.syncStatus === 'failed' ? 'Falha na sincronização' : 'Aguardando sincronização'}</b>}
                    <div className="meal-engagement">
                      {(meal.reactions?.length || (!meal.syncStatus && meal.authorId !== user?.id && !isDemoMode)) && <div className="meal-reactions" aria-label="Reações da refeição">
                        {meal.reactions?.map((reaction) => (
                          <button
                            type="button"
                            className={`reaction-pill${reaction.reactedByMe ? ' selected' : ''}`}
                            key={reaction.emoji}
                            disabled={meal.authorId === user?.id || reactingMealIds.has(meal.id)}
                            aria-label={`${reaction.emoji}, ${reaction.count} ${reaction.count === 1 ? 'reação' : 'reações'}${reaction.reactedByMe ? ', sua reação' : ''}`}
                            onClick={() => void react(meal, reaction.emoji)}
                          >
                            <span>{reaction.emoji}</span><b>{reaction.count}</b>
                          </button>
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
                      <button type="button" className="meal-comments-button" disabled={Boolean(meal.syncStatus)} aria-label={`Abrir comentários, ${mealCommentCount(meal)} ${mealCommentCount(meal) === 1 ? 'comentário' : 'comentários'}`} onClick={() => setCommentsMealId(meal.id)}><MessageCircle /><b>{mealCommentCount(meal)}</b></button>
                    </div>
                    {pickerMealId === meal.id && <ReactionPicker onClose={() => setPickerMealId(null)} onSelect={(emoji) => void react(meal, emoji)} />}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : <EmptyState icon={<CalendarDays />} title="Nenhuma refeição neste dia" text="Seus novos registros aparecerão aqui em ordem de horário." />}
      {activeDiet && commentsMeal && <CommentsModal key={`${activeDiet.id}:${commentsMeal.id}`} dietId={activeDiet.id} meal={commentsMeal} highlightedCommentId={searchParams.get('commentId')} onClose={closeComments} onCommentCountChange={(delta) => changeCommentCount(commentsMeal, delta)} onCommentsSettled={settleCommentCount} />}
    </div>
  )
}
