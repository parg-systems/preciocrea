// PrecioCrea Service Worker
// Bump VERSION cuando publiques una nueva versión: invalida el caché anterior
// y notifica al cliente para mostrar el banner "nueva versión disponible".
const VERSION = '1.5.0';
const CACHE = `preciocrea-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/studio.js',
  './manifest.webmanifest',
  './assets/icons/icon-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('preciocrea-') && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Estrategia: cache-first para nuestros assets, network-first como respaldo.
// Solo cacheamos GET del mismo origen.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// Permite que el cliente fuerce la activación del SW nuevo (skipWaiting on demand)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
