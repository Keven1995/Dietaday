import { describe, expect, it } from 'vitest'
import { toPushSubscriptionPayload } from './pushNotifications'

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
