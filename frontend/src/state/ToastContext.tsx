import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ToastTone = 'success' | 'warning' | 'error' | 'info'
export type ToastInput = { message: string; tone?: ToastTone; duration?: number }
type Toast = ToastInput & { id: number }

type ToastContextValue = {
  showToast: (input: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  function showToast({ message, tone = 'info', duration = 4200 }: ToastInput) {
    const id = Date.now() + Math.random()
    setToasts((current) => current.some((toast) => toast.message === message && toast.tone === tone)
      ? current
      : [...current, { id, message, tone, duration }].slice(-3))
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), duration)
  }

  useEffect(() => () => setToasts([]), [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-viewport" aria-label="Notificações" aria-live="polite">
        {toasts.map((toast) => <div className={`toast toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'} key={toast.id}>{toast.message}</div>)}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return context
}
