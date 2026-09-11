import { describe, expect, it } from 'vitest'
import { ApiError, getErrorMessage } from './api'

describe('getErrorMessage', () => {
  it('replaces technical fetch errors with a friendly message', () => {
    expect(getErrorMessage(new TypeError('Failed to fetch'), 'Fallback')).toBe(
      'Não foi possível conectar ao aplicativo. Verifique sua conexão e tente novamente.',
    )
  })

  it('keeps messages returned by the API', () => {
    expect(getErrorMessage(new ApiError('Validation failed', 400), 'Fallback')).toBe('Validation failed')
  })
})
