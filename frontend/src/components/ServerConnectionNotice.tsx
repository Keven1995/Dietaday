import { Check, LoaderCircle, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SERVER_STATUS_EVENT, type ServerStatus } from '../lib/serverWakeup'

export function ServerConnectionNotice() {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const handleStatus = (event: Event) => {
      const nextStatus = (event as CustomEvent<ServerStatus>).detail
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current)
      setStatus(nextStatus)
      if (nextStatus !== 'waking') {
        hideTimerRef.current = window.setTimeout(() => setStatus(null), nextStatus === 'ready' ? 1200 : 5000)
      }
    }
    window.addEventListener(SERVER_STATUS_EVENT, handleStatus)
    return () => {
      window.removeEventListener(SERVER_STATUS_EVENT, handleStatus)
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  if (!status) return null

  const content = status === 'waking'
    ? { icon: <LoaderCircle className="spin" />, title: 'Reconectando ao aplicativo...', text: 'Sua solicitação continuará assim que os serviços responderem.' }
    : status === 'ready'
      ? { icon: <Check />, title: 'Conexão restabelecida', text: 'Continuando sua solicitação.' }
      : { icon: <WifiOff />, title: 'Não foi possível reconectar', text: 'Verifique sua internet e tente novamente.' }

  return (
    <div className={`server-connection-notice ${status}`} role="status" aria-live="polite">
      <span aria-hidden="true">{content.icon}</span>
      <div><strong>{content.title}</strong><small>{content.text}</small></div>
    </div>
  )
}
