// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setReducedMotionPreference } from '../test/matchMedia'
import { FeatureHint } from './FeatureHint'

describe('FeatureHint', () => {
  beforeEach(() => {
    setReducedMotionPreference(false)
    vi.stubEnv('VITE_FEATURE_DISCOVERY_ENABLED', 'true')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('exposes named actions and dismisses without using urgent alert semantics', () => {
    const onAction = vi.fn()
    const onDismiss = vi.fn()

    render(
      <FeatureHint
        title="Conheça a hidratação"
        description="Acompanhe seus registros de água."
        actionLabel="Ver hidratação"
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByRole('article', { name: 'Conheça a hidratação' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver hidratação' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }))

    expect(onAction).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('hides optional suggestions when the feature flag is disabled', () => {
    vi.stubEnv('VITE_FEATURE_DISCOVERY_ENABLED', 'false')
    const { container } = render(
      <FeatureHint
        title="Conheça a hidratação"
        description="Acompanhe seus registros de água."
        actionLabel="Ver hidratação"
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('reports visibility once only after the hint enters the viewport', () => {
    let observerCallback: IntersectionObserverCallback | null = null
    class TestIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) { observerCallback = callback }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() { return [] }
    }
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
    const onVisible = vi.fn()

    render(
      <FeatureHint
        title="Conheça a hidratação"
        description="Acompanhe seus registros de água."
        actionLabel="Ver hidratação"
        onAction={vi.fn()}
        onDismiss={vi.fn()}
        onVisible={onVisible}
      />,
    )

    const observer = observerCallback as unknown as IntersectionObserverCallback
    const target = screen.getByRole('article', { name: 'Conheça a hidratação' })
    const entry = (isIntersecting: boolean) => ({
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      target,
    }) as unknown as IntersectionObserverEntry
    observer([entry(false)], {} as IntersectionObserver)
    expect(onVisible).not.toHaveBeenCalled()
    observer([entry(true)], {} as IntersectionObserver)
    observer([entry(true)], {} as IntersectionObserver)
    expect(onVisible).toHaveBeenCalledOnce()
  })
})
