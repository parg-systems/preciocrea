// Los saneadores: la puerta por donde entran datos que no escribimos nosotros.
//
// Todo lo que sale de localStorage o de un respaldo importado se trata con la
// misma desconfianza, y por buenas razones: el respaldo puede llegar por
// WhatsApp desde otro teléfono, venir de una versión antigua de la app, o
// estar a medio escribir porque se agotó la cuota. Un dato con forma
// inesperada que entre en crudo revienta renderHome() y deja la app en blanco
// — y desde el teléfono no hay forma de limpiar el almacenamiento para volver.

'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, plano } = require('./helpers/load.js');

const app = cargarApp();
const sanearProducto = app.get('sanitizeImportedProduct');
const sanearRate = app.get('sanitizeRateProfile');
const sanearFixed = app.get('sanitizeFixedProfile');
const sanearMarca = app.get('studioSanitizeBrand');
const estadoRespaldo = app.get('getBackupState');
const siguienteId = app.get('nextProductId');
const cargarProductos = app.get('loadProducts');
const MARGINS = app.get('MARGINS');
const MAX_NAME_LEN = app.get('MAX_NAME_LEN');
const MAX_DESC_LEN = app.get('MAX_DESC_LEN');
const KEY_PRODUCTS = app.get('KEY_PRODUCTS');
const KEY_BACKUP = app.get('KEY_BACKUP');
const MARCA_DEFECTO = app.get('STUDIO_BRAND_DEFAULT');

const DIA = 86400000;

beforeEach(() => app.resetear());

describe('sanitizeImportedProduct — un producto de un respaldo ajeno', () => {
  test('lo que no es un objeto con nombre se descarta', () => {
    for (const basura of [null, undefined, 'texto', 42, [], {}, { name: '' }, { name: '   ' }, { name: 123 }]) {
      assert.equal(sanearProducto(basura), null, `sanear(${JSON.stringify(basura)})`);
    }
  });

  test('el objeto se reconstruye desde cero: los campos extra no sobreviven', () => {
    const p = sanearProducto({ name: 'Jabón', maligno: 'x', script: '<img onerror>' });
    assert.deepEqual(Object.keys(plano(p)).sort(), [
      'addedAt', 'cr', 'crLvl', 'date', 'desc', 'emoji', 'id',
      'idealP', 'labor', 'margin', 'mat', 'minP', 'name', 'struct'
    ]);
  });

  test('un __proto__ en el JSON no contamina el prototipo', () => {
    // Un respaldo recibido por WhatsApp es un archivo de origen desconocido.
    const hostil = JSON.parse('{"name":"a","__proto__":{"pwned":1},"constructor":{"x":1}}');
    sanearProducto(hostil);
    assert.equal({}.pwned, undefined, 'Object.prototype quedó contaminado');
    assert.equal([].pwned, undefined);
  });

  test('los números inválidos o negativos caen a cero', () => {
    const p = sanearProducto({
      name: 'a', mat: -5, labor: NaN, cr: Infinity,
      struct: 'hola', minP: null, idealP: undefined
    });
    for (const campo of ['mat', 'labor', 'cr', 'struct', 'minP', 'idealP']) {
      assert.equal(p[campo], 0, `${campo} debería ser 0`);
    }
  });

  test('los números se redondean a peso entero', () => {
    assert.equal(sanearProducto({ name: 'a', minP: '12.7' }).minP, 13);
  });

  test('un margen fuera de los válidos cae al 50%', () => {
    assert.equal(sanearProducto({ name: 'a', margin: 37 }).margin, 50);
    assert.equal(sanearProducto({ name: 'a', margin: 'mucho' }).margin, 50);
    for (const m of MARGINS) {
      assert.equal(sanearProducto({ name: 'a', margin: m }).margin, m);
    }
  });

  test('un nivel de creatividad desconocido cae a "facil"', () => {
    assert.equal(sanearProducto({ name: 'a', crLvl: 'zzz' }).crLvl, 'facil');
    assert.equal(sanearProducto({ name: 'a', crLvl: 'obra' }).crLvl, 'obra');
  });

  test('los textos se recortan a su largo máximo', () => {
    const p = sanearProducto({ name: 'x'.repeat(500), desc: 'y'.repeat(500) });
    assert.equal(p.name.length, MAX_NAME_LEN);
    assert.equal(p.desc.length, MAX_DESC_LEN);
  });

  test('un emoji largo se recorta a dos símbolos', () => {
    // Se cuenta por code points: los emoji ocupan más de una unidad UTF-16.
    assert.equal(sanearProducto({ name: 'a', emoji: '🎨🧶🧼🕯️' }).emoji, '🎨🧶');
  });

  describe('respaldos de versiones antiguas', () => {
    test('un respaldo v1 sin desc ni emoji no pierde el producto', () => {
      const p = sanearProducto({ name: 'Jabón de coco', mat: 1000 });
      assert.equal(p.desc, '', 'la descripción queda vacía');
      assert.equal(p.emoji, '🧼', 'el icono se infiere del nombre');
      assert.equal(p.mat, 1000, 'lo que sí venía se conserva');
    });

    test('sin addedAt se usa el id, que es la fecha de creación', () => {
      const p = sanearProducto({ name: 'a', id: 1234 });
      assert.equal(p.addedAt, 1234);
    });

    test('con addedAt propio se respeta', () => {
      const p = sanearProducto({ name: 'a', id: 1234, addedAt: 9999 });
      assert.equal(p.addedAt, 9999);
    });

    test('un id inválido se reemplaza por uno nuevo y válido', () => {
      for (const malo of [0, -1, 'abc', null]) {
        const p = sanearProducto({ name: 'a', id: malo });
        assert.ok(Number.isFinite(p.id) && p.id > 0, `id ${JSON.stringify(malo)} → ${p.id}`);
      }
    });
  });
});

describe('loadProducts — lo que se lee del almacenamiento', () => {
  const guardar = valor => app.almacen.set(KEY_PRODUCTS, JSON.stringify(valor));

  test('sin nada guardado devuelve una lista vacía', () => {
    assert.deepEqual(plano(cargarProductos()), []);
  });

  test('un JSON corrupto no revienta el arranque', () => {
    app.almacen.set(KEY_PRODUCTS, '{esto no es json');
    assert.deepEqual(plano(cargarProductos()), []);
  });

  test('lo que no es un array se descarta entero', () => {
    guardar({ productos: 'no soy un array' });
    assert.deepEqual(plano(cargarProductos()), []);
  });

  test('los productos inválidos se saltan y los válidos se conservan', () => {
    guardar([{ name: 'Bueno' }, null, 'basura', { sinNombre: 1 }, { name: 'También bueno' }]);
    const out = plano(cargarProductos());
    assert.equal(out.length, 2);
    assert.deepEqual(out.map(p => p.name), ['Bueno', 'También bueno']);
  });

  test('los ids repetidos de un respaldo viejo se reparan al entrar', () => {
    // Con ids repetidos, find() y filter() editan o borran el producto
    // equivocado: la creadora pulsa "eliminar" en uno y desaparece otro.
    guardar([
      { name: 'A', id: 777 },
      { name: 'B', id: 777 },
      { name: 'C', id: 777 }
    ]);
    const ids = plano(cargarProductos()).map(p => p.id);
    assert.equal(new Set(ids).size, 3, `ids repetidos: ${ids.join(', ')}`);
  });
});

describe('nextProductId — ids que no chocan', () => {
  test('no devuelve un id ya tomado', () => {
    const ahora = Date.now();
    const tomados = new Set([ahora, ahora + 1, ahora + 2]);
    const nuevo = siguienteId(tomados);
    assert.ok(!tomados.has(nuevo), `${nuevo} ya estaba tomado`);
  });

  test('sin argumento mira los productos vivos del estado', () => {
    const ahora = Date.now();
    app.S.products = [{ id: ahora }, { id: ahora + 1 }];
    const nuevo = siguienteId();
    assert.ok(nuevo !== ahora && nuevo !== ahora + 1);
  });
});

describe('sanitizeRateProfile — el asistente de valor hora', () => {
  test('la basura y los perfiles sin valor hora se descartan', () => {
    for (const malo of [null, 'x', 42, {}, { inputs: {} }, { rate: 0 }, { rate: -5 }]) {
      assert.equal(sanearRate(malo), null, `sanearRate(${JSON.stringify(malo)})`);
    }
  });

  test('un perfil mínimo se completa con los valores de referencia', () => {
    const r = sanearRate({ rate: 5000 });
    assert.equal(r.rate, 5000);
    assert.equal(r.inputs.mode, 'gastos');
    assert.equal(r.inputs.share, app.get('RATE_DEFAULTS').share);
    assert.ok(Object.keys(r.inputs.gastos).length > 0);
  });

  test('los valores de lista cerrada rechazan lo que no está en la lista', () => {
    assert.equal(sanearRate({ rate: 5000, inputs: { share: 77 } }).inputs.share, 50);
    assert.equal(sanearRate({ rate: 5000, inputs: { focus: 99 } }).inputs.focus, 65);
    assert.equal(sanearRate({ rate: 5000, inputs: { share: 30 } }).inputs.share, 30);
  });

  test('los rangos numéricos se recortan a sus topes', () => {
    const alto = sanearRate({ rate: 5000, inputs: { days: 99, hoursDay: 99, tax: 999 } });
    assert.equal(alto.inputs.days, 7, 'no hay más de 7 días en una semana');
    assert.equal(alto.inputs.hoursDay, 16);
    assert.equal(alto.inputs.tax, 60);

    const bajo = sanearRate({ rate: 5000, inputs: { days: 0, hoursDay: 0 } });
    assert.equal(bajo.inputs.days, 1);
    assert.equal(bajo.inputs.hoursDay, 0.5);
  });

  test('el valor hora se redondea a peso entero', () => {
    assert.equal(sanearRate({ rate: 5000.7 }).rate, 5001);
  });
});

describe('sanitizeFixedProfile — el asistente de costos fijos', () => {
  test('la basura se descarta', () => {
    for (const malo of [null, 'x', {}, { fixed: -1 }]) {
      assert.equal(sanearFixed(malo), null, `sanearFixed(${JSON.stringify(malo)})`);
    }
  });

  test('cero costos fijos es un perfil válido, no una ausencia', () => {
    // Quien trabaja sin gastos fijos tiene derecho a guardar ese cero.
    const f = sanearFixed({ fixed: 0 });
    assert.notEqual(f, null);
    assert.equal(f.fixed, 0);
  });

  test('las unidades mensuales nunca bajan de 1', () => {
    // Es el divisor del prorrateo: un 0 aquí sería Infinity en el precio.
    // Un 0 se sube al mínimo; un negativo o un texto ni siquiera se consideran
    // un número y caen al valor de referencia. Los dos caminos son seguros.
    assert.equal(sanearFixed({ fixed: 1, inputs: { units: 0 } }).inputs.units, 1);
    for (const malo of [-50, 'abc', NaN, {}, [], undefined]) {
      const u = sanearFixed({ fixed: 1, inputs: { units: malo } }).inputs.units;
      assert.ok(u >= 1, `units=${JSON.stringify(malo)} dio ${u}`);
    }
  });

  test('las unidades tienen tope superior', () => {
    assert.equal(sanearFixed({ fixed: 1, inputs: { units: 999999 } }).inputs.units, 100000);
  });

  test('los años de vida de las herramientas quedan entre 1 y 20', () => {
    assert.equal(sanearFixed({ fixed: 1, inputs: { toolsYears: 0 } }).inputs.toolsYears, 1);
    assert.equal(sanearFixed({ fixed: 1, inputs: { toolsYears: 99 } }).inputs.toolsYears, 20);
  });

  test('el porcentaje de la casa solo acepta los valores ofrecidos', () => {
    assert.equal(sanearFixed({ fixed: 1, inputs: { share: 77 } }).inputs.share, 15);
    assert.equal(sanearFixed({ fixed: 1, inputs: { share: 25 } }).inputs.share, 25);
  });
});

describe('studioSanitizeBrand — el perfil de marca', () => {
  test('la basura se descarta', () => {
    for (const malo of [null, 'x', 42]) {
      assert.equal(sanearMarca(malo), null);
    }
  });

  test('una marca vieja con priceMode "ideal" migra a "iva"', () => {
    assert.equal(sanearMarca({ name: 'x', priceMode: 'ideal' }).priceMode, 'iva');
  });

  test('un modo de precio desconocido cae al de por defecto', () => {
    assert.equal(sanearMarca({ name: 'x', priceMode: 'inventado' }).priceMode, MARCA_DEFECTO.priceMode);
  });

  test('un acento que no es hex de 6 dígitos cae al de por defecto', () => {
    for (const malo of ['rojo', '#FFF', '#GGGGGG', 42, null]) {
      assert.equal(sanearMarca({ name: 'x', accent: malo }).accent, MARCA_DEFECTO.accent);
    }
    assert.equal(sanearMarca({ name: 'x', accent: '#ff6b6b' }).accent, '#FF6B6B', 'se normaliza a mayúsculas');
  });

  test('el @ del usuario se limpia de arrobas y caracteres raros', () => {
    assert.equal(sanearMarca({ name: 'x', handle: '@@vivi.loaiza' }).handle, 'vivi.loaiza');
    assert.equal(sanearMarca({ name: 'x', handle: 'vi vi/<script>' }).handle, 'viviscript');
  });

  test('un logo que no sea un data URL de imagen se descarta', () => {
    // Esto puede venir de un respaldo recibido por WhatsApp: una URL remota
    // filtraría que la creadora abrió el archivo, y un javascript: es peor.
    for (const malo of [
      'https://ejemplo.com/logo.png',
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/svg+xml;base64,PHN2Zz4='
    ]) {
      assert.equal(sanearMarca({ name: 'x', logo: malo }).logo, '', `logo: ${malo}`);
    }
  });

  test('un data URL de imagen legítimo se conserva', () => {
    const bueno = 'data:image/png;base64,iVBORw0KGgo=';
    assert.equal(sanearMarca({ name: 'x', logo: bueno }).logo, bueno);
  });

  test('un logo enorme se descarta en vez de reventar la cuota', () => {
    const gigante = 'data:image/png;base64,' + 'A'.repeat(app.get('STUDIO_LOGO_MAX_STORED'));
    assert.equal(sanearMarca({ name: 'x', logo: gigante }).logo, '');
  });
});

describe('getBackupState — el recordatorio de respaldo', () => {
  test('sin productos no hay nada que recordar', () => {
    assert.equal(estadoRespaldo(), null);
  });

  test('con todo respaldado tampoco molesta', () => {
    const ayer = Date.now() - DIA;
    app.S.products = [{ id: ayer, addedAt: ayer, name: 'a' }];
    app.almacen.set(KEY_BACKUP, String(Date.now()));
    assert.equal(estadoRespaldo(), null);
  });

  test('cuenta solo los productos posteriores al último respaldo', () => {
    const respaldo = Date.now() - 10 * DIA;
    app.S.products = [
      { id: respaldo - DIA, addedAt: respaldo - DIA, name: 'viejo' },
      { id: Date.now(), addedAt: Date.now(), name: 'nuevo 1' },
      { id: Date.now(), addedAt: Date.now(), name: 'nuevo 2' }
    ];
    app.almacen.set(KEY_BACKUP, String(respaldo));
    const estado = estadoRespaldo();
    assert.equal(estado.newCount, 2);
    assert.equal(estado.hasBackup, true);
    assert.equal(estado.days, 10);
  });

  test('sin respaldo previo no calcula días', () => {
    app.S.products = [{ id: Date.now(), addedAt: Date.now(), name: 'a' }];
    const estado = estadoRespaldo();
    assert.equal(estado.hasBackup, false);
    assert.equal(estado.days, null);
  });

  test('mira addedAt y no el id: un producto importado también cuenta', () => {
    // Un producto importado conserva el id (y por tanto la fecha) del teléfono
    // de origen. Por id nunca contaría como pendiente — justo cuando la
    // creadora acaba de mudarse de teléfono y más necesita respaldar.
    const respaldo = Date.now() - DIA;
    app.almacen.set(KEY_BACKUP, String(respaldo));
    app.S.products = [{ id: respaldo - 365 * DIA, addedAt: Date.now(), name: 'importado hoy' }];
    assert.equal(estadoRespaldo().newCount, 1);
  });

  test('un almacenamiento bloqueado no tumba la pantalla de inicio', () => {
    // Safari en modo privado lanza al leer localStorage. Esto corre dentro de
    // renderHome(): sin el try/catch el inicio se quedaría a medio pintar.
    app.S.products = [{ id: Date.now(), addedAt: Date.now(), name: 'a' }];
    app.control.lanzaAlLeer = true;
    assert.doesNotThrow(() => estadoRespaldo());
    assert.equal(estadoRespaldo().hasBackup, false);
  });
});
