// public/js/service-worker.js

const CACHE_NAME = 'myapp-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/dashboard.html',
  '/faq.html',
  '/policy-details.html',
  '/register.html',
  '/css/style.css',
  '/js/main.js',
  // Add more assets as needed
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
