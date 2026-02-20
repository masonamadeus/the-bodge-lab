const CACHE_NAME = 'podcube-explorer-v1';

// Detect if we are running locally
const isLocalhost = Boolean(
  self.location.hostname === 'localhost' ||
  self.location.hostname === '[::1]' ||
  self.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

self.addEventListener('install', (event) => {
    // Skip installation caching if local, otherwise cache core files
    if (!isLocalhost) {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.addAll([
                    './',
                    './index.html',
                    './explorer.css',
                    './explorer.js',
                    './PODCUBE.png'
                ]);
            })
        );
    }
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    // Development Mode: Bypass cache completely
    if (isLocalhost) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Production Mode: Cache-first, fallback to network
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).then((response) => {
                // Optionally cache new successful requests here
                return response;
            });
        })
    );
});

// Clean up old caches on activation
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
        })
    );
    self.clients.claim();
});