// Arnés de carga: evalúa js/app.js y js/studio.js dentro de un contexto de
// node:vm y devuelve una manija para alcanzar sus globales desde los tests.
//
// Por qué node:vm y no eval():
//   `window.eval(fuente)` (eval indirecto) sí define las `function` en el
//   objeto global, pero los `const`/`let` de nivel superior — S, IVA, CR_MULT,
//   MARGINS, ACCIONES, STUDIO_TEMPLATES — quedan en un ámbito efímero que
//   desaparece al terminar el eval. `vm.runInContext` los deja en el entorno
//   léxico global del contexto, así que una segunda evaluación los alcanza.
//   Como calc() lee S.p, esto no es un detalle: es la diferencia entre poder
//   probar el corazón del precio o no.
//
// Por qué el error de arranque no importa:
//   El IIFE init() vive al FINAL de js/app.js (js/app.js:2669), después de
//   todas las declaraciones. Cuando revienta por falta de DOM, todo lo que
//   interesa ya está definido. Se guarda el error y se sigue.
//
// Nada de esto toca el código de producción: los dos archivos se leen tal cual
// están en disco.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { crearSandbox, crearSandboxSW } = require('./dom.js');

const RAIZ = path.resolve(__dirname, '..', '..');

// Mismo saneo que hace read() en scripts/build-portable.js: el BOM al inicio
// de un archivo evaluado es un carácter invisible que rompe el parseo.
function leer(rel) {
  return fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/^\uFEFF/, '');
}

function existe(rel) {
  return fs.existsSync(path.join(RAIZ, rel));
}

function cargarApp() {
  const { sandbox, almacen, control, elementoFalso, elementos, creados,
          objetos, aperturas } = crearSandbox();
  const ctx = vm.createContext(sandbox);
  const errores = [];

  // El orden importa: studio.js usa globales de app.js (fmt, esc, toast, IVA),
  // igual que en index.html, donde su <script> va después.
  for (const rel of ['js/app.js', 'js/studio.js']) {
    try {
      vm.runInContext(leer(rel), ctx, { filename: rel });
    } catch (e) {
      errores.push({ archivo: rel, error: e });
    }
  }

  const get = nombre => vm.runInContext(nombre, ctx);
  const evaluar = codigo => vm.runInContext(codigo, ctx);

  const S = get('S');
  // Foto del estado limpio para poder volver a él entre tests.
  const pInicial = JSON.parse(JSON.stringify(S.p));

  function resetear() {
    Object.assign(S.p, JSON.parse(JSON.stringify(pInicial)));
    S.products = [];
    S.thumbs = {};
    S.step = 1;
    almacen.clear();
    control.lanzaAlLeer = false;
    control.lanzaAlEscribir = false;
    elementos.clear();
    creados.length = 0;
    aperturas.length = 0;
    objetos.creados.clear();
    objetos.revocados.length = 0;
  }

  // Siembra un elemento para un id concreto y lo devuelve. Se usa para los
  // pocos casos en que hace falta leer lo que la app escribió en pantalla —
  // 'toast', sobre todo. Por defecto el documento sigue vacío.
  function sembrarElemento(id) {
    const el = elementoFalso();
    elementos.set(id, el);
    return el;
  }

  // El texto del último toast, o null si la app no mostró ninguno.
  function toastSembrado() {
    const el = elementos.get('toast');
    return el ? el.textContent : null;
  }

  // Deja S.p listo para un cálculo, sin repetir el objeto entero en cada test.
  function conProducto(campos) {
    Object.assign(S.p, campos);
    return S.p;
  }

  return { ctx, get, evaluar, S, resetear, conProducto, almacen, control, errores,
           elementos, creados, objetos, aperturas, sembrarElemento, toastSembrado };
}

// sw.js se evalúa igual, con un contexto propio: así ASSETS, NUCLEO, VERSION y
// BUILD se leen como los valores que son, no como texto adivinado por regex.
function cargarSW() {
  const { sandbox } = crearSandboxSW();
  const ctx = vm.createContext(sandbox);
  vm.runInContext(leer('sw.js'), ctx, { filename: 'sw.js' });
  const get = nombre => vm.runInContext(nombre, ctx);
  return {
    VERSION: get('VERSION'),
    BUILD:   get('BUILD'),
    CACHE:   get('CACHE'),
    ASSETS:  [...get('ASSETS')],
    NUCLEO:  [...get('NUCLEO')],
    EXTRAS:  [...get('EXTRAS')]
  };
}

// Contexto de canvas falso para las funciones de texto del estudio, que reciben
// el ctx como parámetro (js/studio.js:1266) en vez de tomarlo del entorno. Un
// ancho proporcional al número de caracteres basta para probar el algoritmo de
// corte: lo que se verifica es dónde parte, no la tipografía.
function ctxFalso(anchoPorCaracter = 10) {
  return {
    font: '',
    measureText(t) { return { width: String(t).length * anchoPorCaracter }; }
  };
}

// Traduce un objeto o array creado DENTRO del contexto vm a uno del host.
//
// Hace falta porque cada contexto tiene sus propios Object.prototype y
// Array.prototype: assert.deepEqual del modo estricto compara prototipos por
// referencia y falla con "Values have same structure but are not
// reference-equal" aunque el contenido sea idéntico. Los valores primitivos
// (números, cadenas, booleanos) no tienen este problema y no necesitan pasar
// por aquí.
function plano(valor) {
  return JSON.parse(JSON.stringify(valor));
}

module.exports = { cargarApp, cargarSW, ctxFalso, leer, existe, plano, RAIZ };
