import { CalendarDays, ChevronLeft, ChevronRight, Coffee, Pencil, RotateCcw, Trash2, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, PageTitle } from '../components/Ui'
import { initialMeals } from '../data'
import { useDietResource } from '../hooks/useDietResource'
import { localDateKey, mealDateKey, mealTime, parseLocalDate } from '../lib/date'
import { useDiets } from '../state/DietContext'
import { useOfflineMeals } from '../state/OfflineMealContext'
import type { Meal } from '../types'

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
  const { activeDiet } = useDiets()
  const { offlineMeals, operations, retry, discard } = useOfflineMeals()
  const [date, setDate] = useState(localDateKey())
  const { data: remoteMeals, loading, error } = useDietResource('meals', initialMeals, NO_MEALS, 'Não foi possível carregar o histórico.')

  function changeDay(offset: number) {
    const next = parseLocalDate(date)
    next.setDate(next.getDate() + offset)
    setDate(localDateKey(next))
  }
  const activeOfflineMeals = activeDiet
    ? offlineMeals.filter((meal) => operations.some((operation) => operation.id === meal.operationId && operation.dietId === activeDiet.id))
    : []
  const allMeals = [...activeOfflineMeals, ...remoteMeals]
  const meals = allMeals.filter((meal) => mealDateKey(meal.mealDate) === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const failedOperations = operations.filter((operation) => operation.status === 'failed')

  async function discardOperation(id: string) {
    if (window.confirm('Descartar esta refeição pendente deste dispositivo?')) await discard(id)
  }

  return (
    <div className="page history-page">
      <PageTitle eyebrow="REGISTROS" title="Histórico por dia" />
      {error && <div className="error-message" role="alert">{error}</div>}
      {failedOperations.length > 0 && (
        <section className="sync-failures" aria-labelledby="sync-failures-title">
          <div><span>SINCRONIZAÇÃO</span><h2 id="sync-failures-title">Registros que precisam de atenção</h2></div>
          {failedOperations.map((operation) => (
            <article key={operation.id}>
              <div><strong>{operation.request.description}</strong><small>{operation.dietName} · {parseLocalDate(operation.request.mealDate).toLocaleDateString('pt-BR')}</small><p>{operation.error}</p></div>
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
                <div className="timeline-card">
                  {meal.photoUrl
                    ? <img className="meal-thumb" src={meal.photoUrl} alt={`Refeição: ${meal.description}`} />
                    : queuedOperation?.photo
                      ? <QueuedPhoto photo={queuedOperation.photo} description={meal.description} />
                      : <Icon aria-hidden="true" />}
                  <div><span>{meal.mealType}</span><h3>{meal.description}</h3><small>Por {meal.authorName}</small>{meal.syncStatus && <b className={`sync-status ${meal.syncStatus}`}>{meal.syncStatus === 'syncing' ? 'Sincronizando' : meal.syncStatus === 'failed' ? 'Falha na sincronização' : 'Aguardando sincronização'}</b>}</div>
                </div>
              </article>
            )
          })}
        </div>
      ) : <EmptyState icon={<CalendarDays />} title="Nenhuma refeição neste dia" text="Seus novos registros aparecerão aqui em ordem de horário." />}
    </div>
  )
}
