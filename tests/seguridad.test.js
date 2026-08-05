// Escape de HTML y salud del build portable.
//
// La app nunca envía nada a ningún servidor, así que la superficie de ataque
// es pequeña — pero no es cero: un producto se puede importar desde un archivo
// que llegó por WhatsApp, y su nombre se pinta con innerHTML en varias vistas.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { cargarApp, RAIZ } = require('./helpers/load.js');

const app = cargarApp();
const esc = app.get('esc');

describe('esc — escapar antes de pintar con innerHTML', () => {
  test('neutraliza una etiqueta script', () => {
    assert.equal(esc('<script>alert(1)</script>'),
      '&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('neutraliza el vector clásico de imagen con onerror', () => {
    const salida = esc('<img src=x onerror=alert(1)>');
    assert.ok(!salida.includes('<'), `quedó un < sin escapar: ${salida}`);
    assert.ok(!salida.includes('>'), `quedó un > sin escapar: ${salida}`);
  });

  test('escapa los cinco caracteres peligrosos', () => {
    assert.equal(esc('&'), '&amp;');
    assert.equal(esc('<'), '&lt;');
    assert.equal(esc('>'), '&gt;');
    assert.equal(esc('"'), '&quot;');
    assert.equal(esc("'"), '&#39;');
  });

  test('el ampersand se escapa primero, sin doble codificar en una pasada', () => {
    // El orden importa: si & se reemplazara al final, el &lt; recién creado se
    // convertiría en &amp;lt; y la pantalla mostraría el texto crudo.
    assert.equal(esc('<a href="x">'), '&lt;a href=&quot;x&quot;&gt;');
  });

  test('aplicarlo dos veces SÍ vuelve a escapar', () => {
    // Comportamiento real y esperable de un escape sin estado. Queda fijado
    // para dejar constancia de que esc() no es idempotente: hay que llamarlo
    // una sola vez, justo antes de insertar en el HTML.
    assert.equal(esc(esc('&')), '&amp;amp;');
  });

  test('null y undefined no revientan la vista', () => {
    assert.equal(esc(null), '');
    assert.equal(esc(undefined), '');
    assert.equal(esc(0), '0');
  });

  test('un nombre de producto hostil sale inofensivo', () => {
    const hostil = '<img src=x onerror="fetch(\'//malo\')">';
    const salida = esc(hostil);
    assert.ok(!/[<>]/.test(salida));
    assert.ok(!salida.includes('"'), 'las comillas siguen sin escapar');
  });
});

describe('build portable', () => {
  // El script ya lleva dentro siete comprobaciones que terminan en
  // process.exit(1): CSP con 'unsafe-inline' donde toca, ningún archivo sin
  // inlinear, ningún origen externo, ninguna meta Open Graph superviviente y
  // ningún carácter invisible. No hay que reescribirlas: hay que ejecutarlas.
  //
  // OJO: esto regenera preciocrea-portable.html en la raíz. Es un artefacto de
  // build, está en .gitignore y el propio README documenta ese comando como la
  // forma de regenerarlo, así que no ensucia el repositorio.
  const salida = path.join(RAIZ, 'preciocrea-portable.html');

  test('el script termina sin errores y sus guards pasan', () => {
    execFileSync(process.execPath, [path.join(RAIZ, 'scripts', 'build-portable.js')],
      { cwd: RAIZ, stdio: 'pipe' });
    assert.ok(fs.existsSync(salida), 'no se generó preciocrea-portable.html');
  });

  test('el portable es autocontenido: sin referencias a archivos sueltos', () => {
    const html = fs.readFileSync(salida, 'utf8');
    assert.ok(!/<script[^>]+src="[^"]*\.js"/.test(html), 'quedó un <script src>');
    assert.ok(!/<link[^>]+href="[^"]*\.css"/.test(html), 'quedó un <link> de CSS');
    assert.ok(html.includes('<style'), 'no se inlineó el CSS');
  });

  test('el portable no arrastra el service worker ni el manifest', () => {
    // Un archivo suelto que llega por WhatsApp no tiene origen que cachear ni
    // app que instalar: ofrecerlo daría pasos que no funcionan.
    const html = fs.readFileSync(salida, 'utf8');
    assert.ok(!html.includes('serviceWorker.register'), 'quedó el registro del SW');
    assert.ok(!/<link[^>]+rel="manifest"/.test(html), 'quedó el manifest');
  });

  test('el portable no contiene caracteres invisibles', () => {
    // El caso real fue un BOM dentro del <style>: el parser de CSS se comió el
    // primer selector y la app salió sin paleta, sin ningún error.
    const html = fs.readFileSync(salida, 'utf8');
    const invisible = [...html].findIndex(c => {
      const cp = c.codePointAt(0);
      return cp === 0xFEFF || (cp >= 0x200B && cp <= 0x200F) || cp === 0x2060;
    });
    assert.equal(invisible, -1,
      invisible >= 0 ? `carácter invisible en la posición ${invisible}` : '');
  });
});

// ---------------------------------------------------------------------------
// XSS un peldaño más arriba: no que esc() escape, sino que el DOM resultante no
// contenga el elemento. Es la diferencia entre probar la cerradura y probar la
// puerta — se pinta con innerHTML en varias vistas, y basta con que UNA se
// olvide de esc() para que el ataque pase aunque esc() funcione perfecto.
//
// El vector es real: un respaldo .json llega por WhatsApp y se importa. Nadie
// revisa el archivo antes.

const { cargarAppReal } = require('./helpers/dom-real.js');

const real = cargarAppReal();
const Sr = real.get('S');
const renderProducts = real.get('renderProducts');
const renderHome = real.get('renderHome');
const sanear = real.get('sanitizeImportedProduct');

const VECTORES = [
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '<svg onload=alert(1)>',
  '"><img src=x onerror=alert(1)>',
  "<iframe src='javascript:alert(1)'>"
];

function conProducto(campos) {
  Sr.products = [Object.assign({
    id: 1, addedAt: 1, name: 'Producto', desc: '', emoji: '🧼',
    date: '31-07-2026', mat: 100, labor: 200, cr: 30, struct: 40,
    minP: 370, idealP: 500, margin: 50, crLvl: 'facil'
  }, campos)];
  renderProducts();
  renderHome();
}

describe('el nombre malicioso llega al DOM como texto, no como elemento', () => {
  for (const vector of VECTORES) {
    test(`no crea elementos: ${vector.slice(0, 28)}`, () => {
      conProducto({ name: vector });
      const lista = real.$('products-list');

      assert.equal(lista.querySelectorAll('img, script, svg, iframe').length, 0,
        `el vector creó elementos en la lista`);
      // Y el nombre sí se ve, como texto: escapar no puede significar perderlo.
      assert.ok(lista.textContent.includes(vector.slice(0, 10)),
        'el nombre debía mostrarse como texto');
    });
  }

  test('tampoco en la descripción', () => {
    conProducto({ name: 'Jabón', desc: '<img src=x onerror=alert(1)>' });
    assert.equal(real.$('products-list').querySelectorAll('img').length, 0);
  });

  test('tampoco en el emoji', () => {
    // El emoji se pinta suelto y es lo que menos parece peligroso.
    conProducto({ name: 'Jabón', emoji: '<img src=x onerror=alert(1)>' });
    assert.equal(real.$('products-list').querySelectorAll('img').length, 0);
  });

  test('un nombre que viene de un respaldo importado tampoco ejecuta', () => {
    // Camino completo: el mismo saneador que usa importData y luego el render.
    const p = sanear({ id: 5, name: '<img src=x onerror=alert(1)>', minP: 1, idealP: 2 });
    Sr.products = [p];
    renderProducts();

    assert.equal(real.$('products-list').querySelectorAll('img').length, 0);
  });

  test('el buscador tampoco: filtrar no reintroduce el marcado', () => {
    conProducto({ name: '<img src=x onerror=alert(1)>' });
    const inp = real.$('inp-search');
    if (inp) {
      inp.value = 'img';
      real.get('renderProducts')();
    }
    assert.equal(real.$('products-list').querySelectorAll('img').length, 0);
  });
});

// ---------------------------------------------------------------------------
// La fecha del producto. Fue el único campo del detalle que se pintaba sin
// esc() (revisión de seguridad post-2.3.1): el saneador aceptaba cualquier
// string de 30 caracteres y `showDetail` lo interpolaba crudo. En el sitio la
// CSP frenaba el script; en el portable, con 'unsafe-inline', ejecutaba.
// Dos capas, dos tests: el saneador limpia, y el render escapa igual aunque
// el dato hostil ya viva en el estado (un localStorage de una versión vieja).

describe('la fecha del producto no llega al DOM como marcado', () => {
  const showDetail = real.get('showDetail');

  test('el saneador de importación quita los caracteres con significado en HTML', () => {
    for (const vector of VECTORES) {
      const p = sanear({ id: 7, name: 'Jabón', minP: 1, idealP: 2, date: vector });
      assert.ok(!/[<>"'&]/.test(p.date),
        `quedó un carácter peligroso en la fecha: ${p.date}`);
    }
  });

  test('una fecha sin sanear tampoco crea elementos en el detalle', () => {
    conProducto({ date: '<svg onload=alert(1)>' });
    showDetail(1);
    const fecha = real.$('det-body').querySelector('.detail-date');
    assert.ok(fecha, 'no se pintó la línea de fecha');
    assert.equal(fecha.childElementCount, 0,
      'la fecha hostil creó elementos dentro del detalle');
    // Y se ve como texto: escapar no puede significar perderla.
    assert.ok(fecha.textContent.includes('<svg'),
      'la fecha debía mostrarse como texto crudo');
  });

  test('el camino completo respaldo → detalle queda inerte', () => {
    const p = sanear({ id: 9, name: 'Vela', minP: 1, idealP: 2,
      date: '"><img src=x onerror=alert(1)>' });
    Sr.products = [p];
    showDetail(9);
    assert.equal(real.$('det-body').querySelectorAll('[onerror], [onload]').length, 0,
      'sobrevivió un atributo de evento en el detalle');
  });
});

// ---------------------------------------------------------------------------
// Las miniaturas. loadThumbs validaba solo el prefijo del data URL: una
// miniatura manipulada con comillas pasaba el filtro y rompía el atributo
// src al pintarse. Ahora se exige el alfabeto base64 completo (espejo de la
// validación del logo de marca) y el render escapa por si acaso.

describe('una miniatura manipulada en localStorage no rompe el atributo src', () => {
  const loadThumbs = real.get('loadThumbs');
  const KEY = 'pc_thumbs_v1';

  test('loadThumbs descarta un data URL con caracteres fuera del base64', () => {
    real.localStorage.setItem(KEY, JSON.stringify({
      1: 'data:image/jpeg;base64,AA" onerror="alert(1)',
      2: 'data:image/jpeg;base64,<script>',
      3: 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    }));
    const out = loadThumbs();
    assert.equal(out[1], undefined, 'pasó la miniatura con comillas');
    assert.equal(out[2], undefined, 'pasó la miniatura con marcado');
    assert.ok(out[3], 'la miniatura legítima debía sobrevivir');
    real.localStorage.removeItem(KEY);
  });

  test('aunque el estado ya tenga una miniatura hostil, el render la escapa', () => {
    Sr.thumbs = { 1: 'data:image/jpeg;base64,AA" onerror="alert(1)' };
    conProducto({});
    assert.equal(real.$('products-list').querySelectorAll('[onerror]').length, 0,
      'la miniatura hostil inyectó un atributo onerror');
    Sr.thumbs = {};
  });
});
