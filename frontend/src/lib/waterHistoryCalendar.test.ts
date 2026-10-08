import { describe, expect, it } from 'vitest'
import {
  shiftWaterHistoryMonth,
  waterCalendarCells,
  waterHistoryDayStatus,
  waterHistoryDayStatusLabel,
  waterHistoryMonthLabel,
} from './waterHistoryCalendar'

describe('water history calendar helpers', () => {
  it('builds a Monday-first calendar using the requested month', () => {
    const cells = waterCalendarCells('2026-10')

    expect(cells.slice(0, 3)).toEqual([null, null, null])
    expect(cells[3]).toEqual({ date: '2026-10-01', dayNumber: 1 })
    expect(cells.filter(Boolean)).toHaveLength(31)
  })

  it('changes months across year boundaries and labels them in Portuguese', () => {
    expect(shiftWaterHistoryMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftWaterHistoryMonth('2026-12', 1)).toBe('2027-01')
    expect(waterHistoryMonthLabel('2026-10')).toBe('outubro de 2026')
  })

  it('distinguishes future, empty, unavailable-goal, completed, and below-goal days', () => {
    expect(waterHistoryDayStatus('2026-10-09', '2026-10-08')).toBe('FUTURE')
    expect(waterHistoryDayStatus('2026-10-07', '2026-10-08')).toBe('NO_RECORDS')
    expect(waterHistoryDayStatus('2026-10-06', '2026-10-08', {
      date: '2026-10-06', consumedMl: 0, goalMl: 2000, percentage: null, hasRecords: false,
    })).toBe('NO_RECORDS')
    expect(waterHistoryDayStatus('2026-10-05', '2026-10-08', {
      date: '2026-10-05', consumedMl: 500, goalMl: null, percentage: null, hasRecords: true,
    })).toBe('GOAL_UNAVAILABLE')
    expect(waterHistoryDayStatus('2026-10-04', '2026-10-08', {
      date: '2026-10-04', consumedMl: 2000, goalMl: 2000, percentage: 100, hasRecords: true,
    })).toBe('GOAL_REACHED')
    expect(waterHistoryDayStatus('2026-10-03', '2026-10-08', {
      date: '2026-10-03', consumedMl: 500, goalMl: 2000, percentage: 25, hasRecords: true,
    })).toBe('BELOW_GOAL')
    expect(waterHistoryDayStatusLabel('GOAL_UNAVAILABLE')).toBe('Meta histórica indisponível')
  })
})
