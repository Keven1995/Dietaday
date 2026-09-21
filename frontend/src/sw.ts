/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>
}

precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()
self.skipWaiting()

self.addEventListener('push', (event) => {
  const data = readPushData(event.data)
  event.waitUntil(self.registration.showNotification(data?.title ?? 'Dietaday', {
    body: data?.body ?? 'Hora de beber água 💧',
    icon: '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    tag: data?.tag ?? 'dietaday-notification',
    data: { url: data?.url ?? '/' },
  }))
})

function readPushData(data: PushMessageData | null) {
  if (!data) return undefined
  try {
    return data.json() as { title?: string; body?: string; url?: string; tag?: string }
  } catch {
    return { body: data.text() }
  }
}

self.addEventListener('notificationclick', (event) => {
  const targetUrl = new URL((event.notification.data as { url?: string } | undefined)?.url ?? '/', self.location.origin).href
  event.notification.close()
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => 'focus' in client)
    if (existing) return (existing as WindowClient).focus()
    return self.clients.openWindow(targetUrl)
  }))
})
