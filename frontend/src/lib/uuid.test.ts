import { describe, expect, it } from 'vitest'
import { createUuid } from './uuid'

describe('createUuid', () => {
  it('creates UUID v4 values', () => {
    expect(createUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
