// Parseo y formato de números en español de Chile.
//
// Aquí ya hubo dos errores históricos, ambos documentados en los comentarios
// del propio código: parseFloat("12.000") daba 12 (doce pesos en vez de doce
// mil) y el separador decimal con coma ("2,5" horas) se leía como 0. Son
// errores silenciosos: la app no falla, solo entrega un precio equivocado.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp } = require('./helpers/load.js');

const app = cargarApp();
const parseMonto = app.get('parseMonto');
const parseHoras = app.get('parseHoras');
const fmt = app.get('fmt');
const fmtShort = app.get('fmtShort');
const normalizar = app.get('normalizar');
const getEmoji = app.get('getEmoji');
const MAX_INPUT_NUM = app.get('MAX_INPUT_NUM');

describe('parseMonto — dinero en pesos, siempre entero', () => {
  test('el punto es separador de miles, no decimal', () => {
    assert.equal(parseMonto('12.000'), 12000, '"12.000" son doce mil pesos');
  });

  test('la coma también es separador de miles', () => {
    assert.equal(parseMonto('12,000'), 12000);
  });

  test('ignora el signo peso y los espacios', () => {
    assert.equal(parseMonto('$1.234'), 1234);
    assert.equal(parseMonto(' 1 2 3 '), 123);
  });

  test('lo que no es número vale cero', () => {
    for (const v of ['', 'abc', null, undefined, '   ']) {
      assert.equal(parseMonto(v), 0, `parseMonto(${JSON.stringify(v)})`);
    }
  });

  test('el signo menos se descarta: un costo negativo no existe', () => {
    // Comportamiento real: solo se conservan los dígitos, así que "-5" es 5.
    assert.equal(parseMonto('-5'), 5);
  });

  test('respeta el tope de cien millones', () => {
    assert.equal(parseMonto('999999999999'), MAX_INPUT_NUM);
    assert.equal(parseMonto('1'.repeat(20)), MAX_INPUT_NUM);
  });
});

describe('parseHoras — decimales con coma o punto', () => {
  test('acepta la coma decimal de es-CL', () => {
    assert.equal(parseHoras('2,5'), 2.5);
  });

  test('acepta también el punto decimal', () => {
    assert.equal(parseHoras('2.5'), 2.5);
  });

  test('tolera espacios alrededor', () => {
    assert.equal(parseHoras(' 3 '), 3);
  });

  test('lo inválido y lo negativo valen cero', () => {
    for (const v of ['-1', 'abc', '', null, undefined, 'Infinity']) {
      assert.equal(parseHoras(v), 0, `parseHoras(${JSON.stringify(v)})`);
    }
  });

  test('conserva fracciones pequeñas', () => {
    assert.equal(parseHoras('0.001'), 0.001);
  });

  test('respeta el tope', () => {
    assert.equal(parseHoras('99999999999'), MAX_INPUT_NUM);
  });
});

describe('fmt — el precio como lo ve la creadora', () => {
  test('redondea a peso entero y separa miles con punto', () => {
    assert.equal(fmt(28162.1666), '$28.162');
    assert.equal(fmt(1234567), '$1.234.567');
  });

  test('redondea hacia arriba desde .5', () => {
    assert.equal(fmt(999.6), '$1.000');
  });

  test('cero se muestra como $0', () => {
    assert.equal(fmt(0), '$0');
  });

  test('un negativo pone el signo después del peso', () => {
    // No debería ocurrir en la app (ningún precio es negativo), pero se fija
    // el comportamiento para que un cambio de formato no pase inadvertido.
    assert.equal(fmt(-500), '$-500');
  });
});

describe('fmtShort — abreviatura de las barras del desglose', () => {
  test('bajo mil se muestra el número redondeado', () => {
    assert.equal(fmtShort(0), '$0');
    assert.equal(fmtShort(999), '$999');
  });

  test('desde mil se abrevia con K', () => {
    assert.equal(fmtShort(1000), '$1K');
    assert.equal(fmtShort(1499), '$1K');
    assert.equal(fmtShort(1500), '$2K');
  });

  test('desde un millón se abrevia con M y un decimal', () => {
    assert.equal(fmtShort(1000000), '$1.0M');
    assert.equal(fmtShort(1500000), '$1.5M');
    assert.equal(fmtShort(2340000), '$2.3M');
  });

  test('justo bajo el millón sigue en K: $1000K, no $1.0M', () => {
    // Rareza conocida del umbral (>= 1000000). Se fija para que quede
    // registrada: si algún día se corrige, este test lo dirá.
    assert.equal(fmtShort(999999), '$1000K');
  });
});

describe('normalizar — el buscador ignora acentos y mayúsculas', () => {
  test('quien busca "jabon" encuentra "Jabón"', () => {
    assert.equal(normalizar('Jabón'), 'jabon');
    assert.ok(normalizar('Jabón de lavanda').includes('jabon'));
  });

  test('la eñe se descompone igual', () => {
    assert.equal(normalizar('ÑOÑO'), 'nono');
  });

  test('no recorta espacios: eso es cosa de quien llama', () => {
    assert.equal(normalizar('  Ácido  '), '  acido  ');
  });

  test('null y números no revientan', () => {
    assert.equal(normalizar(null), '');
    assert.equal(normalizar(undefined), '');
    assert.equal(normalizar(123), '123');
  });
});

describe('getEmoji — icono sugerido desde el nombre', () => {
  const casos = [
    ['Jabón de lavanda', '🧼'],
    ['jabon artesanal', '🧼'],
    ['Aros de resina', '💎'],
    ['Anillo de plata', '💍'],
    ['Vela de soya', '🕯️'],
    ['Gorro a crochet', '🧶'],
    ['Taza pintada', '☕'],
    ['Collar de mostacillas', '📿']
  ];

  for (const [nombre, emoji] of casos) {
    test(`"${nombre}" sugiere ${emoji}`, () => {
      assert.equal(getEmoji(nombre), emoji);
    });
  }

  test('lo desconocido cae en la paleta', () => {
    assert.equal(getEmoji('cosa rara'), '🎨');
    assert.equal(getEmoji(''), '🎨');
    assert.equal(getEmoji(null), '🎨');
  });
});
