export const DAILY_PROGRESS_INVALIDATED_EVENT = 'dietaday:daily-progress-invalidated'

export function emitDailyProgressInvalidated(dietId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<{ dietId: string }>(DAILY_PROGRESS_INVALIDATED_EVENT, { detail: { dietId } }))
}
