import { brazilDateKey } from './date'

export function isDietPeriodEnded(endDate: string, today = brazilDateKey()) {
  return today > endDate
}
