import { useEffect, useState } from 'react'
import { FloatingPoints } from './motion/FloatingPoints'
import { COMPETITIVE_POINTS_EVENT, type CompetitivePointsDetail } from '../lib/competitiveFeedback'
import { useCompetitiveMode } from '../hooks/useCompetitiveMode'

type ActiveFeedback = CompetitivePointsDetail & { key: number }

export function CompetitiveFeedbackOverlay() {
  const { dietId, enabled } = useCompetitiveMode()
  const [feedback, setFeedback] = useState<ActiveFeedback | null>(null)

  useEffect(() => {
    const handlePoints = (event: Event) => {
      const detail = (event as CustomEvent<CompetitivePointsDetail>).detail
      if (!enabled || !dietId || detail.dietId !== dietId || detail.points <= 0) return
      setFeedback({ ...detail, key: Date.now() })
    }

    window.addEventListener(COMPETITIVE_POINTS_EVENT, handlePoints)
    return () => window.removeEventListener(COMPETITIVE_POINTS_EVENT, handlePoints)
  }, [dietId, enabled])

  useEffect(() => {
    setFeedback(null)
  }, [dietId, enabled])

  if (!feedback) return null
  return <div className="competitive-feedback-overlay"><FloatingPoints key={feedback.key} points={feedback.points} onComplete={() => setFeedback(null)} /></div>
}
