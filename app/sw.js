// sw.js
const CACHE_NAME = 'arepas-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/menu.html',
  '/carrito.html',
  '/cuenta.html',
  '/admin.html',
  '/styles.css',
  '/main.js',
  '/transition.js',
  '/config.js',
  '/auth.js',
  '/database.js',
  '/cart.js',
  '/ai.js',
  '/utils.js',
  '/security.js',
  '/dynamicPricing.js',
  '/achievements.js',
  '/referrals.js',
  '/forecast.js',
  '/fraudDetector.js',
  '/inventory.js',
  '/abTesting.js',
  '/loyalty.js',
  '/coupons.js',
  '/notifications.js',
  '/sync.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  event.waitUntil(clients.claim());
});

// Push notifications
self.addEventListener('push', event => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-192.png'
    })
  );
});