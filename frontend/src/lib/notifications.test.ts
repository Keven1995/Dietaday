import { describe, expect, it } from 'vitest'
import type { CommentNotification } from '../types'
import { labelMealType, notificationDeepLink, notificationMessage, unreadNotifications } from './notifications'

const notification: CommentNotification = { id: 'n1', type: 'COMMENT', dietId: 'd1', mealId: 'm1', mealDate: '2026-09-13', commentId: 'c1', actorId: 'u2', actorName: 'Rafael', mealType: 'LUNCH', createdAt: '2026-09-13T12:00:00Z', readAt: null }

describe('notification helpers', () => {
  it('formats meal labels and messages', () => {
    expect(labelMealType('LUNCH')).toBe('almoço')
    expect(notificationMessage(notification)).toBe('Rafael comentou no seu registro de almoço')
  })

  it('builds the history deep-link and counts unread items', () => {
    expect(notificationDeepLink(notification)).toBe('/historico?dietId=d1&date=2026-09-13&mealId=m1&commentId=c1')
    expect(unreadNotifications([notification, { ...notification, id: 'n2', readAt: '2026-09-13T12:05:00Z' }])).toBe(1)
  })
})
