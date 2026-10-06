// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeatureDiscovery } from './useFeatureDiscovery'
import type { FeatureDiscoveryContext, FeatureDiscoveryResource } from '../lib/featureDiscovery'
import { reportFeatureHintTelemetry } from '../lib/featureDiscoveryTelemetry'
import { readFeatureCampaignPreference, type FeatureDiscoveryStorage } from '../lib/featureDiscoveryStorage'
import { setReducedMotionPreference } from '../test/matchMedia'

vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({ token: 'test-access-token' }),
}))
vi.mock('../lib/featureDiscoveryTelemetry', () => ({
  reportFeatureHintTelemetry: vi.fn(),
  completeFeatureCampaign: vi.fn(),
}))

class TestStorage implements FeatureDiscoveryStorage {
  private readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

function ready<T>(data: T): FeatureDiscoveryResource<T> {
  return { status: 'ready', data }
}

function context(): FeatureDiscoveryContext {
  return {
    diet: ready({ competitiveMode: false }),
    ownMealHistory: ready(true),
    members: ready({ count: 1, canInvite: true }),
    hydrationDiscovery: ready('unknown'),
    waterCheck: ready(false),
    waterReminders: ready({ supported: true, enabled: false, blocked: false }),
    socialInteraction: ready({ hasSyncedMealFromOtherMember: false, hasInteracted: false }),
    completedCampaigns: ready({}),
  }
}

const conditions = {
  authenticated: true,
  dataStatus: 'ready' as const,
  formStatus: 'idle' as const,
  modalOpen: false,
  celebrationActive: false,
  seasonalMessageActive: false,
  operationalError: false,
}

describe('useFeatureDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_FEATURE_DISCOVERY_ENABLED', 'true')
    setReducedMotionPreference(false)
  })

  afterEach(() => vi.unstubAllEnvs())

  it('claims the session on visibility, records dismissal, then suppresses further suggestions', () => {
    const preferenceStorage = new TestStorage()
    const sessionStorage = new TestStorage()
    const options = {
      userId: 'user-hook-test',
      context: context(),
      conditions,
      dietIdsByCampaign: { share_diet: 'diet-hook-test' },
      preferenceStorage,
      sessionStorage,
      now: 10_000,
    }
    const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
    const { result, rerender } = renderHook((props) => useFeatureDiscovery(props), { initialProps: options, wrapper })

    expect(result.current.campaign?.id).toBe('share_diet')
    act(() => result.current.onVisible())
    act(() => result.current.onVisible())
    rerender(options)
    expect(result.current.campaign?.id).toBe('share_diet')
    expect(reportFeatureHintTelemetry).toHaveBeenCalledOnce()
    expect(reportFeatureHintTelemetry).toHaveBeenNthCalledWith(
      1,
      'test-access-token',
      'feature_hint_viewed',
      'share_diet',
      1,
      '/',
      expect.any(String),
      'diet-hook-test',
    )

    act(() => result.current.onDismissed())
    rerender(options)
    expect(result.current.campaign).toBeNull()
    expect(reportFeatureHintTelemetry).toHaveBeenNthCalledWith(
      2,
      'test-access-token',
      'feature_hint_dismissed',
      'share_diet',
      1,
      '/',
      expect.any(String),
      'diet-hook-test',
    )
    expect(vi.mocked(reportFeatureHintTelemetry).mock.calls[1][5])
      .toBe(vi.mocked(reportFeatureHintTelemetry).mock.calls[0][5])
    expect(readFeatureCampaignPreference('user-hook-test', 'share_diet', 1, 'diet-hook-test', preferenceStorage)?.dismissedAt)
      .toBe(new Date(10_000).toISOString())
  })

  it('records a CTA click separately from adoption with the same exposure id', () => {
    const preferenceStorage = new TestStorage()
    const sessionStorage = new TestStorage()
    const options = {
      userId: 'user-click-test',
      context: context(),
      conditions,
      dietIdsByCampaign: { share_diet: 'diet-click-test' },
      preferenceStorage,
      sessionStorage,
      now: 20_000,
    }
    const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
    const { result } = renderHook((props) => useFeatureDiscovery(props), { initialProps: options, wrapper })

    act(() => result.current.onVisible())
    act(() => result.current.onClicked())

    const events = vi.mocked(reportFeatureHintTelemetry).mock.calls
    expect(events.map((call) => call[1])).toEqual(['feature_hint_viewed', 'feature_hint_clicked'])
    expect(events[0][5]).toBe(events[1][5])
    const preference = readFeatureCampaignPreference('user-click-test', 'share_diet', 1, 'diet-click-test', preferenceStorage)
    expect(preference?.clickedAt).toBe(new Date(20_000).toISOString())
    expect(preference?.completedAt).toBeUndefined()
  })
})
