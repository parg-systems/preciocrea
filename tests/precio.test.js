// El corazón del producto: la fórmula del precio.
//
// PrecioCrea existe para responder una sola pregunta — "¿cuánto cobro?" — y
// todo lo demás de la app es envoltorio de este cálculo. Si estos números se
// mueven sin que nadie lo note, una creadora vende bajo su costo.

'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp } = require('./helpers/load.js');

const app = cargarApp();
const calc = app.get('calc');
const fmt = app.get('fmt');
const IVA = app.get('IVA');
const CR_MULT = app.get('CR_MULT');
const MARGINS = app.get('MARGINS');

beforeEach(() => app.resetear());

describe('calc() — regresión histórica', () => {
  // Este caso viene de docs/QA_CHECKLIST.md, sección "Continuidad con la
  // 1.6.0": es el ejemplo que se verificaba a mano en cada release para
  // confirmar que un rediseño no movió la fórmula. Aquí deja de depender de
  // que alguien se acuerde de hacerlo.
  const CASO = {
    matTotal: 2170, hours: 2.5, rate: 8000,
    cr: 'moderado', fixed: 80000, units: 30, margin: 50
  };

  test('el caso documentado da $28.162 mínimo y $42.243 ideal', () => {
    app.conProducto(CASO);
    const r = calc();
    // Se afirma sobre el texto formateado, no sobre el float: es exactamente
    // lo que lee la creadora en pantalla.
    assert.equal(fmt(r.minP), '$28.162');
    assert.equal(fmt(r.idealP), '$42.243');
  });

  test('los mismos precios con IVA', () => {
    app.conProducto(CASO);
    const r = calc();
    assert.equal(fmt(r.minP * (1 + IVA)), '$33.513');
    assert.equal(fmt(r.idealP * (1 + IVA)), '$50.269');
  });

  test('el desglose componente a componente', () => {
    app.conProducto(CASO);
    const r = calc();
    assert.equal(r.mat, 2170, 'materiales');
    assert.equal(r.labor, 20000, 'mano de obra: 2,5 h × $8.000');
    assert.equal(r.cr, 3325.5, 'creatividad: 15% de (materiales + mano de obra)');
    assert.equal(r.struct, 80000 / 30, 'costos fijos prorrateados');
  });
});

describe('calc() — los cuatro niveles de creatividad', () => {
  // Sin materiales ni fijos, el recargo es un porcentaje limpio de la mano de
  // obra: así el test falla por el multiplicador y no por aritmética de otro
  // componente.
  const base = { matTotal: 0, hours: 1, rate: 10000, fixed: 0, units: 1 };

  for (const [nivel, mult] of Object.entries(CR_MULT)) {
    test(`${nivel} recarga ${mult * 100}%`, () => {
      app.conProducto({ ...base, cr: nivel });
      const r = calc();
      // Tolerancia de punto flotante: 10000 * 0.15 no es exactamente 1500 en
      // binario. Lo que se verifica es el multiplicador, no la aritmética IEEE.
      assert.ok(Math.abs(r.cr - 10000 * mult) < 1e-9, `cr = ${r.cr}`);
      assert.ok(Math.abs(r.minP - (10000 + 10000 * mult)) < 1e-9, `minP = ${r.minP}`);
    });
  }

  test('un nivel desconocido cae al 5% en vez de producir NaN', () => {
    app.conProducto({ ...base, cr: 'inventado' });
    const r = calc();
    assert.equal(r.cr, 500);
    assert.ok(Number.isFinite(r.minP));
  });
});

describe('calc() — margen de ganancia', () => {
  const base = { matTotal: 1000, hours: 0, rate: 0, cr: 'facil', fixed: 0, units: 1 };

  for (const margen of MARGINS) {
    test(`margen ${margen}% multiplica el mínimo por ${1 + margen / 100}`, () => {
      app.conProducto(base);
      const r = calc(margen);
      assert.equal(r.idealP, r.minP * (1 + margen / 100));
    });
  }

  test('sin argumento usa el margen guardado en el estado', () => {
    app.conProducto({ ...base, margin: 80 });
    assert.equal(calc().idealP, calc(80).idealP);
  });

  test('margen 0 deja el ideal igual al mínimo', () => {
    app.conProducto(base);
    const r = calc(0);
    assert.equal(r.idealP, r.minP);
  });
});

describe('calc() — entradas degeneradas', () => {
  // Dividir los costos fijos entre 0 unidades daría Infinity y la pantalla
  // mostraría "$Infinity" como precio. Math.max(units, 1) lo impide.
  for (const units of [0, -5]) {
    test(`units = ${units} no produce Infinity`, () => {
      app.conProducto({ matTotal: 0, hours: 0, rate: 0, cr: 'facil', fixed: 80000, units });
      const r = calc();
      assert.ok(Number.isFinite(r.struct), 'struct debe ser finito');
      assert.equal(r.struct, 80000, 'los fijos completos caen sobre una unidad');
    });
  }

  test('todo en cero da precio cero, no NaN', () => {
    app.conProducto({ matTotal: 0, hours: 0, rate: 0, cr: 'facil', fixed: 0, units: 1 });
    const r = calc();
    assert.equal(r.minP, 0);
    assert.equal(r.idealP, 0);
  });
});

describe('calc() — invariantes', () => {
  // Aleatorio a propósito, con semilla fija para que un fallo sea reproducible:
  // los casos escritos a mano solo cubren lo que se le ocurrió a quien los
  // escribió, y estas dos propiedades deben valer siempre.
  const semilla = () => {
    let s = 20260731;
    return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  };

  test('el mínimo es exactamente la suma de sus cuatro componentes', () => {
    const rnd = semilla();
    const niveles = Object.keys(CR_MULT);
    for (let i = 0; i < 200; i++) {
      app.conProducto({
        matTotal: Math.round(rnd() * 500000),
        hours: Math.round(rnd() * 400) / 10,
        rate: Math.round(rnd() * 50000),
        cr: niveles[Math.floor(rnd() * niveles.length)],
        fixed: Math.round(rnd() * 1000000),
        units: 1 + Math.floor(rnd() * 500)
      });
      const r = calc();
      assert.equal(r.minP, r.mat + r.labor + r.cr + r.struct);
      assert.ok(Number.isFinite(r.minP), 'el mínimo nunca es NaN ni Infinity');
    }
  });

  test('el precio ideal nunca queda bajo el mínimo', () => {
    const rnd = semilla();
    for (let i = 0; i < 200; i++) {
      app.conProducto({
        matTotal: Math.round(rnd() * 100000),
        hours: Math.round(rnd() * 100) / 10,
        rate: Math.round(rnd() * 20000),
        cr: 'moderado',
        fixed: Math.round(rnd() * 200000),
        units: 1 + Math.floor(rnd() * 100)
      });
      for (const margen of MARGINS) {
        const r = calc(margen);
        assert.ok(r.idealP >= r.minP, `margen ${margen}: ideal ${r.idealP} < mínimo ${r.minP}`);
      }
    }
  });
});

describe('IVA', () => {
  test('es el 19% vigente en Chile', () => {
    assert.equal(IVA, 0.19);
  });

  test('se aplica una sola vez sobre el precio', () => {
    app.conProducto({ matTotal: 10000, hours: 0, rate: 0, cr: 'facil', fixed: 0, units: 1 });
    const r = calc();
    assert.equal(r.minP * (1 + IVA), 12495);
  });
});
