const CACHE_NAME = 'qv-v1'
const SHELL_ASSETS = ['/', '/index.html']
const STATIC_EXTS  = /\.(js|css|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|ico|webp)(\?.*)?$/i

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch: cache-first for static, network-first for /api/ ───────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request))
    return
  }

  // Cache-first for static assets
  if (STATIC_EXTS.test(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request))
    return
  }

  // Navigation requests — serve shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html')
      )
    )
    return
  }
})

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Network error', { status: 503 })
  }
}

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// ── Background sync: check-in-sync ───────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'check-in-sync') {
    event.waitUntil(syncPendingCheckIns())
  }
})

async function syncPendingCheckIns() {
  // Retrieve queued check-in requests from IndexedDB / cache and replay them
  const cache  = await caches.open(CACHE_NAME)
  const keys   = await cache.keys()
  const pending = keys.filter(req => req.url.includes('/api/checkin'))
  await Promise.all(
    pending.map(req =>
      fetch(req).then(() => cache.delete(req)).catch(() => {})
    )
  )
}

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {}
  const title   = data.title   || 'Quantum Vortex Hotel'
  const body    = data.body    || 'You have a new notification'
  const icon    = data.icon    || '/icon-192.png'
  const badge   = data.badge   || '/icon-192.png'
  const tag     = data.tag     || 'qv-notification'
  const actions = data.actions || [
    { action: 'view',    title: 'View Details' },
    { action: 'dismiss', title: 'Dismiss'      },
  ]

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      actions,
      data: data.url || '/',
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const targetUrl = event.notification.data || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const existing = windowClients.find(c => c.url === targetUrl && 'focus' in c)
      if (existing) return existing.focus()
      return clients.openWindow(targetUrl)
    })
  )
})
