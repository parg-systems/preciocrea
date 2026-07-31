// Los dos asistentes: valor hora y costos fijos.
//
// Son la parte de la app donde una creadora decide cuánto vale su trabajo, y
// hasta ahora eran el único hueco grande de la tanda: leen y escriben el DOM
// directamente por getElementById, así que sin un documento de verdad no se
// podían tocar. De ahí el arnés con jsdom (tests/helpers/dom-real.js).
//
// Los cuatro números de referencia son los mismos que docs/QA_CHECKLIST.md
// pedía verificar a mano en cada entrega. Aquí corren solos.

'use strict';

const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarAppReal } = require('./helpers/dom-real.js');

const app = cargarAppReal();
const S = app.get('S');
const RATE_DEFAULTS = app.get('RATE_DEFAULTS');
const FIXED_DEFAULTS = app.get('FIXED_DEFAULTS');
const RATE_MIN_HORA = app.get('RATE_MIN_HORA');
const renderRate = app.get('renderRateWizard');
const renderFixed = app.get('renderFixedWizard');
const rateRecalc = app.get('rateRecalc');
const fixedRecalc = app.get('fixedRecalc');
const copia = o => JSON.parse(JSON.stringify(o));

// Deja el asistente de valor hora en sus respuestas por defecto y lo repinta.
function rateCon(cambios = {}) {
  S.rateDraft = Object.assign(copia(RATE_DEFAULTS), cambios);
  renderRate();
  return S.rateDraft;
}

function fixedCon(cambios = {}) {
  S.fixedDraft = Object.assign(copia(FIXED_DEFAULTS), cambios);
  renderFixed();
  return S.fixedDraft;
}

describe('el arnés con DOM real', () => {
  test('index.html, app.js y studio.js cargan sin errores', () => {
    assert.deepEqual(app.errores.map(e => e.archivo), []);
  });

  test('los ids que usan los asistentes existen en index.html', () => {
    // Si alguien renombra un id en el HTML y no en el JS, el asistente deja de
    // recalcular en silencio: los campos se ven, el número no se mueve.
    const ids = [
      'rate-meta-directa', 'rate-hours-day', 'rate-tax-on', 'rate-tax',
      'rate-gastos', 'rate-directo', 'rate-tax-wrap', 'rate-hogar', 'rate-meta',
      'rate-month-hours', 'rate-billable', 'rate-value', 'rate-formula',
      'rate-floor-note', 'rate-floor-hd', 'rate-floor-txt', 'rate-rows',
      'fixed-tools-value', 'fixed-tools-years', 'fixed-units',
      'fixed-home-total', 'fixed-biz-total', 'fixed-tools-total',
      'fixed-value', 'fixed-formula', 'fixed-note'
    ];
    const faltan = ids.filter(id => !app.$(id));
    assert.deepEqual(faltan, [], `ids que el JS busca y el HTML no tiene: ${faltan}`);
  });
});

describe('valor hora — los cuatro casos del checklist', () => {
  test('con las respuestas por defecto: $8.300', () => {
    rateCon();
    assert.equal(app.texto('rate-value'), '$8.300');
  });

  test('con el negocio cubriendo el 100% del hogar: $16.500', () => {
    rateCon({ share: 100 });
    assert.equal(app.texto('rate-value'), '$16.500');
  });

  test('trabajando 3 días a la semana: $13.800', () => {
    // Menos horas cobrables para la misma meta: la hora vale más.
    rateCon({ days: 3 });
    assert.equal(app.texto('rate-value'), '$13.800');
  });

  test('sin guardar para cotizaciones: $6.900', () => {
    rateCon({ taxOn: false });
    assert.equal(app.texto('rate-value'), '$6.900');
  });
});

describe('valor hora — el desglose que se muestra', () => {
  beforeEach(() => rateCon());

  test('el gasto del hogar suma las seis referencias', () => {
    assert.equal(app.texto('rate-hogar'), '$1.170.000');
  });

  test('la meta es el porcentaje elegido de ese gasto', () => {
    assert.equal(app.texto('rate-meta'), '$585.000');
  });

  test('las horas del mes y las cobrables', () => {
    assert.equal(app.texto('rate-month-hours'), '130');
    assert.equal(app.texto('rate-billable'), '85');
  });

  test('la fórmula que se lee en pantalla nombra el impuesto', () => {
    assert.equal(app.texto('rate-formula'), '$585.000 + 20% ÷ 85 horas cobrables');
  });

  test('sin impuesto, la fórmula no lo menciona', () => {
    rateCon({ taxOn: false });
    assert.equal(app.texto('rate-formula'), '$585.000 ÷ 85 horas cobrables');
  });
});

describe('valor hora — lo que se muestra es lo que se usa', () => {
  test('las horas cobrables se redondean ANTES de dividir', () => {
    // 130 × 65% = 84,5. Si por dentro dividiera entre 84,5 y en pantalla
    // dijera 85, quien rehiciera la cuenta a mano no llegaría al mismo número
    // y dejaría de fiarse de la app. Se comprueba rehaciéndola.
    rateCon();
    const cobrables = Number(app.texto('rate-billable'));
    const meta = 585000 * 1.20;
    const aMano = Math.round(meta / cobrables / 100) * 100;

    assert.equal(cobrables, 85);
    assert.equal(app.texto('rate-value'), `$${aMano.toLocaleString('es-CL')}`);
  });

  test('el valor hora se redondea a la centena: nadie cobra $8.327', () => {
    for (const cambios of [{}, { share: 100 }, { days: 3 }, { focus: 80 }, { tax: 35 }]) {
      rateCon(cambios);
      const valor = Number(app.texto('rate-value').replace(/\D/g, ''));
      assert.equal(valor % 100, 0, `${JSON.stringify(cambios)} → ${valor}`);
    }
  });

  test('el modo directo ignora los gastos y usa la meta escrita', () => {
    rateCon({ mode: 'directo', metaDirecta: 800000 });
    assert.equal(app.texto('rate-meta'), '$800.000');
    // 800.000 + 20% ÷ 85 = 11.294 → $11.300
    assert.equal(app.texto('rate-value'), '$11.300');
  });

  test('cada modo muestra su bloque y esconde el otro', () => {
    rateCon({ mode: 'gastos' });
    assert.equal(app.$('rate-gastos').hidden, false);
    assert.equal(app.$('rate-directo').hidden, true);

    rateCon({ mode: 'directo' });
    assert.equal(app.$('rate-gastos').hidden, true);
    assert.equal(app.$('rate-directo').hidden, false);
  });

  test('el campo del impuesto solo aparece si está activado', () => {
    rateCon({ taxOn: true });
    assert.equal(app.$('rate-tax-wrap').hidden, false);
    rateCon({ taxOn: false });
    assert.equal(app.$('rate-tax-wrap').hidden, true);
  });
});

describe('valor hora — sin datos suficientes', () => {
  test('sin horas al día no divide por cero: el valor queda en $0', () => {
    rateCon({ hoursDay: 0 });
    assert.equal(app.texto('rate-value'), '$0');
    assert.equal(app.texto('rate-billable'), '0');
  });

  test('y en vez de una fórmula imposible, pide el dato que falta', () => {
    rateCon({ hoursDay: 0 });
    assert.equal(app.texto('rate-formula'), 'Dinos cuántas horas puedes dedicarle');
  });

  test('sin ningún gasto declarado tampoco revienta', () => {
    rateCon({ gastos: {} });
    assert.equal(app.texto('rate-hogar'), '$0');
    assert.equal(app.texto('rate-value'), '$0');
  });
});

describe('reflejarRecorte — el campo visible se corrige solo', () => {
  test('más de 16 horas al día se recorta, y el campo lo muestra', () => {
    // Si el número se recortara solo por dentro, la creadora vería "20" en la
    // pantalla y un cálculo hecho con 16: dos verdades distintas a la vez.
    rateCon();
    app.escribir('rate-hours-day', '20');
    rateRecalc();

    assert.equal(app.valor('rate-hours-day'), '16');
    assert.equal(S.rateDraft.hoursDay, 16);
  });

  test('un impuesto mayor que 60% se recorta igual', () => {
    rateCon();
    app.escribir('rate-tax', '90');
    rateRecalc();

    assert.equal(app.valor('rate-tax'), '60');
    assert.equal(S.rateDraft.tax, 60);
  });

  test('un valor dentro de rango NO se pisa: se respeta lo tecleado', () => {
    rateCon();
    app.escribir('rate-hours-day', '8');
    rateRecalc();

    assert.equal(app.valor('rate-hours-day'), '8', 'no debía reescribir el campo');
    assert.equal(S.rateDraft.hoursDay, 8);
  });

  test('las horas con coma decimal se entienden', () => {
    rateCon();
    app.escribir('rate-hours-day', '7,5');
    rateRecalc();

    assert.equal(S.rateDraft.hoursDay, 7.5);
  });
});

describe('pintarPisoLegal — el aviso más importante de la pantalla', () => {
  test('el piso legal por hora son $2.747', () => {
    // Ingreso mínimo $500.000 ÷ (42 h × 4,33 semanas). Si cambia la ley, este
    // test cae y recuerda que hay dos textos en index.html que también citan
    // el número a mano.
    assert.equal(RATE_MIN_HORA, 2747);
  });

  test('sin datos: aviso azul pidiendo completar', () => {
    rateCon({ hoursDay: 0 });
    assert.match(app.$('rate-floor-note').className, /note-card-blue/);
    assert.match(app.texto('rate-floor-hd'), /Falta un dato/);
  });

  test('bajo el piso legal: aviso rojo', () => {
    // Una meta mínima repartida en muchas horas deja la hora por el suelo.
    rateCon({ mode: 'directo', metaDirecta: 50000, taxOn: false });
    const valor = Number(app.texto('rate-value').replace(/\D/g, ''));

    assert.ok(valor < RATE_MIN_HORA, `el escenario debía quedar bajo el piso: ${valor}`);
    assert.match(app.$('rate-floor-note').className, /note-card-red/);
  });

  test('sobre el piso legal: aviso verde', () => {
    rateCon();
    assert.match(app.$('rate-floor-note').className, /note-card-green/);
  });

  test('el aviso nombra el piso legal, no un número inventado', () => {
    rateCon();
    assert.match(app.texto('rate-floor-txt') + app.texto('rate-floor-hd'), /2\.747/);
  });
});

describe('costos fijos — los números por defecto', () => {
  beforeEach(() => fixedCon());

  test('la parte de la casa: 15% de $570.000 = $85.500', () => {
    assert.equal(app.texto('fixed-home-total'), '$85.500');
  });

  test('los gastos propios del negocio: $32.500', () => {
    assert.equal(app.texto('fixed-biz-total'), '$32.500');
  });

  test('las herramientas: $250.000 repartidos en 36 meses = $6.944', () => {
    assert.equal(app.texto('fixed-tools-total'), '$6.944');
  });

  test('el total mensual: $124.944', () => {
    assert.equal(app.texto('fixed-value'), '$124.944');
  });

  test('repartido entre 30 unidades, cada producto carga $4.165', () => {
    assert.match(app.$('fixed-note').innerHTML, /\$4\.165/);
    assert.match(app.$('fixed-note').innerHTML, /30 unidades/);
  });

  test('la fórmula nombra los tres bloques', () => {
    assert.equal(app.texto('fixed-formula'),
      '$85.500 de tu casa + $32.500 del negocio + $6.944 de herramientas');
  });
});

describe('costos fijos — el reparto del arriendo', () => {
  test('«Taller aparte» (0%) deja fuera el arriendo de la casa', () => {
    // Modelo confirmado: o se prorratea la casa, o se paga un taller aparte.
    // Nunca los dos a la vez.
    fixedCon({ share: 0 });
    assert.equal(app.texto('fixed-home-total'), '$0');
  });

  test('el porcentaje se aplica solo al bloque de la casa', () => {
    fixedCon({ share: 25 });
    assert.equal(app.texto('fixed-home-total'), '$142.500');   // 25% de 570.000
    assert.equal(app.texto('fixed-biz-total'), '$32.500', 'el negocio no se prorratea');
  });
});

describe('costos fijos — las divisiones que podrían romperse', () => {
  test('cero años de vida útil no divide por cero: cae a 1', () => {
    fixedCon();
    app.escribir('fixed-tools-years', '0');
    fixedRecalc();

    assert.equal(S.fixedDraft.toolsYears, 1);
    assert.equal(app.texto('fixed-tools-total'), '$20.833');   // 250.000 / 12
  });

  test('cero unidades al mes tampoco: cae a 1', () => {
    fixedCon();
    app.escribir('fixed-units', '0');
    fixedRecalc();

    assert.equal(S.fixedDraft.units, 1);
    assert.match(app.$('fixed-note').innerHTML, /\$124\.944/, 'todo el costo en una unidad');
  });

  test('más de 20 años de vida útil se recorta, y el campo lo muestra', () => {
    fixedCon();
    app.escribir('fixed-tools-years', '50');
    fixedRecalc();

    assert.equal(app.valor('fixed-tools-years'), '20');
  });

  test('sin herramientas el bloque queda en cero, no en NaN', () => {
    fixedCon({ toolsValue: 0 });
    assert.equal(app.texto('fixed-tools-total'), '$0');
  });

  test('con todo en cero, el texto explica en vez de mostrar $0 pelado', () => {
    fixedCon({ hogar: {}, negocio: {}, toolsValue: 0 });
    assert.equal(app.texto('fixed-value'), '$0');
    assert.match(app.$('fixed-note').innerHTML, /algo te cuesta/);
  });
});

describe('costos fijos — lo que queda en el estado', () => {
  test('el total y las unidades quedan disponibles para la calculadora', () => {
    fixedCon();
    assert.equal(S.fixedValue, 124944);
    assert.equal(S.fixedUnits, 30);
  });
});
