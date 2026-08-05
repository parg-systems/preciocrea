// Salud del repositorio: los invariantes que no viven dentro de una función.
//
// Estos tests no cargan la app. Leen los archivos como archivos y comprueban
// que siguen siendo coherentes entre sí. Es la familia de fallos más barata de
// cometer y la más cara de descubrir: nada revienta en el navegador de quien
// desarrolla, y el problema aparece en el teléfono de la creadora.
//
// NOTA: la carpeta tests/ NO está en la lista ASSETS de sw.js, así que crear o
// modificar estos archivos NO obliga a subir BUILD. La regla de la cabecera de
// sw.js aplica solo a lo que se despacha.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { cargarSW, leer, existe, RAIZ } = require('./helpers/load.js');

const sw = cargarSW();
const indexHtml = leer('index.html');

// Las rutas de ASSETS y del manifest son relativas al sitio ('./algo').
const aRuta = ref => ref.replace(/^\.\//, '');

describe('coherencia de versión entre archivos', () => {
  // El número de versión vive en cuatro lugares y nada obliga a moverlos
  // juntos. Cuando se desfasan, sw.js sirve un caché que dice una cosa y la
  // pantalla dice otra.
  const versionIndex = indexHtml.match(/Versión\s+(\d+\.\d+\.\d+)/);
  const versionChangelog = leer('CHANGELOG.md').match(/^##\s+\[(\d+\.\d+\.\d+)\]/m);
  const versionChecklist = leer('docs/QA_CHECKLIST.md').match(/«Versión\s+(\d+\.\d+\.\d+)/);

  test('sw.js declara una versión con formato semántico', () => {
    assert.match(sw.VERSION, /^\d+\.\d+\.\d+$/);
  });

  test('el pie de index.html coincide con VERSION de sw.js', () => {
    assert.ok(versionIndex, 'no se encontró la línea "Versión X.Y.Z" en index.html');
    assert.equal(versionIndex[1], sw.VERSION);
  });

  test('la entrada más reciente del CHANGELOG coincide con VERSION', () => {
    assert.ok(versionChangelog, 'no se encontró ningún encabezado "## [X.Y.Z]" en CHANGELOG.md');
    assert.equal(versionChangelog[1], sw.VERSION);
  });

  test('el checklist de QA coincide con VERSION', () => {
    assert.ok(versionChecklist, 'no se encontró «Versión X.Y.Z» en docs/QA_CHECKLIST.md');
    assert.equal(versionChecklist[1], sw.VERSION);
  });

  test('package.json coincide con VERSION', () => {
    // Son cinco sitios desde que existe package.json. Se añadió aquí el mismo
    // día que el archivo, para que el quinto no repita la deriva que este
    // bloque descubrió en los otros cuatro.
    assert.equal(JSON.parse(leer('package.json')).version, sw.VERSION);
  });
});

describe('package.json — existe solo para los tests', () => {
  const pkg = JSON.parse(leer('package.json'));

  test('no declara dependencias de producción', () => {
    // La app no usa ni una librería. Si algún día aparece algo aquí, deja de
    // ser cierto que basta con clonar y abrir index.html.
    assert.deepEqual(Object.keys(pkg.dependencies || {}), []);
  });

  test('jsdom es de desarrollo, y solo se usa en los tests', () => {
    assert.ok(pkg.devDependencies.jsdom, 'jsdom debería estar en devDependencies');
    for (const rel of ['js/app.js', 'js/studio.js', 'sw.js', 'index.html']) {
      assert.ok(!leer(rel).includes('jsdom'), `${rel} no puede mencionar jsdom`);
    }
  });

  test('no declara "type": "module"', () => {
    // scripts/build-portable.js y los tests usan require(). Con "type":
    // "module" dejan de cargar los tres a la vez.
    assert.equal(pkg.type, undefined);
  });

  test('el script de test corre la tanda entera', () => {
    assert.match(pkg.scripts.test, /node --test/);
  });

  test('node_modules está ignorado por git', () => {
    assert.match(leer('.gitignore'), /^node_modules\/$/m);
  });
});

describe('sw.js — la lista de precacheo', () => {
  test('BUILD es un entero positivo', () => {
    assert.ok(Number.isInteger(sw.BUILD) && sw.BUILD > 0, `BUILD = ${sw.BUILD}`);
  });

  test('el nombre del caché incluye versión y build', () => {
    // Si el nombre no cambia, el service worker sirve archivos viejos para
    // siempre y no hay forma de arreglarlo desde el teléfono.
    assert.ok(sw.CACHE.includes(sw.VERSION), `CACHE = ${sw.CACHE}`);
    assert.ok(sw.CACHE.includes(String(sw.BUILD)), `CACHE = ${sw.CACHE}`);
  });

  test('cada archivo de ASSETS existe en disco', () => {
    for (const ref of sw.ASSETS) {
      // './' es la raíz del sitio, que sirve index.html.
      const rel = ref === './' ? 'index.html' : aRuta(ref);
      assert.ok(existe(rel), `ASSETS declara "${ref}" y no existe`);
    }
  });

  test('ningún JS o CSS de la app queda fuera de ASSETS', () => {
    const despachados = [];
    for (const dir of ['js', 'css']) {
      for (const f of fs.readdirSync(path.join(RAIZ, dir))) {
        if (/\.(js|css)$/.test(f)) despachados.push(`./${dir}/${f}`);
      }
    }
    for (const ref of despachados) {
      assert.ok(sw.ASSETS.includes(ref), `${ref} se despacha pero no está en ASSETS`);
    }
  });

  test('NUCLEO sigue siendo el núcleo y no un recorte accidental', () => {
    // NUCLEO = ASSETS.slice(0, 6) es un acoplamiento posicional invisible:
    // insertar una entrada en medio del array deja fuera del addAll() algo
    // imprescindible y mete un icono, cuyo 404 tumba la instalación entera.
    assert.deepEqual(sw.NUCLEO, [
      './',
      './index.html',
      './css/styles.css',
      './js/app.js',
      './js/studio.js',
      './manifest.webmanifest'
    ]);
    assert.equal(sw.NUCLEO.length + sw.EXTRAS.length, sw.ASSETS.length);
  });

  test('sw.js no se precachea a sí mismo', () => {
    assert.ok(!sw.ASSETS.some(a => a.includes('sw.js')));
  });
});

describe('manifest.webmanifest', () => {
  const manifest = JSON.parse(leer('manifest.webmanifest'));

  // Ancho y alto reales de un PNG: van en el bloque IHDR, que por norma es el
  // primero, en los bytes 16-24. Se lee con fs y sin ninguna dependencia.
  function tamanoPng(rel) {
    const buf = fs.readFileSync(path.join(RAIZ, rel));
    assert.equal(buf.toString('ascii', 12, 16), 'IHDR', `${rel} no parece un PNG`);
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }

  test('es JSON válido y agnóstico de dominio', () => {
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.scope, './');
  });

  test('cada icono existe y mide lo que declara', () => {
    assert.ok(manifest.icons.length > 0);
    for (const icono of manifest.icons) {
      const rel = aRuta(icono.src);
      assert.ok(existe(rel), `el manifest declara ${icono.src} y no existe`);
      const { w, h } = tamanoPng(rel);
      assert.equal(`${w}x${h}`, icono.sizes, `${icono.src} mide ${w}x${h} y declara ${icono.sizes}`);
    }
  });

  test('hay iconos any y maskable, que Android necesita por separado', () => {
    const propositos = manifest.icons.map(i => i.purpose);
    assert.ok(propositos.includes('any'));
    assert.ok(propositos.includes('maskable'));
  });

  test('cada captura de pantalla existe y mide lo que declara', () => {
    for (const shot of manifest.screenshots || []) {
      const rel = aRuta(shot.src);
      assert.ok(existe(rel), `el manifest declara ${shot.src} y no existe`);
      const { w, h } = tamanoPng(rel);
      assert.equal(`${w}x${h}`, shot.sizes, `${shot.src} mide ${w}x${h} y declara ${shot.sizes}`);
    }
  });
});

describe('index.html — invariantes de seguridad y arquitectura', () => {
  const csp = indexHtml.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i
  );

  test('declara una Content-Security-Policy', () => {
    assert.ok(csp, 'no se encontró la meta de CSP');
  });

  test("script-src y style-src siguen siendo 'self' a secas", () => {
    // La 2.1.0 y la 2.1.1 fueron exactamente este trabajo: sacar todo el JS y
    // todo el CSS en línea para poder cerrar la CSP. Volver a abrirla sería
    // deshacerlo sin darse cuenta.
    assert.match(csp[1], /script-src 'self';/);
    assert.match(csp[1], /style-src 'self';/);
    assert.ok(!/script-src[^;]*unsafe-inline/.test(csp[1]), "script-src recuperó 'unsafe-inline'");
    assert.ok(!/style-src[^;]*unsafe-inline/.test(csp[1]), "style-src recuperó 'unsafe-inline'");
    assert.ok(!/unsafe-eval/.test(csp[1]), "la CSP recuperó 'unsafe-eval'");
  });

  test('no hay ni un solo <script> en línea', () => {
    // Un <script> sin src sería bloqueado por la propia CSP: el control no
    // haría nada y no habría más pista que un mensaje en la consola.
    const enLinea = [...indexHtml.matchAll(/<script(?![^>]*\ssrc=)[^>]*>/gi)];
    assert.equal(enLinea.length, 0, `hay ${enLinea.length} <script> en línea`);
  });

  test('ningún elemento lleva manejador on* en línea', () => {
    const manejadores = [...indexHtml.matchAll(/<[a-z][^>]*?\s(on[a-z]+)\s*=/gi)]
      .map(m => m[1]);
    assert.deepEqual(manejadores, [], `manejadores en línea: ${manejadores.join(', ')}`);
  });

  test('ningún elemento lleva atributo style en línea', () => {
    const estilos = [...indexHtml.matchAll(/<[a-z][^>]*?\sstyle\s*=/gi)];
    assert.equal(estilos.length, 0, `hay ${estilos.length} atributos style en línea`);
  });

  test('app.js se carga antes que studio.js', () => {
    // studio.js usa globales de app.js (fmt, esc, toast, IVA). Invertir el
    // orden lo rompe entero y en silencio.
    const iApp = indexHtml.indexOf('js/app.js');
    const iStudio = indexHtml.indexOf('js/studio.js');
    assert.ok(iApp > -1 && iStudio > -1, 'faltan los <script> de la app');
    assert.ok(iApp < iStudio, 'studio.js quedó antes que app.js');
  });

  test('la app sigue fuera de los buscadores', () => {
    assert.match(indexHtml, /<meta\s+name="robots"\s+content="noindex">/i);
  });

  test('la app no carga ningún recurso de un origen externo', () => {
    // Solo se miran los atributos que CARGAN algo: <script src>, <link href>,
    // <img src>, <iframe src>. Los <a href> a Spotify o a viviloaiza.cl son
    // enlaces salientes que la creadora pulsa a propósito — no cargan nada ni
    // los alcanza la CSP. Las metas de Open Graph tampoco: por especificación
    // exigen URL absoluta y son solo texto para quien previsualiza el enlace.
    const externos = [
      ...indexHtml.matchAll(/<(?:script|img|iframe)\b[^>]*\ssrc="(https?:\/\/[^"]+)"/gi),
      ...indexHtml.matchAll(/<link\b[^>]*\shref="(https?:\/\/[^"]+)"/gi)
    ].map(m => m[1]);
    assert.deepEqual(externos, [], `recursos externos: ${externos.join(', ')}`);
  });
});

describe('styles.css — la vista previa no vuelve a ser una zona muerta', () => {
  // Este bloque existe por un fallo concreto: #studio-canvas llevaba
  // touch-action:none permanente y, como ocupa ~el 70% de la pantalla del
  // teléfono, el dedo no podía deslizar el editor hacia abajo. Con mouse (la
  // rueda no pasa por touch-action) y con lápiz funcionaba, así que tardó
  // meses en detectarse. Es exactamente el tipo de regla que alguien
  // "simplifica" dentro de un año sin saber por qué estaba así.
  const css = leer('css/styles.css');
  const bloque = re => (css.match(re) || [''])[0];

  const canvas = bloque(/#studio-canvas\s*\{[^}]*\}/);
  const encuadre = bloque(/\.studio-stage\.encuadrando\s+#studio-canvas\s*\{[^}]*\}/);

  test('#studio-canvas cede el desplazamiento vertical al navegador', () => {
    assert.ok(canvas, 'no se encontró la regla #studio-canvas');
    assert.match(canvas, /touch-action:\s*pan-y/);
  });

  test('#studio-canvas no bloquea los gestos de forma permanente', () => {
    assert.ok(
      !/touch-action:\s*none/.test(canvas),
      'touch-action:none volvió a #studio-canvas: el dedo no podrá deslizar sobre la vista previa'
    );
  });

  test('el bloqueo existe solo dentro del modo encuadre', () => {
    assert.ok(encuadre, 'no se encontró la regla .studio-stage.encuadrando #studio-canvas');
    assert.match(encuadre, /touch-action:\s*none/);
  });
});

describe('sintaxis de todo el JavaScript del proyecto', () => {
  for (const rel of ['js/app.js', 'js/studio.js', 'sw.js', 'scripts/build-portable.js']) {
    test(`${rel} parsea sin errores`, () => {
      execFileSync(process.execPath, ['--check', path.join(RAIZ, rel)], { stdio: 'pipe' });
    });
  }
});
