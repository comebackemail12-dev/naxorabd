const CACHE_NAME = 'naxora-pwa-v5';
const PRECACHE_URLS = [
  '/',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/pwa-192x192.png',
  '/icons/pwa-512x512.png',
  '/icons/apple-touch-icon.png',
  '/src/assets/images/naxora_bd_logo_1795288025158.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/main-admin')) {
    return;
  }

  // Static images & icons: Cache-First with network update fallback
  if (url.pathname.startsWith('/src/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        }).catch(() => cached || Response.error());
      })
    );
    return;
  }

  // Storefront shell & code assets: Network-First for live updates, Cache fallback offline
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || (request.mode === 'navigate' ? caches.match('/') : Response.error())))
  );
});
