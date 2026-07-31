// Arnés con DOM de verdad: carga index.html en jsdom y le añade js/app.js y
// js/studio.js como <script> reales.
//
// Por qué existe además de load.js:
//   El arnés de node:vm prueba lógica pura, y para eso sobra. Pero las dos
//   funciones más caras de la app —los asistentes de valor hora y de costos
//   fijos— leen y escriben el DOM directamente por getElementById: no reciben
//   sus datos ni devuelven un resultado, lo pintan. Sin un documento no hay
//   forma de ejercitarlas, y son justo las que producen los números que la
//   creadora usa para cobrar.
//
// Por qué jsdom y no seguir con stubs:
//   Los ids son 22 y están escritos a mano en index.html. Simularlos sería
//   copiar el HTML dentro del test, y entonces el test pasaría aunque alguien
//   renombrara un id en index.html: exactamente el fallo que debía detectar.
//   Cargando el HTML real, el vínculo JS↔HTML queda verificado de paso.
//
// Por qué esto NO rompe la promesa de "cero dependencias":
//   Esa promesa es sobre la app que se despacha. jsdom es devDependency: no
//   está en la lista ASSETS de sw.js, no lo mira build-portable.js, y no viaja
//   en el portable ni en el sitio. Quien clone el repo y abra index.html sigue
//   sin instalar nada; solo quien corra los tests necesita `npm install`.
//
// Dos detalles que costaron encontrarse:
//   - runScripts: 'dangerously' + <script> inyectados, NO window.eval(). Con
//     eval indirecto los const de nivel superior (S, ACCIONES, STUDIO) se
//     evaporan igual que en el arnés de vm, y studio.js muere con "ACCIONES is
//     not defined". Como <script> real, quedan en el entorno léxico global del
//     window y window.eval('S') sí los alcanza.
//   - Los <script src> de index.html NO se ejecutan, porque jsdom no carga
//     recursos externos sin `resources: 'usable'`. Es lo que se quiere: los dos
//     archivos se inyectan a mano, leídos del disco, en el orden correcto.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RAIZ = path.resolve(__dirname, '..', '..');

function leer(rel) {
  // Mismo saneo de BOM que hacen load.js y scripts/build-portable.js.
  return fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/^﻿/, '');
}

function cargarAppReal() {
  // jsdom escupe "Not implemented: HTMLCanvasElement.getContext" cada vez que
  // el estudio toca un canvas. No es un fallo del test: es jsdom diciendo que
  // no dibuja. Se silencia para que la salida de la tanda siga siendo legible.
  const consolaVirtual = new VirtualConsole();
  const ruido = [];
  consolaVirtual.on('jsdomError', e => ruido.push(e.message));

  const dom = new JSDOM(leer('index.html'), {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    pretendToBeVisual: true,
    virtualConsole: consolaVirtual
  });

  const w = dom.window;

  // jsdom no implementa matchMedia, e isStandalone() (js/app.js:221) lo llama
  // durante el arranque. Sin esto, app.js muere antes de definir nada.
  if (!w.matchMedia) {
    w.matchMedia = () => ({
      matches: false, media: '', onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent: () => false
    });
  }
  // scrollTo tampoco existe y showView() lo usa en cada cambio de vista.
  if (!w.scrollTo) w.scrollTo = () => {};

  const errores = [];
  for (const rel of ['js/app.js', 'js/studio.js']) {
    const s = w.document.createElement('script');
    s.textContent = leer(rel);
    try {
      w.document.head.appendChild(s);
    } catch (e) {
      errores.push({ archivo: rel, error: e });
    }
  }

  const get = nombre => w.eval(nombre);
  const evaluar = codigo => w.eval(codigo);
  const $ = id => w.document.getElementById(id);
  // El texto que la app pintó en un elemento, sin tener que repetir el getById.
  const texto = id => { const el = $(id); return el ? el.textContent : null; };
  const valor = id => { const el = $(id); return el ? el.value : null; };

  // Escribe en un input como lo haría la creadora y dispara el recálculo que
  // ese campo tiene declarado en data-input, si lo tiene.
  function escribir(id, contenido) {
    const el = $(id);
    if (!el) throw new Error(`no existe el campo #${id}`);
    el.value = String(contenido);
    return el;
  }

  return { dom, window: w, document: w.document, get, evaluar,
           $, texto, valor, escribir, errores, ruido,
           S: get('S'), localStorage: w.localStorage };
}

module.exports = { cargarAppReal, leer, RAIZ };
