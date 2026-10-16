import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

type PhotoLightboxProps = {
  source: string
  description: string
  onClose: () => void
}

export function PhotoLightbox({ source, description, onClose }: PhotoLightboxProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)')]
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
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  return (
    <div className="photo-lightbox-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="photo-lightbox" role="dialog" aria-modal="true" aria-label={`Foto ampliada: ${description}`}>
        <button type="button" className="photo-lightbox-close" onClick={onClose} aria-label="Fechar foto ampliada">
          <X aria-hidden="true" />
        </button>
        <img src={source} alt={`Foto ampliada da refeição: ${description}`} />
      </section>
    </div>
  )
}
