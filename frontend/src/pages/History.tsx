import { CalendarDays, ChevronLeft, ChevronRight, Coffee, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, PageTitle } from '../components/Ui'
import { initialMeals } from '../data'
import { useDietResource } from '../hooks/useDietResource'
import { localDateKey, mealDateKey, mealTime, parseLocalDate } from '../lib/date'
import { useDiets } from '../state/DietContext'
import type { Meal } from '../types'

const NO_MEALS: Meal[] = []
const MEAL_ICONS = [Coffee, Sun, Moon]

export function History() {
  const { activeDiet } = useDiets()
  const [date, setDate] = useState(localDateKey())
  const { data: allMeals, loading, error } = useDietResource('meals', initialMeals, NO_MEALS, 'Não foi possível carregar o histórico.')

  function changeDay(offset: number) {
    const next = parseLocalDate(date)
    next.setDate(next.getDate() + offset)
    setDate(localDateKey(next))
  }
  const meals = allMeals.filter((meal) => mealDateKey(meal.mealDate) === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return (
    <div className="page history-page">
      <PageTitle eyebrow="REGISTROS" title="Histórico por dia" />
      {error && <div className="error-message" role="alert">{error}</div>}
      <div className="date-switcher">
        <button type="button" onClick={() => changeDay(-1)} aria-label="Dia anterior"><ChevronLeft /></button>
        <div><CalendarDays /><span>{parseLocalDate(date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
        <button type="button" onClick={() => changeDay(1)} aria-label="Próximo dia"><ChevronRight /></button>
      </div>
      {!activeDiet ? (
        <EmptyState icon={<CalendarDays />} title="Nenhuma dieta selecionada" text="Selecione uma dieta para consultar o histórico." />
      ) : loading ? (
        <p className="loading-text">Carregando histórico...</p>
      ) : meals.length ? (
        <div className="timeline">
          {meals.map((meal, mealIndex) => {
            const Icon = MEAL_ICONS[mealIndex] ?? Sun
            return (
              <article key={meal.id}>
                <time className="timeline-time" dateTime={meal.createdAt}>{mealTime(meal.createdAt)}</time>
                <div className="timeline-dot" />
                <div className="timeline-card">
                  {meal.photoUrl ? <img className="meal-thumb" src={meal.photoUrl} alt={`Refeição: ${meal.description}`} /> : <Icon aria-hidden="true" />}
                  <div><span>{meal.mealType}</span><h3>{meal.description}</h3><small>Por {meal.authorName}</small></div>
                </div>
              </article>
            )
          })}
        </div>
      ) : <EmptyState icon={<CalendarDays />} title="Nenhuma refeição neste dia" text="Seus novos registros aparecerão aqui em ordem de horário." />}
    </div>
  )
}
