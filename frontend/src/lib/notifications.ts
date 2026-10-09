import type { NotificationFeedItem } from '../types'

const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: 'café da manhã',
  MORNING_SNACK: 'lanche da manhã',
  LUNCH: 'almoço',
  AFTERNOON_SNACK: 'lanche da tarde',
  DINNER: 'jantar',
  SUPPER: 'ceia',
}

export function labelMealType(mealType: string) {
  return MEAL_TYPE_LABELS[mealType] ?? mealType.toLocaleLowerCase('pt-BR')
}

export function notificationMessage(notification: NotificationFeedItem) {
  if (notification.type === 'MEAL_NUDGED') {
    const article = notification.mealType === 'SUPPER' ? 'a' : 'o'
    return `${notification.actorName} te cutucou sobre ${article} ${labelMealType(notification.mealType)}: “${notification.message ?? 'Cadê o registro?'}”`
  }
  return `${notification.actorName} comentou no seu registro de ${labelMealType(notification.mealType)}`
}

export function notificationAction(notification: NotificationFeedItem) {
  return notification.type === 'MEAL_NUDGED' ? 'Registrar refeição' : 'Ver registro'
}

export function notificationDeepLink(notification: NotificationFeedItem) {
  if (notification.type === 'MEAL_NUDGED') {
    const params = new URLSearchParams({
      mealType: notification.mealType,
      mealDate: notification.mealDate.slice(0, 10),
    })
    return `/refeicoes/nova?${params.toString()}`
  }
  if (!notification.mealId || !notification.commentId) return '/historico'
  const params = new URLSearchParams({
    dietId: notification.dietId,
    date: notification.mealDate.slice(0, 10),
    mealId: notification.mealId,
    commentId: notification.commentId,
  })
  return `/historico?${params.toString()}`
}

export function unreadNotifications(notifications: NotificationFeedItem[]) {
  return notifications.filter((notification) => !notification.readAt).length
}
