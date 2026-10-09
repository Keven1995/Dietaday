import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { api, getErrorMessage } from '../lib/api'
import type { MealNudgeEligibility, MealNudgeMealType } from '../types'
import { useToast } from '../state/ToastContext'

type Props = {
  dietId: string
  recipientId: string
  recipientName: string
  token: string | null
  eligibility: MealNudgeEligibility | null
  onSent: (mealType: MealNudgeMealType) => void
}

export function MealNudgeButton({ dietId, recipientId, recipientName, token, eligibility, onSent }: Props) {
  const { showToast } = useToast()
  const [sendingType, setSendingType] = useState<MealNudgeMealType | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [sentFeedback, setSentFeedback] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const statusRef = useRef<HTMLSpanElement | null>(null)
  const sheetTitleRef = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheetTitleRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  useEffect(() => {
    if (!sentFeedback || !eligibility) return
    if (eligibility.meals.some((meal) => meal.eligible)) triggerRef.current?.focus()
    else statusRef.current?.focus()
    setSentFeedback(false)
  }, [eligibility, sentFeedback])

  async function send(mealType: MealNudgeMealType) {
    if (!token || sendingType) return
    setSendingType(mealType)
    setError('')
    try {
      await api(`/diets/${dietId}/meal-nudges`, {
        method: 'POST',
        token,
        body: JSON.stringify({ recipientId, mealType }),
      })
      onSent(mealType)
      setOpen(false)
      setSentFeedback(true)
      showToast({ message: 'Cutucada enviada ✓', tone: 'success' })
    } catch (sendError) {
      const message = getErrorMessage(sendError, 'Não foi possível enviar a cutucada. Tente novamente.')
      setError(message)
    } finally {
      setSendingType(null)
    }
  }

  if (!eligibility) return null

  const eligibleMeals = eligibility.meals.filter((meal) => meal.eligible)
  const sentMeals = eligibility.meals.filter((meal) => meal.alreadySentByMe && meal.reason !== 'ALREADY_REGISTERED')
  if (!eligibleMeals.length) {
    return sentMeals.length ? <span className="meal-nudge-status" role="status" tabIndex={-1} ref={statusRef}>✓ Cutucada enviada</span> : null
  }

  const menuId = `meal-nudge-options-${dietId}-${recipientId}`
  return (
    <div className="meal-nudge-control">
      <button
        type="button"
        ref={triggerRef}
        className="meal-nudge-trigger"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >👀 Cutucar</button>
      {open && <div
        className="meal-nudge-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setOpen(false)
            triggerRef.current?.focus()
          }
        }}
      >
        <div
          className="meal-nudge-sheet"
          id={menuId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${menuId}-title`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button type="button" className="meal-nudge-close" onClick={() => { setOpen(false); triggerRef.current?.focus() }} aria-label="Fechar">
            <X aria-hidden="true" />
          </button>
          <h2 id={`${menuId}-title`} ref={sheetTitleRef} tabIndex={-1}>Escolha a refeição:</h2>
          <p className="meal-nudge-recipient">Para {recipientName}</p>
          <div className="meal-nudge-options">
            {eligibility.meals.filter((meal) => meal.eligible || meal.alreadySentByMe).map((meal) => meal.alreadySentByMe
              ? <span className="meal-nudge-sent-option" key={meal.mealType}>{meal.mealLabel} — ✓ Enviada</span>
              : <button
                type="button"
                key={meal.mealType}
                disabled={sendingType !== null}
                onClick={() => void send(meal.mealType)}
              >{sendingType === meal.mealType ? 'Enviando…' : meal.buttonLabel}</button>)}
          </div>
          {error && <span className="meal-nudge-error" role="alert">{error}</span>}
        </div>
      </div>}
    </div>
  )
}
