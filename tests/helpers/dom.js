// Stubs mínimos de navegador para poder evaluar js/app.js y js/studio.js
// fuera del navegador.
//
// La app no exporta nada: son scripts clásicos que definen globales de nivel
// superior. Para alcanzarlas se evalúan dentro de un contexto de node:vm, y
// ese contexto necesita el puñado de objetos del navegador que el código toca
// mientras se define. No es un DOM: es lo justo para que el archivo termine de
// evaluarse y todas las funciones queden declaradas.
//
// Deliberadamente NO se simula un DOM real. getElementById devuelve null, que
// es la respuesta honesta de "ese elemento no existe aquí", y las funciones que
// pintan pantalla fallan. Eso está bien: esta suite prueba lógica, no render.
// El error del arranque se captura en load.js y se ignora.
//
// Con dos matices que no rompen esa regla:
//   - `elementos` es un registro vacío que un test puede sembrar para el id
//     puntual que necesite (p. ej. 'toast', para leer el mensaje que la app
//     quiso mostrar). Sin sembrarlo, getElementById sigue devolviendo null.
//   - Blob, URL.createObjectURL y window.open quedan instrumentados: guardan lo
//     que la app les pasó en vez de tragárselo. Descargar un respaldo o abrir
//     WhatsApp son efectos hacia afuera, y sin registrarlos no hay forma de
//     comprobar QUÉ se descargó ni QUÉ enlace se abrió.

'use strict';

const noop = () => {};

// Los tres stubs sin los cuales el archivo NO termina de evaluarse:
//   - document.addEventListener  (js/app.js:144, antes de toda definición)
//   - window.addEventListener    (setupInstallPrompt)
//   - window.matchMedia          (isStandalone, js/app.js:221)
// Si falta cualquiera de ellos el script muere antes de definir nada y todos
// los tests fallan con "undefined is not a function", sin pista de por qué.
function crearSandbox() {
  const almacen = new Map();

  // Interruptor para simular un navegador con el almacenamiento bloqueado
  // (modo privado de Safari, cuota agotada). Varias funciones prometen
  // sobrevivir a eso; sin este interruptor la promesa no se puede verificar.
  const control = { lanzaAlLeer: false, lanzaAlEscribir: false };

  const localStorage = {
    getItem(k) {
      if (control.lanzaAlLeer) throw new Error('almacenamiento bloqueado');
      return almacen.has(k) ? almacen.get(k) : null;
    },
    setItem(k, v) {
      if (control.lanzaAlEscribir) throw new Error('cuota agotada');
      almacen.set(k, String(v));
    },
    removeItem(k) { almacen.delete(k); },
    clear() { almacen.clear(); },
    key(i) { return [...almacen.keys()][i] ?? null; },
    get length() { return almacen.size; }
  };

  const clasesFalsas = () => ({
    add: noop, remove: noop, toggle: noop, contains: () => false
  });

  const elementoFalso = () => ({
    style: { setProperty: noop, removeProperty: noop },
    classList: clasesFalsas(),
    dataset: {},
    value: '',
    textContent: '',
    innerHTML: '',
    setAttribute: noop,
    removeAttribute: noop,
    appendChild: noop,
    addEventListener: noop,
    removeEventListener: noop,
    focus: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getContext: () => null,
    toDataURL: () => 'data:image/jpeg;base64,',
    click: noop,
    // exportData() y studioDescargar() sacan su <a> del documento después de
    // pulsarlo. Sin este remove, las dos funciones mueren a mitad de camino.
    remove: noop
  });

  // Registro de elementos que un test puede sembrar; vacío por defecto.
  const elementos = new Map();
  // Todo lo que la app haya creado con createElement, en orden. Así se puede
  // comprobar el <a> de una descarga sin un DOM de verdad.
  const creados = [];

  const document = {
    addEventListener: noop,
    removeEventListener: noop,
    getElementById: id => elementos.get(id) ?? null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: etiqueta => {
      const el = elementoFalso();
      el.tagName = String(etiqueta || '').toUpperCase();
      creados.push(el);
      return el;
    },
    contains: () => false,
    body: elementoFalso(),
    documentElement: elementoFalso(),
    head: elementoFalso(),
    referrer: '',
    title: 'PrecioCrea',
    visibilityState: 'visible'
  };

  const navigator = {
    userAgent: 'node',
    language: 'es-CL',
    standalone: false
    // Sin `serviceWorker` a propósito: `'serviceWorker' in navigator`
    // (js/app.js:2474) da false y el bloque de registro no se evalúa.
    // Sin `share` ni `canShare`: studioCanShareFiles() devuelve false.
  };

  // Blob que conserva lo que se le pasó. El de verdad tampoco deja leer su
  // contenido sin async, y aquí lo que interesa es exactamente ese contenido:
  // el JSON del respaldo que se está descargando.
  function BlobFalso(partes = [], opciones = {}) {
    const texto = [...partes].map(String).join('');
    this.type = opciones.type || '';
    this.size = texto.length;
    this.texto = () => texto;
    this.text = () => Promise.resolve(texto);
  }

  // URL.createObjectURL / revokeObjectURL guardando lo que pasa por ellas.
  // Se extiende la URL real para no perder `new URL(...)` ni sus estáticos.
  const objetos = { creados: new Map(), revocados: [], n: 0 };
  class URLLocal extends URL {}
  URLLocal.createObjectURL = blob => {
    const url = `blob:local/${++objetos.n}`;
    objetos.creados.set(url, blob);
    return url;
  };
  URLLocal.revokeObjectURL = url => { objetos.revocados.push(url); };

  // Lo que la app intentó abrir en otra pestaña (WhatsApp, el sitio de Vivi…).
  const aperturas = [];

  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    queueMicrotask,
    URL: URLLocal, URLSearchParams, TextEncoder, TextDecoder,
    localStorage,
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    document,
    navigator,
    location: { href: 'http://localhost/', origin: 'http://localhost',
                pathname: '/', search: '', hash: '', reload: noop },
    history: { pushState: noop, replaceState: noop, back: noop,
               go: noop, state: null, length: 1 },
    matchMedia: () => ({ matches: false, addEventListener: noop,
                         removeEventListener: noop, addListener: noop }),
    addEventListener: noop,
    removeEventListener: noop,
    requestAnimationFrame: cb => setTimeout(cb, 0),
    cancelAnimationFrame: noop,
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    Image: function Image() { return elementoFalso(); },
    FileReader: function FileReader() { return { readAsText: noop, onload: null }; },
    Blob: BlobFalso,
    alert: noop,
    open: (url, destino, opciones) => { aperturas.push({ url, destino, opciones }); }
  };

  // `window`, `self` y `globalThis` son el mismo objeto, como en el navegador.
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  return { sandbox, almacen, control, elementoFalso, elementos, creados,
           objetos, aperturas };
}

// Contexto para sw.js: solo necesita `self.addEventListener` para que las
// cuatro suscripciones de nivel superior no revienten. Todo lo que interesa
// (VERSION, BUILD, CACHE, ASSETS, NUCLEO) son const de nivel superior.
function crearSandboxSW() {
  const sandbox = {
    console,
    setTimeout, clearTimeout,
    URL,
    caches: { open: noop, keys: () => Promise.resolve([]), delete: noop, match: noop },
    fetch: noop,
    Response: function Response() {},
    location: { origin: 'http://localhost' }
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.addEventListener = noop;
  sandbox.skipWaiting = noop;
  sandbox.clients = { claim: noop };
  return { sandbox };
}

module.exports = { crearSandbox, crearSandboxSW };
