// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MealNudgeEligibility } from '../types'

const mocks = vi.hoisted(() => ({ api: vi.fn() }))

vi.mock('../lib/api', () => ({
  api: mocks.api,
  getErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}))

import { MealNudgeButton } from './MealNudgeButton'
import { ToastProvider } from '../state/ToastContext'

const eligibility: MealNudgeEligibility = {
  recipientId: 'friend-1',
  mealDate: '2026-10-09',
  meals: [
    { mealType: 'BREAKFAST', mealLabel: 'Café da manhã', buttonLabel: '👀 Cadê o café da manhã?', eligible: false, alreadySentByMe: false, reason: 'ALREADY_REGISTERED' },
    { mealType: 'MORNING_SNACK', mealLabel: 'Lanche da manhã', buttonLabel: '👀 Cadê o lanche da manhã?', eligible: false, alreadySentByMe: false, reason: 'ALREADY_REGISTERED' },
    { mealType: 'LUNCH', mealLabel: 'Almoço', buttonLabel: '👀 Cadê o almoço?', eligible: true, alreadySentByMe: false, reason: null },
    { mealType: 'AFTERNOON_SNACK', mealLabel: 'Lanche da tarde', buttonLabel: '👀 Cadê o lanche da tarde?', eligible: false, alreadySentByMe: false, reason: 'ALREADY_REGISTERED' },
    { mealType: 'DINNER', mealLabel: 'Jantar', buttonLabel: '👀 Cadê o jantar?', eligible: false, alreadySentByMe: false, reason: 'ALREADY_REGISTERED' },
    { mealType: 'SUPPER', mealLabel: 'Ceia', buttonLabel: '👀 Cadê a ceia?', eligible: false, alreadySentByMe: false, reason: 'ALREADY_REGISTERED' },
  ],
}

describe('MealNudgeButton', () => {
  afterEach(() => {
    cleanup()
    mocks.api.mockReset()
  })

  it('sends the selected official meal and confirms only after the API succeeds', async () => {
    mocks.api.mockResolvedValue({ id: 'nudge-1' })
    const onSent = vi.fn()
    render(<ToastProvider><MealNudgeButton
      dietId="diet-1"
      recipientId="friend-1"
      recipientName="Rafael"
      token="token"
      eligibility={eligibility}
      onSent={onSent}
    /></ToastProvider>)

    fireEvent.click(screen.getByRole('button', { name: '👀 Cutucar' }))
    fireEvent.click(screen.getByRole('button', { name: '👀 Cadê o almoço?' }))

    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/diets/diet-1/meal-nudges', expect.objectContaining({
      method: 'POST',
      token: 'token',
      body: JSON.stringify({ recipientId: 'friend-1', mealType: 'LUNCH' }),
    })))
    expect(onSent).toHaveBeenCalledWith('LUNCH')
    expect((await screen.findByRole('status')).textContent).toContain('Cutucada enviada ✓')
  })

  it('keeps the meal eligible and offers a retry when the server rejects a send', async () => {
    mocks.api.mockRejectedValue(new Error('A refeição já foi registrada.'))
    const onSent = vi.fn()
    render(<ToastProvider><MealNudgeButton
      dietId="diet-1"
      recipientId="friend-1"
      recipientName="Rafael"
      token="token"
      eligibility={eligibility}
      onSent={onSent}
    /></ToastProvider>)

    fireEvent.click(screen.getByRole('button', { name: '👀 Cutucar' }))
    fireEvent.click(screen.getByRole('button', { name: '👀 Cadê o almoço?' }))

    expect((await screen.findByRole('alert')).textContent).toContain('A refeição já foi registrada.')
    expect(onSent).not.toHaveBeenCalled()
  })
})
