// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setReducedMotionPreference } from '../test/matchMedia'

const historyMocks = vi.hoisted(() => ({
  readCached: vi.fn(),
  getHistory: vi.fn(),
}))

vi.mock('../lib/water', () => ({
  readCachedWaterHistory: historyMocks.readCached,
  getWaterHistory: historyMocks.getHistory,
}))
vi.mock('../lib/api', () => ({
  getErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}))

import { WaterMonthlyHistory } from './WaterMonthlyHistory'

const octoberHistory = {
  month: '2026-10',
  days: [
    { date: '2026-10-01', consumedMl: 2000, goalMl: 2000, percentage: 100, hasRecords: true },
    { date: '2026-10-02', consumedMl: 500, goalMl: null, percentage: null, hasRecords: true },
  ],
}

function renderHistory(dietId: string | null = null) {
  return render(<WaterMonthlyHistory userId="history-user" token="history-token" dietId={dietId} />)
}

describe('WaterMonthlyHistory', () => {
  beforeEach(() => {
    historyMocks.readCached.mockReset().mockReturnValue(null)
    historyMocks.getHistory.mockReset().mockResolvedValue(octoberHistory)
    setReducedMotionPreference(true)
  })

  afterEach(cleanup)

  it('is collapsed and does not fetch until expanded, then announces days and selected-day status', async () => {
    renderHistory()

    const accordion = screen.getByRole('button', { name: /Ver histórico mensal/ })
    expect(accordion.getAttribute('aria-expanded')).toBe('false')
    expect(historyMocks.getHistory).not.toHaveBeenCalled()

    fireEvent.click(accordion)
    await waitFor(() => expect(historyMocks.getHistory).toHaveBeenCalledWith(
      'history-token', 'history-user', '2026-10', null,
    ))
    expect(screen.getByText('2 dias registrados neste mês')).toBeTruthy()

    const completedDay = screen.getByRole('button', { name: /Meta atingida/ })
    fireEvent.click(completedDay)
    expect(completedDay.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('progressbar', { name: /Progresso da hidratação/ })).toBeTruthy()
    expect(screen.getByText('2 L de 2 L')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Meta histórica indisponível/ }))
    expect(screen.getByText(/percentual não calculado/)).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('uses a fresh cache entry without refetching the month', async () => {
    historyMocks.readCached.mockReturnValue({ data: octoberHistory, fresh: true })
    renderHistory()
    fireEvent.click(screen.getByRole('button', { name: /Ver histórico mensal/ }))

    expect(await screen.findByText('2 dias registrados neste mês')).toBeTruthy()
    expect(historyMocks.getHistory).not.toHaveBeenCalled()
  })

  it('shows cached results when offline and offers a retry', async () => {
    historyMocks.readCached.mockReturnValue({ data: octoberHistory, fresh: false })
    historyMocks.getHistory.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(octoberHistory)
    renderHistory('competitive-diet')
    fireEvent.click(screen.getByRole('button', { name: /Ver histórico mensal/ }))

    expect(await screen.findByText(/Mostrando os dados salvos neste dispositivo/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    await waitFor(() => expect(historyMocks.getHistory).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText(/Mostrando os dados salvos neste dispositivo/)).toBeNull())
  })
})
