import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { createUxEventId, reportUxEvent } from './uxTelemetry'

vi.mock('./api', () => ({ api: vi.fn() }))

afterEach(() => vi.clearAllMocks())

describe('createUxEventId', () => {
  it('keeps the event category in the id', () => {
    expect(createUxEventId('water_logged')).toMatch(/^water_logged:/)
  })
})

describe('reportUxEvent', () => {
  it('sends authenticated discovery events without inventing a diet id', async () => {
    const event = {
      eventName: 'feature_hint_viewed' as const,
      eventId: 'hint:1',
      dietId: null,
      details: { campaign: 'discover_hydration', version: 1, page: '/', exposureId: '00000000-0000-0000-0000-000000000001' },
    }

    await reportUxEvent('access-token', event)

    expect(api).toHaveBeenCalledWith('/telemetry/ux', expect.objectContaining({
      method: 'POST',
      token: 'access-token',
      body: JSON.stringify(event),
    }))
  })

  it('does not send events before authentication is available', async () => {
    await reportUxEvent(null, {
      eventName: 'feature_hint_viewed',
      eventId: 'hint:anonymous',
      dietId: null,
      details: { campaign: 'discover_hydration', version: 1, page: '/', exposureId: '00000000-0000-0000-0000-000000000002' },
    })

    expect(api).not.toHaveBeenCalled()
  })

  it('pairs form-entry and locally-saved events with one ephemeral session id', async () => {
    const formSessionId = '00000000-0000-0000-0000-000000000003'
    await reportUxEvent('access-token', {
      eventName: 'meal_form_started',
      eventId: `meal_form_started:${formSessionId}`,
      dietId: null,
      details: { formSessionId },
    })
    await reportUxEvent('access-token', {
      eventName: 'meal_saved_locally',
      eventId: `meal_saved_locally:${formSessionId}`,
      dietId: null,
      details: { formSessionId },
    })

    expect(api).toHaveBeenNthCalledWith(1, '/telemetry/ux', expect.objectContaining({
      body: expect.stringContaining('meal_form_started'),
    }))
    expect(api).toHaveBeenNthCalledWith(2, '/telemetry/ux', expect.objectContaining({
      body: expect.stringContaining('meal_saved_locally'),
    }))
    const calls = vi.mocked(api).mock.calls
    expect(JSON.parse(String(calls[0]?.[1]?.body)).details.formSessionId).toBe(formSessionId)
    expect(JSON.parse(String(calls[1]?.[1]?.body)).details.formSessionId).toBe(formSessionId)
  })
})
