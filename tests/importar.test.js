// Importar un respaldo: la única puerta por la que entran datos que la app no
// generó. El archivo puede venir de otro teléfono, de una versión vieja, o
// editado a mano por alguien con curiosidad.
//
// Los saneadores ya se prueban en sanitizadores.test.js. Aquí se prueba el
// camino completo con un File y un FileReader de verdad: el tamaño máximo, el
// JSON roto, los formatos v1 a v4, la deduplicación y la reparación de ids
// repetidos dentro del propio archivo.

'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarAppReal } = require('./helpers/dom-real.js');

const app = cargarAppReal();
const S = app.get('S');
const importData = app.get('importData');
const MAX_IMPORT_SIZE = app.get('MAX_IMPORT_SIZE');
const studioBrandPersisted = app.get('studioBrandPersisted');
const studioLoadBrand = app.get('studioLoadBrand');

const PRODUCTO = {
  id: 1000, addedAt: 1000, name: 'Jabón de lavanda', desc: 'Aceite de oliva',
  emoji: '🧼', date: '31-07-2026',
  mat: 2170, labor: 20000, cr: 3326, struct: 2667,
  minP: 28162, idealP: 42243, margin: 50, crLvl: 'moderado'
};

function esperar(condicion, ms = 3000) {
  return new Promise((resolver, rechazar) => {
    const t0 = Date.now();
    const tic = () => {
      if (condicion()) return resolver();
      if (Date.now() - t0 > ms) return rechazar(new Error('el import no terminó'));
      setTimeout(tic, 5);
    };
    tic();
  });
}

// Simula elegir un archivo en el selector. importData limpia input.value al
// terminar, pase lo que pase: eso marca el final de la operación.
async function importar(contenido, { nombre = 'respaldo.json' } = {}) {
  const texto = typeof contenido === 'string' ? contenido : JSON.stringify(contenido);
  const archivo = new app.window.File([texto], nombre, { type: 'application/json' });
  const input = { files: [archivo], value: nombre };
  importData(input);
  await esperar(() => input.value === '');
  return app.texto('toast');
}

beforeEach(() => {
  S.products = [];
  S.rate = null;
  S.fixed = null;
  app.localStorage.clear();
  studioLoadBrand();
  app.$('toast').textContent = '';
});

describe('el archivo antes de leerlo', () => {
  test('el tope de importación es 1 MB', () => {
    assert.equal(MAX_IMPORT_SIZE, 1024 * 1024);
  });

  test('un archivo más grande se rechaza sin leerlo siquiera', async () => {
    const gigante = 'x'.repeat(MAX_IMPORT_SIZE + 1);
    const aviso = await importar(gigante);

    assert.match(aviso, /demasiado grande/);
    assert.equal(S.products.length, 0);
  });

  test('sin archivo elegido no pasa nada', () => {
    const input = { files: [], value: '' };
    assert.doesNotThrow(() => importData(input));
  });
});

describe('archivos que no sirven', () => {
  test('un JSON corrupto avisa y no toca los productos', async () => {
    S.products = [{ ...PRODUCTO }];
    const aviso = await importar('{esto no es json');

    assert.match(aviso, /Archivo inválido/);
    assert.equal(S.products.length, 1, 'lo guardado no se toca');
  });

  test('un JSON válido pero vacío de contenido avisa', async () => {
    const aviso = await importar({ app: 'PrecioCrea', version: 4, products: [] });
    assert.match(aviso, /no tiene productos/);
  });

  test('productos que no pasan el saneador: se avisa en vez de guardar basura', async () => {
    const aviso = await importar({ products: [{ sin: 'nombre' }, 42, null] });

    assert.match(aviso, /Ningún producto del archivo es válido/);
    assert.equal(S.products.length, 0);
  });
});

describe('los formatos históricos de respaldo', () => {
  test('v1: un array pelado de productos', async () => {
    // El respaldo más viejo no era un objeto: era la lista a secas.
    await importar([{ ...PRODUCTO }]);
    assert.equal(S.products.length, 1);
    assert.equal(S.products[0].name, 'Jabón de lavanda');
  });

  test('v2: objeto con products y brand', async () => {
    await importar({
      app: 'PrecioCrea', version: 2,
      products: [{ ...PRODUCTO }],
      brand: { name: 'Vivi Loaiza', handle: 'viviloaiza.cl' }
    });

    assert.equal(S.products.length, 1);
    assert.equal(studioBrandPersisted().name, 'Vivi Loaiza');
  });

  test('v3: además el valor hora', async () => {
    await importar({
      app: 'PrecioCrea', version: 3,
      products: [{ ...PRODUCTO }],
      rate: { rate: 8300, remember: true, savedAt: 1, inputs: {} }
    });

    assert.ok(S.rate, 'el valor hora debía quedar cargado');
  });

  test('v4: además los costos fijos', async () => {
    await importar({
      app: 'PrecioCrea', version: 4,
      products: [{ ...PRODUCTO }],
      fixed: { fixed: 124944, units: 30, remember: true, savedAt: 1, inputs: {} }
    });

    assert.ok(S.fixed, 'los costos fijos debían quedar cargados');
    assert.equal(S.fixed.fixed, 124944);
  });

  test('un respaldo solo de marca, sin productos, sirve igual', async () => {
    // Configurar la marca cuesta trabajo: no puede exigir tener productos.
    const aviso = await importar({ brand: { name: 'Vivi Loaiza' }, products: [] });

    assert.match(aviso, /Se importó tu marca/);
    assert.equal(studioBrandPersisted().name, 'Vivi Loaiza');
  });

  test('el aviso enumera todo lo que sí entró', async () => {
    const aviso = await importar({
      products: [],
      brand: { name: 'Vivi' },
      rate: { rate: 8300, remember: true, savedAt: 1, inputs: {} },
      fixed: { fixed: 124944, units: 30, remember: true, savedAt: 1, inputs: {} }
    });

    assert.match(aviso, /tu marca/);
    assert.match(aviso, /tu valor hora/);
    assert.match(aviso, /tus costos fijos/);
  });
});

describe('duplicados', () => {
  test('reimportar el mismo respaldo no duplica nada', async () => {
    await importar({ products: [{ ...PRODUCTO }] });
    const aviso = await importar({ products: [{ ...PRODUCTO }] });

    assert.match(aviso, /ya están guardados/);
    assert.equal(S.products.length, 1);
  });

  test('los productos nuevos entran y los repetidos no', async () => {
    await importar({ products: [{ ...PRODUCTO }] });
    await importar({ products: [{ ...PRODUCTO }, { ...PRODUCTO, id: 2000, name: 'Vela' }] });

    assert.equal(S.products.length, 2);
    // El spread rehace el array en este lado: el de jsdom tiene otro
    // Array.prototype y deepEqual del modo estricto compara prototipos.
    assert.deepEqual([...S.products.map(p => p.name)].sort(), ['Jabón de lavanda', 'Vela']);
  });

  test('los importados entran al principio de la lista', async () => {
    S.products = [{ ...PRODUCTO, id: 500, name: 'El que ya estaba' }];
    await importar({ products: [{ ...PRODUCTO, id: 900, name: 'El importado' }] });

    assert.equal(S.products[0].name, 'El importado');
  });
});

describe('ids repetidos dentro del propio archivo', () => {
  test('dos productos con el mismo id quedan con ids distintos', async () => {
    // Con ids gemelos, borrar uno borraría los dos y el detalle abriría
    // siempre el primero.
    await importar({ products: [
      { ...PRODUCTO, id: 77, name: 'Uno' },
      { ...PRODUCTO, id: 77, name: 'Dos' }
    ] });

    assert.equal(S.products.length, 2);
    const ids = S.products.map(p => p.id);
    assert.equal(new Set(ids).size, 2, `ids repetidos: ${ids}`);
  });

  test('varios productos sin id válido tampoco chocan entre sí', async () => {
    await importar({ products: [
      { name: 'Uno' }, { name: 'Dos' }, { name: 'Tres' }
    ] });

    const ids = S.products.map(p => p.id);
    assert.equal(new Set(ids).size, 3, `ids repetidos: ${ids}`);
    assert.ok(ids.every(id => Number.isFinite(id) && id > 0), `ids inválidos: ${ids}`);
  });

  test('un id importado no choca con uno ya guardado', async () => {
    S.products = [{ ...PRODUCTO, id: 77, name: 'El que ya estaba' }];
    await importar({ products: [{ name: 'Nuevo sin id' }] });

    const ids = S.products.map(p => Number(p.id));
    assert.equal(new Set(ids).size, ids.length, `ids repetidos: ${ids}`);
  });
});

describe('el respaldo se marca como recién llegado', () => {
  test('los importados cuentan como pendientes de respaldar aquí', async () => {
    // Vienen de otro teléfono: en este todavía no están respaldados. Se mira
    // addedAt y no el id, que conserva la fecha del dispositivo de origen.
    const antes = Date.now();
    await importar({ products: [{ ...PRODUCTO }] });

    assert.ok(S.products[0].addedAt >= antes,
      'addedAt debía refrescarse al importar');
    assert.equal(S.products[0].id, 1000, 'el id original se conserva');
  });
});

describe('el vínculo con el HTML', () => {
  test('el selector de archivo existe y llama a importData', () => {
    const input = app.document.querySelector('input[type="file"][data-change="importData"]');
    assert.ok(input, 'sin este input no hay forma de importar');
    assert.match(input.getAttribute('accept') || '', /json/);
  });
});
