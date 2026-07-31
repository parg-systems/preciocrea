// El respaldo exportado es la única copia de seguridad que existe: la app no
// tiene servidor. Si el archivo sale incompleto nadie se entera hasta el día
// que hace falta, que es justamente el día en que ya se perdieron los datos.
//
// Aquí se prueba qué sale del archivo (formato v4 completo), cómo se llama, y
// la ida y vuelta: que lo exportado, pasado por el mismo saneador que usa la
// importación, devuelva los mismos productos y los mismos números.

'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, plano } = require('./helpers/load.js');

const app = cargarApp();
const exportData = app.get('exportData');
const getBackupState = app.get('getBackupState');
const sanitizeImportedProduct = app.get('sanitizeImportedProduct');
const studioLoadBrand = app.get('studioLoadBrand');
const KEY_BACKUP = app.get('KEY_BACKUP');
const KEY_BRAND = app.get('KEY_BRAND');
const STUDIO = app.get('STUDIO');

// Un producto tal como lo deja saveProduct (js/app.js:1562): el RESULTADO del
// cálculo, no los insumos. Las horas, el valor hora y las unidades no se
// guardan — y por tanto tampoco se respaldan.
const PRODUCTO = {
  id: 1, addedAt: 1, name: 'Jabón de lavanda', emoji: '🧼', desc: 'Aceite de oliva',
  date: '31-07-2026',
  mat: 2170, labor: 20000, cr: 3326, struct: 2667,
  minP: 28162, idealP: 42243,
  margin: 50, crLvl: 'moderado'
};

// Estado de partida limpio: productos, marca, valor hora y costos fijos.
function limpiar() {
  app.resetear();
  app.S.rate = null;
  app.S.fixed = null;
  studioLoadBrand();          // marca por defecto, sin nombre
  app.sembrarElemento('toast');
}

// Descarga simulada: el <a> que la app creó y el contenido del blob.
function descarga() {
  const enlace = [...app.creados].reverse().find(el => el.tagName === 'A');
  if (!enlace) return null;
  const blob = app.objetos.creados.get(enlace.href);
  return { enlace, blob, payload: blob ? JSON.parse(blob.texto()) : null };
}

beforeEach(limpiar);

describe('exportData — cuándo se exporta y cuándo no', () => {
  test('con la app entera vacía avisa y no descarga nada', () => {
    exportData();

    assert.equal(descarga(), null, 'no debía crear ningún <a>');
    assert.match(app.toastSembrado(), /No hay productos/);
  });

  test('con productos exporta', () => {
    app.S.products = [{ ...PRODUCTO }];
    exportData();

    assert.ok(descarga(), 'debía crear el enlace de descarga');
    assert.match(app.toastSembrado(), /Respaldo descargado/);
  });

  test('sin productos pero con marca guardada, exporta igual', () => {
    // Configurar la marca cuesta trabajo: perderla también es perder datos.
    app.almacen.set(KEY_BRAND, JSON.stringify({ name: 'Vivi Loaiza' }));
    studioLoadBrand();
    exportData();

    assert.ok(descarga(), 'la marca sola ya justifica un respaldo');
  });

  test('sin productos pero con el valor hora calculado, exporta igual', () => {
    app.S.rate = { valor: 8300 };
    exportData();
    assert.ok(descarga());
  });

  test('sin productos pero con los costos fijos, exporta igual', () => {
    app.S.fixed = { total: 124944 };
    exportData();
    assert.ok(descarga());
  });
});

describe('exportData — el archivo', () => {
  test('el payload es el formato v4 completo', () => {
    app.S.products = [{ ...PRODUCTO }];
    app.S.rate = { valor: 8300 };
    app.S.fixed = { total: 124944 };
    exportData();

    const { payload } = descarga();
    assert.equal(payload.app, 'PrecioCrea');
    assert.equal(payload.version, 4, 'el importador distingue v1…v4 por este número');
    assert.deepEqual(Object.keys(payload).sort(),
      ['app', 'brand', 'exportDate', 'fixed', 'products', 'rate', 'version']);
    assert.equal(payload.products.length, 1);
    assert.deepEqual(payload.rate, { valor: 8300 });
    assert.deepEqual(payload.fixed, { total: 124944 });
  });

  test('sin valor hora ni costos fijos esos campos van en null, no ausentes', () => {
    app.S.products = [{ ...PRODUCTO }];
    exportData();

    const { payload } = descarga();
    assert.equal(payload.rate, null);
    assert.equal(payload.fixed, null);
  });

  test('el nombre del archivo lleva la fecha de hoy', () => {
    app.S.products = [{ ...PRODUCTO }];
    exportData();

    const hoy = new Date().toISOString().slice(0, 10);
    assert.equal(descarga().enlace.download, `preciocrea-respaldo-${hoy}.json`);
  });

  test('el blob se declara como JSON y el contenido es legible', () => {
    app.S.products = [{ ...PRODUCTO }];
    exportData();

    const { blob } = descarga();
    assert.equal(blob.type, 'application/json');
    // Indentado: si algún día hay que abrirlo a mano, se puede leer.
    assert.match(blob.texto(), /\n {2}"app": "PrecioCrea"/);
  });

  test('el objeto URL se revoca, pero no antes de tiempo', () => {
    app.S.products = [{ ...PRODUCTO }];
    exportData();

    // Revocar de inmediato aborta la descarga en algunos WebView de Android:
    // la revocación va dentro de un setTimeout, así que aquí todavía no ocurrió.
    assert.deepEqual(app.objetos.revocados, []);
  });
});

describe('exportData — la marca guardada, no el borrador', () => {
  test('exporta lo guardado aunque el formulario diga otra cosa', () => {
    app.almacen.set(KEY_BRAND, JSON.stringify({ name: 'Vivi Loaiza' }));
    studioLoadBrand();
    // La creadora está tecleando un nombre nuevo y no ha pulsado "Guardar".
    STUDIO.brand.name = 'Nombre a medio teclear';
    app.S.products = [{ ...PRODUCTO }];

    exportData();

    assert.equal(descarga().payload.brand.name, 'Vivi Loaiza');
  });
});

describe('exportData — el recordatorio de respaldo', () => {
  test('deja marcada la fecha del respaldo', () => {
    app.S.products = [{ ...PRODUCTO }];
    exportData();

    const marca = app.almacen.get(KEY_BACKUP);
    assert.ok(marca, 'sin esta marca el recordatorio no se apaga nunca');
    assert.ok(Number(marca) > 0);
  });

  test('tras exportar, el recordatorio deja de pedir respaldo', () => {
    app.S.products = [{ ...PRODUCTO }];
    const antes = getBackupState();
    assert.equal(antes.newCount, 1, 'antes de exportar hay un producto pendiente');
    assert.equal(antes.hasBackup, false, 'y ningún respaldo previo');

    exportData();

    // null significa "no hay nada que recordar": el aviso se apaga entero.
    assert.equal(getBackupState(), null);
  });

  test('un almacenamiento que se niega no impide la descarga', () => {
    // El archivo ya se generó: fallar al anotar la fecha no puede tumbar nada.
    app.S.products = [{ ...PRODUCTO }];
    app.control.lanzaAlEscribir = true;

    assert.doesNotThrow(() => exportData());
    assert.ok(descarga(), 'la descarga debe haber ocurrido igual');
  });
});

describe('ida y vuelta — exportar e importar devuelve lo mismo', () => {
  test('los productos sobreviven al viaje por el saneador', () => {
    const original = [
      { ...PRODUCTO },
      { ...PRODUCTO, id: 2, name: 'Vela de soya', emoji: '🕯️', desc: '', margin: 30 }
    ];
    app.S.products = original.map(p => ({ ...p }));
    exportData();

    // Es exactamente lo que hace importData con cada elemento del archivo.
    const vueltos = descarga().payload.products
      .map(p => sanitizeImportedProduct(p))
      .map(plano);

    assert.equal(vueltos.length, 2);
    assert.equal(vueltos.filter(Boolean).length, 2, 'ninguno debe caer como inválido');
    for (const [i, p] of vueltos.entries()) {
      assert.equal(p.id, original[i].id, 'el id se conserva: es la fecha de creación');
      assert.equal(p.name, original[i].name);
      assert.equal(p.emoji, original[i].emoji);
      assert.equal(p.desc, original[i].desc);
      assert.equal(p.minP, original[i].minP, 'el precio mínimo no puede moverse');
      assert.equal(p.idealP, original[i].idealP, 'ni el ideal');
      assert.equal(p.margin, original[i].margin);
      assert.equal(p.crLvl, original[i].crLvl);
      // El desglose que pinta las barras de resultados.
      for (const campo of ['mat', 'labor', 'cr', 'struct']) {
        assert.equal(p[campo], original[i][campo], campo);
      }
    }
  });

  test('el respaldo guarda el resultado, no los insumos', () => {
    // Lo que se guarda de un producto es el precio y su desglose; las horas,
    // el valor hora y las unidades no se persisten (js/app.js:1562), así que
    // tampoco viajan en el respaldo. Un producto importado no se puede
    // "recalcular", solo consultar y reajustar el margen. Está documentado
    // aquí para que un cambio en saveProduct que empiece a guardarlos no pase
    // en silencio: si esto falla, hay que ampliar sanitizeImportedProduct.
    app.S.products = [{ ...PRODUCTO, hours: 2.5, rate: 8000, units: 30 }];
    exportData();

    const vuelto = plano(sanitizeImportedProduct(descarga().payload.products[0]));
    for (const campo of ['hours', 'rate', 'units', 'matTotal', 'fixed']) {
      assert.equal(vuelto[campo], undefined, `${campo} no debería sobrevivir`);
    }
  });

  test('un producto sin descripción ni emoji también vuelve entero', () => {
    app.S.products = [{ ...PRODUCTO, emoji: '', desc: '' }];
    exportData();

    const vuelto = plano(sanitizeImportedProduct(descarga().payload.products[0]));
    assert.equal(vuelto.name, 'Jabón de lavanda');
    assert.equal(vuelto.idealP, 42243);
  });
});
