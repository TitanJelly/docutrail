const CACHE = 'docutrail-v1'

const PRECACHE = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/ccs-header.png',
  '/ccs-footer.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first for navigation, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/dashboard') ?? fetch(request))
    )
    return
  }

  // Cache-first for static assets
  if (url.pathname.match(/\.(png|jpg|svg|ico|webp|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request))
    )
  }
})
