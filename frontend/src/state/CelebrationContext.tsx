import { createContext, useContext, useState, type ReactNode } from 'react'
import { CelebrationOverlay } from '../components/CelebrationOverlay'

export type CelebrationType = 'DAILY_GOAL_COMPLETED' | 'HYDRATION_GOAL_COMPLETED' | 'STREAK_INCREMENTED'
export type CelebrationRequest = { type: CelebrationType; id: string }
export type ActiveCelebration = CelebrationRequest & { key: string }

type CelebrationContextValue = {
  celebrate: (request: CelebrationRequest) => void
}

const CelebrationContext = createContext<CelebrationContextValue | null>(null)
const STORAGE_KEY = 'Dietaday_celebrations'

function readCelebrated() {
  try {
    return new Set<string>(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    return new Set<string>()
  }
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveCelebration | null>(null)
  const [celebrated] = useState(readCelebrated)

  function celebrate(request: CelebrationRequest) {
    const key = `${request.type}:${request.id}`
    if (celebrated.has(key)) return
    celebrated.add(key)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...celebrated].slice(-100)))
    setActive({ ...request, key })
  }

  return <CelebrationContext.Provider value={{ celebrate }}>
    {children}
    <CelebrationOverlay celebration={active} onDismiss={() => setActive(null)} />
  </CelebrationContext.Provider>
}

export function useCelebration() {
  const context = useContext(CelebrationContext)
  if (!context) throw new Error('useCelebration deve ser usado dentro de CelebrationProvider')
  return context
}
