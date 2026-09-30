import { describe, expect, it } from 'vitest'
import { createUxEventId } from './uxTelemetry'

describe('createUxEventId', () => {
  it('keeps the event category in the id', () => {
    expect(createUxEventId('water_logged')).toMatch(/^water_logged:/)
  })
})
