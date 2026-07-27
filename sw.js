// PrecioCrea Service Worker
// Bump VERSION cuando publiques una nueva versión: invalida el caché anterior
// y notifica al cliente para mostrar el banner "nueva versión disponible".
const VERSION = '1.6.0';
const CACHE = `preciocrea-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/studio.js',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-192-maskable.png',
  './assets/icons/icon-512-maskable.png',
  // Las tipografías se precachean como todo lo demás: son parte de la
  // identidad de la app, no un adorno que pueda faltar sin conexión.
  './assets/fonts/nunito-var.woff2',
  './assets/fonts/fraunces-var.woff2',
  './assets/fonts/fraunces-var-italic.woff2'
];

// El núcleo (lo que hace que la app arranque) se precachea con addAll, que
// falla entero si falta una pieza: si eso no está, no hay app offline y quiero
// enterarme. El resto —iconos, tipografías— va tolerante: un 404 en un icono
// no puede ser la razón de que una creadora se quede sin su calculadora.
const NUCLEO = ASSETS.slice(0, 6);
const EXTRAS = ASSETS.slice(6);

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(async c => {
        await c.addAll(NUCLEO);
        await Promise.allSettled(EXTRAS.map(a => c.add(a)));
      })
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

// Estrategia, en dos carriles y solo para GET del mismo origen:
//
//   Navegaciones (abrir la app) → RED PRIMERO, caché como red de seguridad.
//     Con cache-first, quien ya hubiera abierto la app seguiría viendo la
//     versión vieja hasta que el service worker se reemplazara solo. Publicada
//     una corrección, esa espera es inaceptable: la creadora debe recibir el
//     arreglo la próxima vez que abra, no cuando el navegador lo decida.
//
//   Todo lo demás (css, js, fuentes, iconos) → CACHÉ PRIMERO.
//     Van versionados por el nombre del caché, así que un bump de VERSION ya
//     los invalida a todos. Aquí la caché es correcta y además instantánea.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const guardar = resp => {
    if (resp && resp.ok) {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
    }
    return resp;
  };

  // Última línea de defensa: sin red NI caché, una página honesta en vez del
  // error del navegador. caches.match puede resolver a undefined (instalación
  // a medias, caché desalojada por el sistema operativo), y respondWith con
  // undefined es un fallo de red, no una respuesta.
  const ultimoRecurso = async () => (
    await caches.match('./index.html') ||
    await caches.match('./') ||
    new Response(
      '<!doctype html><html lang="es"><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>PrecioCrea</title>' +
      '<body style="font-family:system-ui;text-align:center;padding:3rem 1.5rem;color:#4A3F55">' +
      '<p style="font-size:3rem;margin:0">🌱</p>' +
      '<h1 style="font-size:1.25rem">Sin conexión</h1>' +
      '<p>Vuelve a abrir PrecioCrea cuando tengas internet.<br>Tus productos siguen guardados.</p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
    )
  );

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(guardar).catch(ultimoRecurso));
    return;
  }

  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(guardar).catch(ultimoRecurso)
    )
  );
});

// Permite que el cliente fuerce la activación del SW nuevo (skipWaiting on demand)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
