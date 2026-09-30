import { LoaderCircle, X } from 'lucide-react'
import { motion } from 'motion/react'
import { lazy, Suspense, useEffect, useRef } from 'react'
import type { EmojiClickData } from 'emoji-picker-react'
import { MOTION_DURATION, MOTION_OFFSET } from '../constants/motion'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'

const EmojiPicker = lazy(() => import('emoji-picker-react'))

export function ReactionPicker({ onClose, onSelect }: { onClose: () => void; onSelect: (emoji: string) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const reducedMotion = useReducedMotionPreference()
  closeRef.current = onClose

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('input, button')?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.matches(':disabled')) {
        previousFocus.closest<HTMLElement>('.timeline-card, [data-comment-id]')?.focus()
      } else {
        previousFocus?.focus()
      }
    }
  }, [])

  return (
    <motion.div
      className="emoji-picker-backdrop"
      role="presentation"
      onMouseDown={onClose}
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.fast / 1000 }}
    >
      <motion.div
        ref={dialogRef}
        className="emoji-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Escolher reação"
        onMouseDown={(event) => event.stopPropagation()}
        initial={reducedMotion ? false : { opacity: 0, y: MOTION_OFFSET }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.normal / 1000, ease: 'easeOut' }}
      >
        <div className="emoji-picker-heading"><strong>Escolha uma reação</strong><button type="button" aria-label="Fechar seletor" onClick={onClose}><X /></button></div>
        <Suspense fallback={<div className="emoji-picker-loading"><LoaderCircle className="spin" /> Carregando emojis...</div>}>
          <EmojiPicker
            width="100%"
            height="min(410px, calc(100vh - 110px))"
            lazyLoadEmojis
            searchPlaceholder="Buscar emoji"
            previewConfig={{ showPreview: false }}
            onEmojiClick={(data: EmojiClickData) => onSelect(data.emoji)}
          />
        </Suspense>
      </motion.div>
    </motion.div>
  )
}
