const CACHE_NAME = 'k3k3-v10';
const ASSETS = [
  '/',
  '/index.html',
  '/about.css',
  '/about.js',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/k3k3.png',
  '/css/responsive.css',
  '/passenger/login.html',
  '/passenger/login.css'
];

// Install event - cache core local assets safely & take over immediately
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        await Promise.allSettled(
          ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`[SW] Could not pre-cache ${url}:`, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.error('[SW] Installation error:', err);
      })
  );
});

// Activate event - purge all outdated caches and claim clients immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch event - handle local assets, NEVER intercept external CDNs or APIs
self.addEventListener('fetch', e => {
  // 1. Only intercept GET requests
  if (e.request.method !== 'GET') {
    return;
  }

  // 2. Ignore non-HTTP/HTTPS schemes (e.g. chrome-extension:, data:, blob:)
  if (!e.request.url.startsWith('http://') && !e.request.url.startsWith('https://')) {
    return;
  }

  const url = new URL(e.request.url);

  // 3. DO NOT intercept external/cross-origin CDNs (fonts, leaflet, unpkg, mapbox, cdnjs, etc.)
  // Let the browser handle external CDN resources directly with native caching and SRI integrity.
  if (url.origin !== self.location.origin) {
    return;
  }

  // 4. Skip backend APIs, WebSockets, Supabase, Moolre, and backend ports
  if (
    url.pathname.includes('/api/') ||
    url.pathname.includes('/socket.io/') ||
    url.pathname.includes('/trips') ||
    url.pathname.includes('/applications') ||
    url.pathname.includes('/riders') ||
    url.pathname.includes('/passengers') ||
    url.pathname.includes('/users') ||
    url.pathname.includes('/auth') ||
    url.port === '8810' ||
    url.port === '8811' ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('moolre.com')
  ) {
    return;
  }

  // 5. Safe cache/network strategy for same-origin static assets:
  // ALWAYS returns a valid Response object; NEVER resolves to undefined or unhandled rejection.
  e.respondWith(
    (async () => {
      // Check cache first
      try {
        const cached = await caches.match(e.request);
        if (cached) {
          // Background revalidation for local assets
          fetch(e.request)
            .then(netRes => {
              if (netRes && netRes.status === 200) {
                caches.open(CACHE_NAME).then(c => c.put(e.request, netRes).catch(() => {}));
              }
            })
            .catch(() => {});
          return cached;
        }
      } catch (_) {}

      // If not in cache, fetch from network
      try {
        const networkResponse = await fetch(e.request);
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone).catch(() => {}));
        }
        return networkResponse;
      } catch (networkError) {
        // Fallback: check cache again
        try {
          const fallbackCached = await caches.match(e.request);
          if (fallbackCached) {
            return fallbackCached;
          }
        } catch (_) {}

        // For HTML navigation requests, fallback to cached index.html
        if (e.request.mode === 'navigate') {
          try {
            const indexFallback = await caches.match('/index.html');
            if (indexFallback) return indexFallback;
          } catch (_) {}
        }

        // Return a valid Response object so browser never throws
        // "TypeError: Failed to convert value to 'Response'"
        return new Response('Network unavailable (offline)', {
          status: 504,
          statusText: 'Gateway Timeout',
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});

// Handle messages from main thread
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
