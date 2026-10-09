import { describe, expect, it } from 'vitest'
import type { NotificationFeedItem } from '../types'
import { labelMealType, notificationAction, notificationDeepLink, notificationMessage, unreadNotifications } from './notifications'

const notification: NotificationFeedItem = { id: 'n1', type: 'MEAL_COMMENTED', dietId: 'd1', mealId: 'm1', mealDate: '2026-09-13', commentId: 'c1', actorId: 'u2', actorName: 'Rafael', mealType: 'LUNCH', createdAt: '2026-09-13T12:00:00Z', readAt: null }
const nudge: NotificationFeedItem = { ...notification, id: 'n2', type: 'MEAL_NUDGED', mealId: null, commentId: null, message: 'Tá comendo escondido aí? 😂' }

describe('notification helpers', () => {
  it('formats meal labels and messages', () => {
    expect(labelMealType('LUNCH')).toBe('almoço')
    expect(notificationMessage(notification)).toBe('Rafael comentou no seu registro de almoço')
  })

  it('builds the history deep-link and counts unread items', () => {
    expect(notificationDeepLink(notification)).toBe('/historico?dietId=d1&date=2026-09-13&mealId=m1&commentId=c1')
    expect(unreadNotifications([notification, { ...notification, id: 'n2', readAt: '2026-09-13T12:05:00Z' }])).toBe(1)
  })

  it('shows the fixed nudge text and opens the meal form with the requested type and date', () => {
    expect(notificationMessage(nudge)).toBe('Rafael te cutucou sobre o almoço: “Tá comendo escondido aí? 😂”')
    expect(notificationAction(nudge)).toBe('Registrar refeição')
    expect(notificationDeepLink(nudge)).toBe('/refeicoes/nova?mealType=LUNCH&mealDate=2026-09-13')
  })
})
