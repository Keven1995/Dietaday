import { api } from './api'
import { createUuid } from './uuid'

export type UxEventName =
  | 'meal_created'
  | 'water_logged'
  | 'daily_goal_completed'
  | 'hydration_goal_completed'
  | 'reaction_created'
  | 'ranking_position_changed'
  | 'streak_incremented'
  | 'feature_hint_viewed'
  | 'feature_hint_clicked'
  | 'feature_hint_dismissed'
  | 'feature_adopted'
  | 'meal_form_started'
  | 'meal_saved_locally'

export type UxEventDetails = Record<string, string | number | boolean | null>

export type UxEvent = {
  eventName: UxEventName
  eventId?: string
  dietId?: string | null
  details?: UxEventDetails
}

export function createUxEventId(prefix: string) {
  return `${prefix}:${createUuid()}`
}

export async function reportUxEvent(token: string | null, event: UxEvent) {
  if (!token) return
  try {
    await api<void>('/telemetry/ux', {
      method: 'POST',
      token,
      body: JSON.stringify({ ...event, eventId: event.eventId ?? createUxEventId(event.eventName) }),
    })
  } catch {
    // UX telemetry must never block or change the user action.
  }
}
