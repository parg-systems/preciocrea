// El mensaje de WhatsApp: lo único de la app que sale escrito hacia un cliente.
//
// shareWhatsApp() arma un texto y lo abre en wa.me. No hay pantalla que revisar
// después: lo que se genere mal viaja tal cual al teléfono de quien va a pagar.
// Los dos riesgos concretos son un precio equivocado y un formato descuidado —
// espacios sueltos o líneas en blanco de más cuando el producto no tiene emoji
// o no tiene descripción, que son justamente las dos ramas condicionales.

'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp } = require('./helpers/load.js');

const app = cargarApp();
const shareWhatsApp = app.get('shareWhatsApp');
const fmt = app.get('fmt');
const IVA = app.get('IVA');

// El producto de la regresión documentada: idealP $42.243.
const PRODUCTO = {
  id: 1,
  name: 'Jabón de lavanda',
  emoji: '🧼',
  desc: 'Hecho a mano con aceite de oliva',
  idealP: 42243,
  minP: 28162
};

// Devuelve el cuerpo del mensaje ya decodificado, tal como lo verá el cliente.
function mensajeDe(apertura) {
  const url = new URL(apertura.url);
  return url.searchParams.get('text');
}

beforeEach(() => {
  app.resetear();
});

describe('shareWhatsApp — el enlace', () => {
  test('abre wa.me en una pestaña nueva y sin traspasar la sesión', () => {
    app.S.products = [{ ...PRODUCTO }];
    shareWhatsApp(1);

    assert.equal(app.aperturas.length, 1, 'debía abrir exactamente una pestaña');
    const { url, destino, opciones } = app.aperturas[0];
    assert.ok(url.startsWith('https://wa.me/?text='), url);
    assert.equal(destino, '_blank');
    // noopener/noreferrer: sin ellos la pestaña de WhatsApp puede alcanzar la
    // ventana de la app por window.opener.
    assert.match(opciones, /noopener/);
    assert.match(opciones, /noreferrer/);
  });

  test('un id que no existe no hace nada, en vez de reventar', () => {
    app.S.products = [{ ...PRODUCTO }];
    assert.doesNotThrow(() => shareWhatsApp(999));
    assert.equal(app.aperturas.length, 0);
  });

  test('sin productos tampoco revienta', () => {
    assert.doesNotThrow(() => shareWhatsApp(1));
    assert.equal(app.aperturas.length, 0);
  });
});

describe('shareWhatsApp — el cuerpo del mensaje', () => {
  test('lleva el nombre, el precio ideal y el precio con IVA', () => {
    app.S.products = [{ ...PRODUCTO }];
    shareWhatsApp(1);
    const texto = mensajeDe(app.aperturas[0]);

    assert.match(texto, /Jabón de lavanda/);
    assert.match(texto, /\$42\.243/, 'el precio ideal, con separador de miles');
    assert.match(texto, /\$50\.269/, 'el mismo precio con IVA (42243 × 1,19)');
  });

  test('el precio con IVA se calcula, no se copia', () => {
    // Si alguien "simplificara" la línea del IVA reusando idealP, este test cae.
    app.S.products = [{ ...PRODUCTO, idealP: 10000 }];
    shareWhatsApp(1);
    const texto = mensajeDe(app.aperturas[0]);

    assert.match(texto, new RegExp(fmt(10000).replace(/\$/g, '\\$')));
    assert.match(texto, new RegExp(fmt(10000 * (1 + IVA)).replace(/\$/g, '\\$')));
  });

  test('el nombre va en negrita de WhatsApp (entre asteriscos)', () => {
    app.S.products = [{ ...PRODUCTO }];
    shareWhatsApp(1);
    assert.match(mensajeDe(app.aperturas[0]), /\*Jabón de lavanda\*/);
  });

  test('la descripción aparece cuando existe', () => {
    app.S.products = [{ ...PRODUCTO }];
    const texto = mensajeDe((shareWhatsApp(1), app.aperturas[0]));
    assert.match(texto, /Hecho a mano con aceite de oliva/);
  });
});

describe('shareWhatsApp — las dos ramas que ensucian el formato', () => {
  test('sin emoji no queda un espacio colgando al final de la primera línea', () => {
    app.S.products = [{ ...PRODUCTO, emoji: '' }];
    shareWhatsApp(1);
    const linea = mensajeDe(app.aperturas[0]).split('\n')[0];

    assert.equal(linea, linea.trimEnd(), `la línea termina en espacio: ${JSON.stringify(linea)}`);
    assert.ok(linea.endsWith('*'), 'debe cerrar en el asterisco del nombre');
  });

  test('con emoji va pegado un solo espacio, no dos', () => {
    app.S.products = [{ ...PRODUCTO }];
    shareWhatsApp(1);
    const linea = mensajeDe(app.aperturas[0]).split('\n')[0];
    assert.ok(linea.endsWith('* 🧼'), linea);
  });

  test('sin descripción no quedan líneas en blanco de más', () => {
    app.S.products = [{ ...PRODUCTO, desc: '' }];
    shareWhatsApp(1);
    const texto = mensajeDe(app.aperturas[0]);

    assert.ok(!/\n\n\n/.test(texto), 'tres saltos seguidos = un hueco visible');
    const conDesc = (() => {
      app.aperturas.length = 0;
      app.S.products = [{ ...PRODUCTO }];
      shareWhatsApp(1);
      return mensajeDe(app.aperturas[0]);
    })();
    assert.equal(
      texto.split('\n').length + 2, conDesc.split('\n').length,
      'la descripción aporta exactamente dos líneas: la vacía y la suya'
    );
  });

  test('ni emoji ni descripción: el mensaje sigue bien formado', () => {
    app.S.products = [{ ...PRODUCTO, emoji: '', desc: '' }];
    shareWhatsApp(1);
    const lineas = mensajeDe(app.aperturas[0]).split('\n');

    assert.ok(!/\n\n\n/.test(lineas.join('\n')));
    assert.equal(lineas[0], 'Hola! Te paso la cotización de *Jabón de lavanda*');
    assert.equal(lineas.at(-1), '¡Gracias por confiar en mi trabajo! 💛');
  });
});

describe('shareWhatsApp — nombres que podrían romper el formato', () => {
  test('un nombre con asterisco no descuadra la negrita del resto', () => {
    app.S.products = [{ ...PRODUCTO, name: 'Set *especial*' }];
    shareWhatsApp(1);
    const texto = mensajeDe(app.aperturas[0]);

    // Se documenta el comportamiento real: el nombre viaja tal cual. WhatsApp
    // interpretará esos asteriscos, pero el resto del mensaje (precio, cierre)
    // llega intacto, que es lo que importa.
    assert.match(texto, /Set \*especial\*/);
    assert.match(texto, /\$42\.243/);
    assert.match(texto, /¡Gracias por confiar en mi trabajo!/);
  });

  test('un salto de línea dentro del nombre no parte el mensaje', () => {
    app.S.products = [{ ...PRODUCTO, name: 'Jabón\nde lavanda' }];
    shareWhatsApp(1);
    const texto = mensajeDe(app.aperturas[0]);

    assert.match(texto, /\$42\.243/);
    assert.match(texto, /🧾 Con IVA/);
  });

  test('todo se codifica para la URL: el texto crudo no viaja suelto', () => {
    app.S.products = [{ ...PRODUCTO, name: 'Set & Co #1' }];
    shareWhatsApp(1);
    const bruto = app.aperturas[0].url;

    assert.ok(!bruto.includes('&amp'), bruto);
    assert.ok(!bruto.includes(' '), 'un espacio sin codificar corta la URL');
    assert.ok(!bruto.includes('#'), 'un # sin codificar trunca el mensaje entero');
    assert.match(mensajeDe(app.aperturas[0]), /Set & Co #1/);
  });
});
