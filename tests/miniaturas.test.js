// Las miniaturas de producto viven en localStorage junto a los productos, y ahí
// está el peligro: son data URLs de imagen, es decir lo más pesado que la app
// guarda. Si se acumulan sin control llenan la cuota y el que empieza a fallar
// no es el thumbnail — es persistProducts(), o sea el trabajo de la creadora.
//
// De ahí las tres defensas que se prueban aquí: un tope por miniatura al
// cargar, una poda de las que quedaron huérfanas, y una escritura que se
// revierte si el almacenamiento dice que no.

'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, plano } = require('./helpers/load.js');

const app = cargarApp();
const loadThumbs = app.get('loadThumbs');
const persistThumbs = app.get('persistThumbs');
const getThumb = app.get('getThumb');
const setThumb = app.get('setThumb');
const removeThumb = app.get('removeThumb');
const pruneThumbs = app.get('pruneThumbs');
const THUMB_MAX_STORED = app.get('THUMB_MAX_STORED');
const KEY_THUMBS = app.get('KEY_THUMBS');

const PREFIJO = 'data:image/jpeg;base64,';
// Una miniatura válida del largo que se pida.
const mini = (largo = 100) => PREFIJO + 'A'.repeat(Math.max(0, largo - PREFIJO.length));

function sembrarCrudo(objeto) {
  app.almacen.set(KEY_THUMBS, JSON.stringify(objeto));
}

beforeEach(() => {
  app.resetear();
});

describe('THUMB_MAX_STORED — el tope que protege la cuota', () => {
  test('son 30 KB', () => {
    assert.equal(THUMB_MAX_STORED, 30 * 1024);
  });

  test('una miniatura dentro del tope se carga', () => {
    sembrarCrudo({ 1: mini(THUMB_MAX_STORED) });
    assert.equal(Object.keys(plano(loadThumbs())).length, 1);
  });

  test('una miniatura más grande que el tope se descarta al cargar', () => {
    sembrarCrudo({ 1: mini(THUMB_MAX_STORED + 1), 2: mini(500) });
    const thumbs = plano(loadThumbs());

    assert.deepEqual(Object.keys(thumbs), ['2'], 'solo debía sobrevivir la chica');
  });
});

describe('loadThumbs — lo que llega de localStorage es dato ajeno', () => {
  test('sin nada guardado devuelve un objeto vacío', () => {
    assert.deepEqual(plano(loadThumbs()), {});
  });

  test('un JSON corrupto no rompe: devuelve vacío', () => {
    app.almacen.set(KEY_THUMBS, '{no es json');
    assert.deepEqual(plano(loadThumbs()), {});
  });

  test('un array o un escalar donde debía haber un objeto se descartan', () => {
    for (const crudo of ['[1,2,3]', '42', '"texto"', 'null']) {
      app.almacen.set(KEY_THUMBS, crudo);
      assert.deepEqual(plano(loadThumbs()), {}, `con ${crudo}`);
    }
  });

  test('las claves que no son id de producto se descartan', () => {
    sembrarCrudo({ 'abc': mini(), '0': mini(), '-3': mini(), '7': mini() });
    assert.deepEqual(Object.keys(plano(loadThumbs())), ['7']);
  });

  test('solo se acepta un data URL de JPEG: nada de http ni de SVG', () => {
    sembrarCrudo({
      1: 'https://ejemplo.cl/foto.jpg',
      2: 'data:image/svg+xml,<svg onload=alert(1)>',
      3: 'javascript:alert(1)',
      4: mini()
    });
    assert.deepEqual(Object.keys(plano(loadThumbs())), ['4']);
  });

  test('un valor que no es texto se descarta', () => {
    sembrarCrudo({ 1: 42, 2: null, 3: { a: 1 }, 4: mini() });
    assert.deepEqual(Object.keys(plano(loadThumbs())), ['4']);
  });

  test('un almacenamiento que lanza al leer devuelve vacío, no propaga', () => {
    app.control.lanzaAlLeer = true;
    assert.deepEqual(plano(loadThumbs()), {});
  });
});

describe('getThumb / setThumb / removeThumb', () => {
  test('getThumb de un id sin miniatura devuelve null, no undefined', () => {
    // Va derecho a un <img src>: undefined pintaría el literal "undefined".
    assert.equal(getThumb(42), null);
  });

  test('setThumb guarda en memoria y en localStorage', () => {
    setThumb(1, mini());
    assert.equal(getThumb(1), mini());
    assert.deepEqual(Object.keys(JSON.parse(app.almacen.get(KEY_THUMBS))), ['1']);
  });

  test('si el almacenamiento se niega, la miniatura no queda solo en memoria', () => {
    // Una miniatura que se ve hasta la próxima recarga y luego desaparece
    // confunde más que no haberla mostrado nunca.
    app.control.lanzaAlEscribir = true;
    setThumb(1, mini());

    assert.equal(getThumb(1), null, 'debía revertirse');
  });

  test('al fallar la escritura se restaura la miniatura anterior, no se borra', () => {
    setThumb(1, mini(200));
    app.control.lanzaAlEscribir = true;
    setThumb(1, mini(300));

    assert.equal(getThumb(1), mini(200), 'la que ya estaba debe seguir ahí');
  });

  test('removeThumb borra y persiste', () => {
    setThumb(1, mini());
    setThumb(2, mini());
    removeThumb(1);

    assert.equal(getThumb(1), null);
    assert.deepEqual(Object.keys(JSON.parse(app.almacen.get(KEY_THUMBS))), ['2']);
  });

  test('removeThumb de un id sin miniatura no escribe nada', () => {
    app.almacen.delete(KEY_THUMBS);
    removeThumb(99);
    assert.equal(app.almacen.has(KEY_THUMBS), false, 'no debía tocar localStorage');
  });

  test('persistThumbs informa si pudo escribir', () => {
    assert.equal(persistThumbs(), true);
    app.control.lanzaAlEscribir = true;
    assert.equal(persistThumbs(), false, 'debe devolver false, no lanzar');
  });
});

describe('pruneThumbs — lo que impide que localStorage se llene', () => {
  test('borra las miniaturas de productos que ya no existen', () => {
    app.S.products = [{ id: 1, name: 'Vive' }];
    setThumb(1, mini());
    setThumb(2, mini());
    setThumb(3, mini());

    pruneThumbs();

    assert.deepEqual(Object.keys(plano(app.S.thumbs)), ['1']);
  });

  test('la poda también se guarda: no revive al recargar', () => {
    app.S.products = [{ id: 1, name: 'Vive' }];
    setThumb(1, mini());
    setThumb(2, mini());
    pruneThumbs();

    assert.deepEqual(Object.keys(JSON.parse(app.almacen.get(KEY_THUMBS))), ['1']);
  });

  test('compara ids como números: un "1" de texto no borra al producto 1', () => {
    // Los ids que vienen de un respaldo importado pueden llegar como texto.
    app.S.products = [{ id: '1', name: 'Importado' }];
    setThumb(1, mini());
    pruneThumbs();

    assert.deepEqual(Object.keys(plano(app.S.thumbs)), ['1']);
  });

  test('sin nada que podar no escribe en localStorage', () => {
    app.S.products = [{ id: 1 }];
    setThumb(1, mini());
    app.almacen.delete(KEY_THUMBS);

    pruneThumbs();

    assert.equal(app.almacen.has(KEY_THUMBS), false);
  });

  test('sin productos borra todas las miniaturas', () => {
    setThumb(1, mini());
    setThumb(2, mini());
    app.S.products = [];

    pruneThumbs();

    assert.deepEqual(plano(app.S.thumbs), {});
  });
});
