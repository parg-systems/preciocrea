// Service worker, caché e instalación.
//
// Esta es la parte de la app donde un error no se puede arreglar después: si el
// service worker queda sirviendo archivos viejos, la corrección que se publique
// mañana no llega, y desde el teléfono de la creadora no hay forma de salir de
// ahí. Ya pasó una vez —un asistente entero entregado que nadie vio— y el
// remedio, subir BUILD, solo funciona si el mecanismo está intacto.
//
// Nada de esto se puede probar sin un navegador: los service workers ni
// siquiera se registran fuera de un origen seguro.

'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', '..');
const swFuente = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
const VERSION = swFuente.match(/const VERSION\s*=\s*'([^']+)'/)[1];
const BUILD = Number(swFuente.match(/const BUILD\s*=\s*(\d+)/)[1]);

// Espera a que el service worker tome el control de la página.
async function esperarSW(page) {
  await page.waitForFunction(
    () => navigator.serviceWorker && navigator.serviceWorker.controller !== null,
    null, { timeout: 15000 }
  );
}

// Deja el origen sin service workers ni cachés: sin esto un test hereda el
// estado del anterior, que es justo el problema que estos tests investigan.
async function limpiar(page) {
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    const claves = await caches.keys();
    await Promise.all(claves.map(k => caches.delete(k)));
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await limpiar(page);
  await page.reload();
});

test.afterEach(async ({ page }) => {
  await limpiar(page).catch(() => {});
});

test('el service worker se registra y toma el control', async ({ page }) => {
  await esperarSW(page);

  const alcance = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.scope;
  });
  // Registrado como './sw.js': el alcance es la raíz del sitio, no una subruta.
  expect(alcance).toBe('http://127.0.0.1:4173/');
});

test('el caché lleva la versión Y el build en su nombre', async ({ page }) => {
  // Es la pieza central de todo el mecanismo: si el nombre no cambia, el
  // navegador reutiliza los archivos viejos para siempre.
  await esperarSW(page);
  await page.waitForFunction(async () => (await caches.keys()).length > 0);

  const claves = await page.evaluate(() => caches.keys());
  expect(claves).toContain(`preciocrea-${VERSION}-b${BUILD}`);
});

test('el núcleo queda precacheado: la app abre sin conexión', async ({ page, context }) => {
  await esperarSW(page);
  await page.waitForFunction(async () => {
    const c = await caches.keys();
    if (!c.length) return false;
    const cache = await caches.open(c[0]);
    return (await cache.keys()).length >= 6;
  });

  await context.setOffline(true);
  await page.reload();

  // Sin conexión y la app entera en pie: encabezado, botón de calcular y estilos.
  await expect(page.locator('#view-home')).toBeVisible();
  await expect(page.locator('#view-home [data-action="startCalc"]').first()).toBeVisible();
  const fondo = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor);
  expect(fondo).not.toBe('rgba(0, 0, 0, 0)');

  await context.setOffline(false);
});

test('los productos guardados siguen ahí sin conexión', async ({ page, context }) => {
  await esperarSW(page);
  await page.evaluate(() => {
    localStorage.setItem('pc_v1', JSON.stringify([{
      id: 1, addedAt: 1, name: 'Jabón sin conexión', desc: '', emoji: '🧼',
      date: '31-07-2026', mat: 100, labor: 200, cr: 30, struct: 40,
      minP: 370, idealP: 500, margin: 50, crLvl: 'facil'
    }]));
    localStorage.setItem('pc_welcome_20', '1');
  });

  await context.setOffline(true);
  await page.reload();
  await page.locator('.tab-btn[data-view="view-products"]').first().click();

  await expect(page.locator('#products-list')).toContainText('Jabón sin conexión');
  await context.setOffline(false);
});

test('una corrección publicada llega en la siguiente apertura', async ({ page }) => {
  // El network-first para navegaciones, medido de verdad: se publica un
  // index.html distinto mientras el service worker ya tiene el viejo en caché.
  // Si sirviera cache-first, este cambio no se vería hasta vaciar el caché a
  // mano — que desde un teléfono no es una opción.
  await esperarSW(page);

  // context.route y no page.route: la petición la hace el service worker, y
  // las suyas no pasan por el enrutado de la página.
  await page.context().route('**/index.html', async ruta => {
    const respuesta = await ruta.fetch();
    const html = (await respuesta.text())
      .replace('</body>', '<div id="correccion-publicada"></div></body>');
    await ruta.fulfill({ response: respuesta, body: html });
  });

  await page.reload();

  await expect(page.locator('#view-home')).toBeVisible();
  await expect(page.locator('#correccion-publicada')).toHaveCount(1);
});

test('sin conexión, esa misma navegación cae al caché en vez de fallar', async ({ page, context }) => {
  // La otra mitad del network-first: primero la red, pero si no hay red, el
  // caché. Sin esta rama la app no abriría en el metro.
  await esperarSW(page);
  await page.waitForFunction(async () => (await caches.keys()).length > 0);

  await context.setOffline(true);
  const respuesta = await page.reload();

  await expect(page.locator('#view-home')).toBeVisible();
  expect(respuesta.status()).toBe(200);
  await context.setOffline(false);
});

test('el resto de los recursos se sirve del caché', async ({ page }) => {
  await esperarSW(page);
  await page.waitForFunction(async () => (await caches.keys()).length > 0);

  const enCache = await page.evaluate(async () => {
    const nombre = (await caches.keys())[0];
    const cache = await caches.open(nombre);
    const urls = (await cache.keys()).map(r => new URL(r.url).pathname);
    return {
      css: urls.includes('/css/styles.css'),
      app: urls.includes('/js/app.js'),
      studio: urls.includes('/js/studio.js'),
      manifest: urls.includes('/manifest.webmanifest')
    };
  });

  expect(enCache).toEqual({ css: true, app: true, studio: true, manifest: true });
});

test('las capturas del manifest NO se precachean', async ({ page }) => {
  // Son ~871 KB y el navegador solo las pide al mostrar la ficha de
  // instalación, que ocurre en línea. Precachearlas costaría esa descarga a
  // cada clienta en la primera carga y en cada entrega nueva.
  await esperarSW(page);
  await page.waitForFunction(async () => (await caches.keys()).length > 0);

  const rutas = await page.evaluate(async () => {
    const cache = await caches.open((await caches.keys())[0]);
    return (await cache.keys()).map(r => new URL(r.url).pathname);
  });

  expect(rutas.filter(r => r.includes('/screenshots/'))).toEqual([]);
  expect(rutas.filter(r => r.includes('og-image'))).toEqual([]);
});

test('un caché viejo se borra al activarse el nuevo', async ({ page }) => {
  // Si no se borrara, cada entrega dejaría su copia entera del sitio en el
  // teléfono. Se siembra un caché de una versión inventada anterior.
  await page.evaluate(() => caches.open('preciocrea-0.0.1-b1').then(c => c.put(
    new Request('/viejo.txt'), new Response('reliquia'))));

  await page.reload();
  await esperarSW(page);

  await page.waitForFunction(async () =>
    !(await caches.keys()).includes('preciocrea-0.0.1-b1'), null, { timeout: 10000 });

  const claves = await page.evaluate(() => caches.keys());
  expect(claves).not.toContain('preciocrea-0.0.1-b1');
});

test('el manifest es válido y sus iconos existen', async ({ page, request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);

  const manifest = await res.json();
  expect(manifest.start_url).toBe('./');
  expect(manifest.scope).toBe('./');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

  for (const icono of manifest.icons) {
    const r = await request.get('/' + icono.src.replace(/^\.\//, ''));
    expect(r.status(), icono.src).toBe(200);
  }
  for (const captura of manifest.screenshots || []) {
    const r = await request.get('/' + captura.src.replace(/^\.\//, ''));
    expect(r.status(), captura.src).toBe(200);
  }
});

test('la app se declara instalable con lo que Chrome exige', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();

  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  // Un icono de 192 y uno de 512, más los enmascarables de Android.
  const tamanos = manifest.icons.map(i => i.sizes);
  expect(tamanos).toContain('192x192');
  expect(tamanos).toContain('512x512');
  expect(manifest.icons.some(i => (i.purpose || '').includes('maskable'))).toBe(true);
});

test('el sitio pide no ser indexado', async ({ page }) => {
  // Decisión permanente: la app se reparte desde la página de Vivi, no desde
  // un buscador. Lo que lo garantiza es este meta, no robots.txt.
  await page.goto('/index.html');
  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toContain('noindex');
});

test('robots.txt permite el rastreo, a propósito', async ({ request }) => {
  // Un Disallow bloquearía a facebookexternalhit y la vista previa al
  // compartir por WhatsApp llegaría como una URL pelada.
  const txt = await (await request.get('/robots.txt')).text();
  expect(txt).toMatch(/Allow:\s*\//i);
  expect(txt).not.toMatch(/^\s*Disallow:\s*\/\s*$/mi);
});

test('la tarjeta al compartir tiene imagen y va a la URL definitiva', async ({ page, request }) => {
  await page.goto('/index.html');

  const og = async prop =>
    page.locator(`meta[property="og:${prop}"]`).getAttribute('content');

  expect(await og('title')).toBeTruthy();
  expect(await og('description')).toBeTruthy();
  expect(await og('url')).toBe('https://preciocrea.parg.cl/');
  expect(await og('image')).toBe('https://preciocrea.parg.cl/assets/og-image.png');

  // La imagen tiene que existir de verdad en el repo, con ese nombre.
  const r = await request.get('/assets/og-image.png');
  expect(r.status()).toBe(200);
});
