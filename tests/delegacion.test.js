// El contrato de la delegación de eventos.
//
// Desde la 2.1.0 ningún control lleva manejador en línea: todos declaran
// data-action, data-input o data-change, y js/app.js:144-161 los despacha
// contra los registros ACCIONES, ENTRADAS y CAMBIOS.
//
// El despacho es `const fn = ACCIONES[el.dataset.action]; if (fn) fn(el, ev)`.
// Ese `if (fn)` es lo que hace peligroso el contrato: un nombre mal escrito no
// produce ningún error — produce un botón que no hace absolutamente nada, sin
// una línea en la consola. Hay más de cien de estos atributos, y buena parte
// vive dentro de plantillas de JavaScript que solo se renderizan al abrir una
// pantalla concreta, así que probando a mano es fácil no pasar nunca por ahí.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, leer } = require('./helpers/load.js');

const app = cargarApp();

// Los tres registros se llenan en dos tiempos: app.js declara los objetos y
// añade los suyos, studio.js añade los propios al cargarse después.
const REGISTROS = {
  action: { handlers: app.get('ACCIONES'), registro: 'ACCIONES' },
  input:  { handlers: app.get('ENTRADAS'), registro: 'ENTRADAS' },
  change: { handlers: app.get('CAMBIOS'),  registro: 'CAMBIOS' }
};

// Los atributos viven en dos sitios: el HTML estático y las plantillas de
// cadena que arman las vistas dinámicas (lista de productos, detalle, estudio).
// Mirar solo index.html dejaría fuera más de la mitad.
const FUENTES = ['index.html', 'js/app.js', 'js/studio.js'];

function recolectar(attr) {
  const encontrados = new Map();   // nombre → archivos donde aparece
  for (const archivo of FUENTES) {
    const texto = leer(archivo);
    const re = new RegExp(`data-${attr}="([a-zA-Z0-9_-]+)"`, 'g');
    for (const m of texto.matchAll(re)) {
      if (!encontrados.has(m[1])) encontrados.set(m[1], new Set());
      encontrados.get(m[1]).add(archivo);
    }
  }
  return encontrados;
}

// Un data-action="${expresión}" se resuelve en tiempo de ejecución y no puede
// verificarse leyendo el archivo. Se cuentan para no dar por cubierto lo que
// no lo está.
function interpolados(attr) {
  let n = 0;
  for (const archivo of ['js/app.js', 'js/studio.js']) {
    n += [...leer(archivo).matchAll(new RegExp(`data-${attr}="\\$\\{`, 'g'))].length;
  }
  return n;
}

for (const [attr, { handlers, registro }] of Object.entries(REGISTROS)) {
  describe(`data-${attr} → ${registro}`, () => {
    const usados = recolectar(attr);

    test(`se encontraron atributos data-${attr} que verificar`, () => {
      assert.ok(usados.size > 0, `ninguna fuente declara data-${attr}`);
    });

    test(`todo data-${attr} del proyecto tiene manejador registrado`, () => {
      const huerfanos = [];
      for (const [nombre, archivos] of usados) {
        if (typeof handlers[nombre] !== 'function') {
          huerfanos.push(`${nombre} (en ${[...archivos].join(', ')})`);
        }
      }
      assert.deepEqual(huerfanos, [],
        `sin manejador en ${registro}:\n  ${huerfanos.join('\n  ')}`);
    });

    test(`ningún manejador de ${registro} quedó sin usar`, () => {
      // El inverso: código que ya nadie invoca. No rompe nada, pero es peso
      // muerto que se arrastra y confunde a quien lea el registro.
      const muertos = Object.keys(handlers).filter(n => !usados.has(n));
      const dinamicos = interpolados(attr);
      if (dinamicos > 0 && muertos.length > 0) {
        // Con nombres construidos en tiempo de ejecución no se puede afirmar
        // que sobren: se informa y no se falla.
        console.log(`  · ${registro}: ${muertos.length} sin uso estático, ` +
                    `pero hay ${dinamicos} data-${attr} interpolados que podrían usarlos`);
        return;
      }
      assert.deepEqual(muertos, [], `manejadores sin uso en ${registro}`);
    });
  });
}

describe('los registros están completos', () => {
  test('los tres existen y tienen entradas', () => {
    for (const { handlers, registro } of Object.values(REGISTROS)) {
      assert.equal(typeof handlers, 'object', `${registro} no es un objeto`);
      assert.ok(Object.keys(handlers).length > 0, `${registro} está vacío`);
    }
  });

  test('studio.js alcanzó a registrar los suyos', () => {
    // Si studio.js se cargara antes que app.js, los tres const no existirían
    // todavía y sus Object.assign reventarían. Este es el canario.
    const acciones = REGISTROS.action.handlers;
    assert.equal(typeof acciones.openStudio, 'function', 'falta openStudio (studio.js)');
    assert.equal(typeof acciones.saveBrandForm, 'function', 'falta saveBrandForm (studio.js)');
  });

  test('todo manejador registrado es invocable', () => {
    for (const { handlers, registro } of Object.values(REGISTROS)) {
      for (const [nombre, fn] of Object.entries(handlers)) {
        assert.equal(typeof fn, 'function', `${registro}.${nombre} no es función`);
      }
    }
  });
});
