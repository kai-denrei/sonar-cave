// Sonar Cave — service worker.
// Cache-name keyed to the cache-busting token. gen-precache.js rewrites the
// placeholder below on each build using the token from dist/index.html.
// On activate, all caches whose name doesn't match the current token are deleted.

const CB_TOKEN = '__CB_TOKEN__';
const CACHE_NAME = `sonar-cave-${CB_TOKEN}`;

// PRECACHE_INJECT: filled in at build time by scripts/gen-precache.js.
// In dev (unbuilt), this falls back to the shell so the SW still installs.
const PRECACHE = self.__PRECACHE__ || [
  './',
  './index.html',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE).catch((err) => {
        console.warn('[sw] precache partial', err);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle same-origin
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Cache successful, basic responses for future offline use.
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
