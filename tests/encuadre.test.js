// El modo encuadre del editor de publicaciones.
//
// Por qué existe esta tanda: la vista previa mide ~346x615 px en un teléfono
// de 390, o sea el 70% de la pantalla. Mientras el canvas se quedaba con los
// gestos táctiles de forma permanente, apoyar el dedo encima —que es donde
// cae el pulgar— no desplazaba nada, y de paso movía la foto sin querer. Con
// mouse y con lápiz no se notaba: por eso el fallo sobrevivió tanto.
//
// El arreglo es un modo explícito, y lo que hay que blindar no es que se
// encienda, sino que SIEMPRE se apague solo: un modo encuadre que quedara
// pegado devolvería a la creadora exactamente a la pantalla que no se desliza.
// De ahí que la mitad de estos casos sean reseteos.
//
// Va con el arnés de DOM real y no con el de node:vm: aquí se comprueban
// classList, atributos y textContent, que en el arnés de vm son simulados y
// darían por buena cualquier cosa.

'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { cargarAppReal } = require('./helpers/dom-real.js');

const app = cargarAppReal();

// jsdom no dibuja: su getContext devuelve null y el editor muere al repintar.
// Aquí no se comprueba ni un píxel —de eso se encarga la tanda de Playwright,
// con un canvas de verdad—, así que basta con un contexto que trague todo.
function ctx2dFalso() {
  const guardado = {};
  const gradiente = { addColorStop() {} };
  const nada = () => {};
  return new Proxy(guardado, {
    get(t, k) {
      if (typeof k === 'symbol') return undefined;
      if (k in t) return t[k];
      if (k === 'measureText') return s => ({ width: String(s).length * 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => gradiente;
      return nada;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
app.window.HTMLCanvasElement.prototype.getContext = ctx2dFalso;

const S = app.get('S');
const STUDIO = app.get('STUDIO');
const openStudio = app.get('openStudio');
const setStudioSlide = app.get('setStudioSlide');
const studioDispose = app.get('studioDispose');
const studioSetPhoto = app.get('studioSetPhoto');
const renderStudioPhotoBar = app.get('renderStudioPhotoBar');
const toggleStudioFraming = app.get('toggleStudioFraming');
const studioSaveBrand = app.get('studioSaveBrand');
const ACCIONES = app.get('ACCIONES');

// Sin marca guardada, openStudio desvía al formulario y no llega a haber pieza.
const MARCA = { name: 'Vivi Loaiza', handle: 'viviloaiza.cl', accent: '#E86A92', credit: true };
Object.assign(STUDIO.brand, MARCA);
studioSaveBrand();

const PRODUCTO = {
  id: 1, addedAt: 1, name: 'Jabón de lavanda', desc: 'Aceite de oliva',
  emoji: '🧼', date: '31-07-2026',
  mat: 2170, labor: 20000, cr: 3326, struct: 2667,
  minP: 28162, idealP: 42243, margin: 50, crLvl: 'moderado'
};

// Una foto de mentira: al modo encuadre solo le importa que exista.
const fotoFalsa = () => ({ width: 1200, height: 1600 });

const $btn = () => app.$('studio-frame-btn');
const $hint = () => app.$('studio-frame-hint');
const stage = () => app.document.querySelector('.studio-stage');
const bloqueada = () => !!(stage() && stage().classList.contains('encuadrando'));

// Abre el editor con la historia del producto y le pone foto a la lámina activa.
function editorConFoto() {
  S.products = [JSON.parse(JSON.stringify(PRODUCTO))];
  openStudio('historia', 1);
  studioSetPhoto(STUDIO.piece.slides[STUDIO.piece.active], fotoFalsa());
  renderStudioPhotoBar();
}

describe('el arnés carga el estudio', () => {
  test('index.html, app.js y studio.js cargan sin errores', () => {
    assert.deepEqual(app.errores.map(e => e.archivo), []);
  });

  test('toggleStudioFraming está registrado en ACCIONES', () => {
    // El botón lo invoca por data-action. Sin esta entrada el toque no hace
    // nada y no hay más pista que un aviso en la consola.
    assert.equal(typeof ACCIONES.toggleStudioFraming, 'function');
  });
});

describe('estado inicial: la pantalla siempre nace deslizable', () => {
  beforeEach(() => { editorConFoto(); });

  test('el modo arranca apagado aunque ya haya foto', () => {
    assert.equal(STUDIO._framing, false);
  });

  test('la vista previa no lleva la clase que bloquea los gestos', () => {
    assert.equal(bloqueada(), false);
  });

  test('el botón se anuncia sin pulsar y ofrece mover la foto', () => {
    assert.equal($btn().getAttribute('aria-pressed'), 'false');
    assert.match($btn().textContent, /Mover la foto/);
  });

  test('la ayuda explica cómo entrar al modo, sin jerga', () => {
    assert.match($hint().textContent, /Toca "Mover la foto"/);
  });
});

describe('encender y apagar el modo', () => {
  beforeEach(() => { editorConFoto(); });

  test('encenderlo bloquea los gestos del canvas', () => {
    toggleStudioFraming();
    assert.equal(STUDIO._framing, true);
    assert.equal(bloqueada(), true);
  });

  test('encendido, el botón se anuncia pulsado y ofrece salir', () => {
    toggleStudioFraming();
    assert.equal($btn().getAttribute('aria-pressed'), 'true');
    assert.match($btn().textContent, /Listo/);
  });

  test('la ayuda encendida recuerda que al terminar se vuelve a deslizar', () => {
    toggleStudioFraming();
    assert.match($hint().textContent, /vuelves a deslizar/);
  });

  test('volver a tocarlo devuelve el desplazamiento a la página', () => {
    toggleStudioFraming();
    toggleStudioFraming();
    assert.equal(STUDIO._framing, false);
    assert.equal(bloqueada(), false);
  });

  test('el botón no se reconstruye al alternar: el foco no se pierde', () => {
    // applyStudioFraming parchea el DOM en vez de repintar la barra entera. Si
    // alguien lo cambiara por un innerHTML, el elemento que la creadora acaba
    // de tocar dejaría de existir a mitad de la interacción.
    const antes = $btn();
    toggleStudioFraming();
    assert.equal($btn(), antes);
  });

  test('se puede fijar el estado explícitamente', () => {
    toggleStudioFraming(true);
    assert.equal(STUDIO._framing, true);
    toggleStudioFraming(false);
    assert.equal(STUDIO._framing, false);
  });
});

describe('sin foto no hay nada que mover', () => {
  test('el modo no se puede encender en una lámina vacía', () => {
    S.products = [JSON.parse(JSON.stringify(PRODUCTO))];
    openStudio('historia', 1);
    toggleStudioFraming(true);
    assert.equal(STUDIO._framing, false);
  });

  test('la barra sin foto no muestra el botón', () => {
    S.products = [JSON.parse(JSON.stringify(PRODUCTO))];
    openStudio('historia', 1);
    renderStudioPhotoBar();
    assert.equal($btn(), null);
  });
});

describe('el modo nunca queda pegado', () => {
  test('abrir el editor lo apaga: no se hereda de la pieza anterior', () => {
    editorConFoto();
    toggleStudioFraming(true);
    openStudio('historia', 1);
    assert.equal(STUDIO._framing, false);
  });

  test('cambiar de lámina lo apaga', () => {
    // Otra lámina puede no tener foto; dejar el bloqueo puesto sería una trampa.
    S.products = [JSON.parse(JSON.stringify(PRODUCTO))];
    openStudio('historia', 1);
    studioSetPhoto(STUDIO.piece.slides[0], fotoFalsa());
    renderStudioPhotoBar();
    toggleStudioFraming(true);

    setStudioSlide(0);
    assert.equal(STUDIO._framing, false);
    assert.equal(bloqueada(), false);
  });

  test('salir del editor lo apaga', () => {
    editorConFoto();
    toggleStudioFraming(true);
    studioDispose();
    assert.equal(STUDIO._framing, false);
  });

  test('tras apagarlo, el botón vuelve a anunciarse sin pulsar', () => {
    editorConFoto();
    toggleStudioFraming(true);
    openStudio('historia', 1);
    studioSetPhoto(STUDIO.piece.slides[STUDIO.piece.active], fotoFalsa());
    renderStudioPhotoBar();
    assert.equal($btn().getAttribute('aria-pressed'), 'false');
  });
});

describe('la ruta sin gestos sigue disponible', () => {
  beforeEach(() => { editorConFoto(); });

  test('el control de zoom no depende del modo encuadre', () => {
    // Quien no pueda arrastrar —o no descubra el botón— conserva 🔍 y
    // "↺ Centrar" exactamente como antes de este cambio.
    assert.ok(app.$('studio-zoom'), 'desapareció el control de zoom');
    assert.equal(STUDIO._framing, false);
  });

  test('"↺ Centrar" sigue en la barra con el modo apagado', () => {
    const centrar = app.document.querySelector('[data-action="studioCenterPhoto"]');
    assert.ok(centrar, 'desapareció el botón de centrar');
  });

  test('el botón describe su ayuda para quien usa lector de pantalla', () => {
    assert.equal($btn().getAttribute('aria-describedby'), 'studio-frame-hint');
    assert.equal($hint().getAttribute('aria-live'), 'polite');
  });
});
