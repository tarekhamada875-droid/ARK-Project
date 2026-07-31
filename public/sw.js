const CACHE_NAME = 'rq-cache-v7';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/egypt_crest.svg',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Pre-caching non-fatal warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strictly avoid caching any Firebase, Firestore, or database API calls.
  // This ensures all real-time credit, balance, and logging operations are 100% online and live.
  if (
    url.origin !== self.location.origin || 
    url.pathname.includes('/api') || 
    url.host.includes('firestore') || 
    url.host.includes('firebase') ||
    event.request.method !== 'GET'
  ) {
    return; // Let browser handle network requests completely un-cached
  }

  // Live-first with standard browser fallback
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
