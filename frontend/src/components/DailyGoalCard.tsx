import { useEffect, useEffectEvent, useRef } from 'react'
import { AnimatedCounter } from './motion/AnimatedCounter'
import { AnimatedProgress } from './motion/AnimatedProgress'
import { useCelebration } from '../state/CelebrationContext'
import { useAuth } from '../state/AuthContext'
import { reportUxEvent } from '../lib/uxTelemetry'
import type { DailyProgress } from '../types'

type DailyGoalCardProps = {
  progress: DailyProgress
}

export function DailyGoalCard({ progress }: DailyGoalCardProps) {
  const { celebrate } = useCelebration()
  const { token } = useAuth()
  const celebrateEvent = useEffectEvent(celebrate)
  const previousCompleted = useRef<{ dietId: string; completed: boolean } | null>(null)

  useEffect(() => {
    const previous = previousCompleted.current
    previousCompleted.current = { dietId: progress.dietId, completed: progress.dailyGoalCompleted }
    if (previous?.dietId === progress.dietId && previous.completed === false && progress.dailyGoalCompleted) {
      celebrateEvent({ type: 'DAILY_GOAL_COMPLETED', id: `${progress.dietId}:${progress.date}` })
      void reportUxEvent(token, {
        eventName: 'daily_goal_completed',
        eventId: `daily-goal:${progress.dietId}:${progress.date}`,
        dietId: progress.dietId,
        details: { completedMeals: progress.completedMeals, dailyGoal: progress.dailyGoal },
      })
    }
  }, [progress.dailyGoalCompleted, progress.dietId, progress.date, token])

  const percentage = progress.dailyGoal ? progress.completedMeals * 100 / progress.dailyGoal : 0
  return <section className="daily-goal-card card">
    <div className="section-heading"><div><span>META DO DIA</span><h2>Seis refeições</h2></div><strong><AnimatedCounter value={progress.completedMeals} />/{progress.dailyGoal}</strong></div>
    <AnimatedProgress className="daily-goal-progress" value={percentage} label="Progresso da meta diária" />
    <p>{progress.dailyGoalCompleted ? 'Meta diária concluída. Muito bem!' : `Registre ${Math.max(0, progress.dailyGoal - progress.completedMeals)} ${progress.dailyGoal - progress.completedMeals === 1 ? 'refeição' : 'refeições'} para concluir.`}</p>
    <div className="daily-meal-types" aria-label="Refeições concluídas">
      {['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'].map((mealType) => <span className={progress.completedMealTypes.includes(mealType) ? 'completed' : ''} key={mealType}>{progress.completedMealTypes.includes(mealType) ? '✓' : '○'} {mealType}</span>)}
    </div>
  </section>
}
