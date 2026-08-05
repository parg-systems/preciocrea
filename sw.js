// PrecioCrea Service Worker
//
// VERSION es la versión que se muestra a la creadora. BUILD es el número de
// entrega: sube en CADA cambio de un archivo de ASSETS, aunque la versión no se
// mueva.
//
// Los dos existen porque son cosas distintas y confundirlas cuesta caro. El
// nombre del caché es la llave: si no cambia, el service worker sigue sirviendo
// los archivos viejos para siempre, y como sw.js queda byte a byte idéntico el
// navegador ni siquiera detecta que hay algo nuevo — no aparece el banner de
// actualización y no hay forma de salir de ahí desde el teléfono. Pasó al
// añadir el asistente de valor hora dentro de la misma versión 2.0.0: el código
// estaba publicado y nadie lo veía.
//
// Regla: si cambia CUALQUIER archivo de la lista ASSETS de abajo, sube BUILD.
// Siempre. Ojo con manifest.webmanifest, que está en esa lista y es fácil de
// olvidar porque no es "HTML/CSS/JS": se sirve cache-first como todo lo demás,
// así que corregirlo sin subir BUILD deja sw.js byte a byte idéntico y el
// cambio no llega nunca — ni hay forma de arreglarlo desde el teléfono.
const VERSION = '2.3.1';
const BUILD   = 12;
const CACHE = `preciocrea-${VERSION}-b${BUILD}`;
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/studio.js',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-180.png',
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

// Sin skipWaiting() aquí: el SW nuevo queda en `waiting` hasta que la creadora
// pulse "Recargar" en el banner (mensaje SKIP_WAITING, abajo). Activarse solo
// durante el install disparaba clients.claim → controllerchange → recarga
// automática de la página encima de quien estaba a mitad de un cálculo, y de
// paso el banner nunca llegaba a verse: reg.waiting era siempre null.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(async c => {
        await c.addAll(NUCLEO);
        await Promise.allSettled(EXTRAS.map(a => c.add(a)));
      })
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
//     Van versionados por el nombre del caché, así que subir BUILD los invalida
//     a todos de golpe. Aquí la caché es correcta y además instantánea — pero
//     por eso mismo, olvidar el bump deja a todo el mundo en la versión vieja.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const guardar = resp => {
    if (resp && resp.ok) {
      const copy = resp.clone();
      // waitUntil: sin él, el navegador puede dormir el SW antes de que el
      // put() termine y el recurso se cachea "a veces".
      e.waitUntil(caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}));
    }
    return resp;
  };

  // Siempre contra la caché propia. caches.match() global recorre TODAS las
  // cachés del origen empezando por la más antigua: si un delete falló o el
  // dominio aloja otra cosa, ganaría una copia vieja y el bump de BUILD no
  // serviría de nada.
  const enCache = r => caches.open(CACHE).then(c => c.match(r));

  // Última línea de defensa para NAVEGACIONES: sin red NI caché, una página
  // honesta en vez del error del navegador. Solo para documentos — devolverle
  // este HTML a un .js o .css fallido es un error de sintaxis y pantalla en
  // blanco, peor que el fallo de red que reemplaza.
  const ultimoRecurso = async () => (
    await enCache('./index.html') ||
    await enCache('./') ||
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
    // Red primero, pero sin fe ciega: una respuesta rota del hosting (404/500
    // de un deploy a medias) o una conexión que responde y no avanza no deben
    // taparle la app a quien la tiene entera en caché.
    const red = fetch(req).then(resp => {
      if (!resp || !resp.ok) throw new Error('respuesta no válida');
      return guardar(resp);
    });
    const tope = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 4000)
    );
    e.respondWith(Promise.race([red, tope]).catch(ultimoRecurso));
    return;
  }

  e.respondWith(
    enCache(req).then(cached =>
      cached || fetch(req).then(guardar).catch(() => Response.error())
    )
  );
});

// Permite que el cliente fuerce la activación del SW nuevo (skipWaiting on demand)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
