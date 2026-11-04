const VERSION = 'v1.2.0-r116'
const CACHE_PREFIX = 'scoutsvm-'
const CORE_CACHE = `${CACHE_PREFIX}core-${VERSION}`
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${VERSION}`
const OFFLINE_URL = '/offline.html'

const CORE_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if ('navigationPreload' in self.registration) {
        try {
          await self.registration.navigationPreload.enable()
        } catch {}
      }

      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CORE_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  try {
    const response = await fetch(request)
    if (response && response.status === 200 && response.type === 'basic') {
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    throw new Error('network-and-cache-miss')
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await caches.match(request)
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        await cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  if (cached) {
    event.waitUntil(networkPromise)
    return cached
  }

  const response = await networkPromise
  return response || new Response('', { status: 504 })
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response && response.status === 200 && response.type === 'basic') {
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('', { status: 504 })
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse
          if (preload) return preload
          return await fetch(request)
        } catch {
          const core = await caches.open(CORE_CACHE)
          return (await core.match(OFFLINE_URL)) || new Response('Offline', { status: 503 })
        }
      })()
    )
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Vite emits fingerprinted build assets. Cache-first is safe because their URL changes per build.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Public images/fonts keep stable URLs, so refresh them in the background instead of pinning forever.
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(staleWhileRevalidate(request, event))
    return
  }

  // Other same-origin resources prefer the network so releases are picked up promptly.
  event.respondWith(networkFirst(request))
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Scout Manager', body: event.data && event.data.text ? event.data.text() : '' }
  }

  const title = data.title || 'Scout Manager'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: {
      url: data.url || data?.data?.url || '/app/notifications',
      ...data?.data,
    },
    vibrate: [100, 50, 100],
    actions: Array.isArray(data.actions) ? data.actions : [],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlToOpen = event.notification?.data?.url || '/app/notifications'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const matchingClient = allClients.find((client) => 'focus' in client)

      if (matchingClient) {
        await matchingClient.focus()
        if ('navigate' in matchingClient) await matchingClient.navigate(urlToOpen)
        return
      }

      if (self.clients.openWindow) await self.clients.openWindow(urlToOpen)
    })()
  )
})
