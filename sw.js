const CACHE_NAME = 'k3k3-v6';
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
  '/passenger/login.css',
  '/passenger/toast.css'
];

// Install event - cache all assets
self.addEventListener('install', e => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching assets');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Installation failed:', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', e => {
  console.log('[SW] Activating service worker...');
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', e => {
  // Skip API requests and backend calls - let them go directly to the network
  if (e.request.url.includes('/api/') || e.request.url.includes(':8810')) {
    return;
  }

  e.respondWith(
    caches.match(e.request)
      .then(response => {
        // Return cached version if found
        if (response) {
          return response;
        }
        
        // Fetch from network
        return fetch(e.request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Cache the response for future use
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(e.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Network failed, try to serve from cache
            return caches.match(e.request);
          });
      })
  );
});

// Handle messages from main thread
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
