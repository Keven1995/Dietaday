import type { WaterHistoryDay } from '../types'

export type WaterHistoryDayStatus = 'FUTURE' | 'NO_RECORDS' | 'GOAL_UNAVAILABLE' | 'GOAL_REACHED' | 'BELOW_GOAL'

export type WaterCalendarCell = { date: string; dayNumber: number } | null

function yearMonthParts(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Mês inválido')
  const [year, monthNumber] = month.split('-').map(Number)
  return { year, monthNumber }
}

export function shiftWaterHistoryMonth(month: string, offset: number) {
  const { year, monthNumber } = yearMonthParts(month)
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
  const nextYear = shifted.getUTCFullYear()
  const nextMonth = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  return `${nextYear}-${nextMonth}`
}

export function waterHistoryMonthLabel(month: string) {
  yearMonthParts(month)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00.000Z`))
}

export function waterHistoryDateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00.000Z`))
}

export function waterCalendarCells(month: string): WaterCalendarCell[] {
  const { year, monthNumber } = yearMonthParts(month)
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const leadingCells = (firstWeekday + 6) % 7
  return [
    ...Array.from({ length: leadingCells }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1
      return { date: `${month}-${String(dayNumber).padStart(2, '0')}`, dayNumber }
    }),
  ]
}

export function waterHistoryDayStatus(date: string, today: string, day?: WaterHistoryDay): WaterHistoryDayStatus {
  if (date > today) return 'FUTURE'
  if (!day || !day.hasRecords) return 'NO_RECORDS'
  if (day.goalMl === null || day.percentage === null) return 'GOAL_UNAVAILABLE'
  return day.consumedMl >= day.goalMl ? 'GOAL_REACHED' : 'BELOW_GOAL'
}

export function waterHistoryDayStatusLabel(status: WaterHistoryDayStatus) {
  switch (status) {
    case 'FUTURE': return 'Futuro'
    case 'NO_RECORDS': return 'Sem registros'
    case 'GOAL_UNAVAILABLE': return 'Meta histórica indisponível'
    case 'GOAL_REACHED': return 'Meta atingida'
    case 'BELOW_GOAL': return 'Abaixo da meta'
  }
}
