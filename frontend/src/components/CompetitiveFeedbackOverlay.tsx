import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FloatingPoints } from './motion/FloatingPoints'
import { COMPETITIVE_POINTS_EVENT, type CompetitivePointsDetail } from '../lib/competitiveFeedback'
import { useCompetitiveMode } from '../hooks/useCompetitiveMode'

type ActiveFeedback = CompetitivePointsDetail & { key: number; shown: boolean }

export function CompetitiveFeedbackOverlay() {
  const { dietId, enabled } = useCompetitiveMode()
  const location = useLocation()
  const [feedback, setFeedback] = useState<ActiveFeedback | null>(null)

  useEffect(() => {
    const handlePoints = (event: Event) => {
      const detail = (event as CustomEvent<CompetitivePointsDetail>).detail
      if (!enabled || !dietId || detail.dietId !== dietId || detail.points <= 0) return
      setFeedback({ ...detail, key: Date.now(), shown: false })
    }

    window.addEventListener(COMPETITIVE_POINTS_EVENT, handlePoints)
    return () => window.removeEventListener(COMPETITIVE_POINTS_EVENT, handlePoints)
  }, [dietId, enabled])

  useEffect(() => {
    setFeedback(null)
  }, [dietId, enabled])

  useEffect(() => {
    if (!feedback) return
    if (location.pathname === '/refeicoes/nova') {
      if (feedback.shown) setFeedback(null)
      return
    }
    if (!feedback.shown) {
      setFeedback((current) => current?.key === feedback.key ? { ...current, shown: true } : current)
    }
  }, [feedback, location.pathname])

  if (!feedback || !feedback.shown || location.pathname === '/refeicoes/nova') return null
  return <div className="competitive-feedback-overlay"><FloatingPoints key={feedback.key} points={feedback.points} onComplete={() => setFeedback(null)} /></div>
}
