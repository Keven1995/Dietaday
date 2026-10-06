import { api, isDemoMode } from './api'

export type PushSubscriptionPayload = {
  endpoint: string
  p256dh: string
  auth: string
}

export type PushStatus = 'unsupported' | 'install-required' | 'blocked' | 'disabled' | 'enabled'

function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function isPushSupported() {
  return !isDemoMode && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function needsPwaInstall() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !isStandalonePwa()
}

export function resolvePushStatus({
  supported,
  installRequired,
  permission,
  hasSubscription,
}: {
  supported: boolean
  installRequired: boolean
  permission: NotificationPermission
  hasSubscription: boolean
}): PushStatus {
  if (!supported) return 'unsupported'
  if (installRequired) return 'install-required'
  if (permission === 'denied') return 'blocked'
  return hasSubscription ? 'enabled' : 'disabled'
}

export async function currentPushStatus(): Promise<PushStatus> {
  const supported = isPushSupported()
  if (!supported) return resolvePushStatus({ supported, installRequired: false, permission: 'default', hasSubscription: false })
  const installRequired = needsPwaInstall()
  if (installRequired) return resolvePushStatus({ supported, installRequired, permission: Notification.permission, hasSubscription: false })
  if (Notification.permission === 'denied') return 'blocked'
  const registration = await navigator.serviceWorker.ready
  const hasSubscription = Boolean(await registration.pushManager.getSubscription())
  return resolvePushStatus({ supported, installRequired, permission: Notification.permission, hasSubscription })
}

export async function enablePushNotifications(token: string) {
  if (!isPushSupported()) throw new Error('Este dispositivo não oferece notificações push.')
  if (needsPwaInstall()) throw new Error('No iPhone, instale o Dietaday na tela inicial antes de ativar os lembretes.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permita as notificações do Dietaday para ativar os lembretes.')

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    const { publicKey } = await api<{ publicKey: string }>('/push/public-key', { token })
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(publicKey),
    })
  }
  const payload = toPushSubscriptionPayload(subscription)
  await api<void>('/push/subscriptions', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function disablePushNotifications(token: string) {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  await api<void>(`/push/subscriptions?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
    method: 'DELETE',
    token,
  })
  await subscription.unsubscribe()
}

export function toPushSubscriptionPayload(subscription: PushSubscription): PushSubscriptionPayload {
  const payload = subscription.toJSON()
  const p256dh = payload.keys?.p256dh
  const auth = payload.keys?.auth
  if (!payload.endpoint || !p256dh || !auth) throw new Error('Não foi possível preparar as notificações neste dispositivo.')
  return { endpoint: payload.endpoint, p256dh, auth }
}

function decodeVapidKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}
