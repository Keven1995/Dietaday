import type { CommentNotification } from '../types'

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

export function notificationMessage(notification: CommentNotification) {
  return `${notification.actorName} comentou no seu registro de ${labelMealType(notification.mealType)}`
}

export function notificationDeepLink(notification: CommentNotification) {
  const params = new URLSearchParams({
    dietId: notification.dietId,
    date: notification.mealDate.slice(0, 10),
    mealId: notification.mealId,
    commentId: notification.commentId,
  })
  return `/historico?${params.toString()}`
}

export function unreadNotifications(notifications: CommentNotification[]) {
  return notifications.filter((notification) => !notification.readAt).length
}
