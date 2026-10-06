import { describe, expect, it } from 'vitest'
import { resolvePushStatus, toPushSubscriptionPayload } from './pushNotifications'

describe('resolvePushStatus', () => {
  it('distinguishes unsupported, install-required, blocked, disabled, and enabled states', () => {
    expect(resolvePushStatus({ supported: false, installRequired: false, permission: 'default', hasSubscription: false }))
      .toBe('unsupported')
    expect(resolvePushStatus({ supported: true, installRequired: true, permission: 'default', hasSubscription: false }))
      .toBe('install-required')
    expect(resolvePushStatus({ supported: true, installRequired: false, permission: 'denied', hasSubscription: false }))
      .toBe('blocked')
    expect(resolvePushStatus({ supported: true, installRequired: false, permission: 'default', hasSubscription: false }))
      .toBe('disabled')
    expect(resolvePushStatus({ supported: true, installRequired: false, permission: 'granted', hasSubscription: true }))
      .toBe('enabled')
  })
})

describe('toPushSubscriptionPayload', () => {
  it('flattens the browser subscription into the backend contract', () => {
    const subscription = {
      toJSON: () => ({
        endpoint: 'https://push.example.test/subscription',
        keys: { p256dh: 'public-key', auth: 'auth-key' },
      }),
    } as unknown as PushSubscription

    expect(toPushSubscriptionPayload(subscription)).toEqual({
      endpoint: 'https://push.example.test/subscription',
      p256dh: 'public-key',
      auth: 'auth-key',
    })
  })
})
