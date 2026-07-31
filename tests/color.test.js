// Color y contraste del estudio de publicaciones.
//
// Toda la paleta de una publicación se deriva de UN color elegido por la
// creadora. Si esa derivación produce un texto ilegible, nadie se entera hasta
// que la pieza ya está publicada en Instagram: no hay error, no hay aviso, solo
// un precio que no se lee sobre su fondo. Es exactamente el tipo de promesa que
// un humano no puede verificar a ojo para infinitos colores de entrada.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, plano } = require('./helpers/load.js');

const app = cargarApp();
const hexToRgb = app.get('studioHexToRgb');
const rgbToHex = app.get('studioRgbToHex');
const hexToHsl = app.get('studioHexToHsl');
const hslToHex = app.get('studioHslToHex');
const luminancia = app.get('studioLuminance');
const contraste = app.get('studioContrast');
const onColor = app.get('studioOnColor');
const mejorContraste = app.get('studioBestContrast');
const paleta = app.get('studioPalette');
const color = app.get('studioColor');
const INK = app.get('STUDIO_INK');
const ACENTOS = app.get('STUDIO_ACCENTS');
const MARCA_DEFECTO = app.get('STUDIO_BRAND_DEFAULT');

const BLANCO = '#FFFFFF';
const MINIMO = 4.5;   // AA de WCAG 2.1 para texto normal

// Generador con semilla fija: cubre mucho más que los casos escritos a mano y
// un fallo siempre se reproduce igual.
function coloresAleatorios(n, semilla = 20260731) {
  let s = semilla;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: n }, () =>
    '#' + [0, 0, 0].map(() => Math.floor(rnd() * 256).toString(16).padStart(2, '0'))
      .join('').toUpperCase()
  );
}

const MUESTRA = [...ACENTOS, ...coloresAleatorios(300)];

describe('conversiones de color', () => {
  test('hex → rgb lee los tres canales', () => {
    // plano() porque el objeto nace dentro del contexto vm: ver la nota en
    // tests/helpers/load.js.
    assert.deepEqual(plano(hexToRgb('#FF6B6B')), { r: 255, g: 107, b: 107 });
    assert.deepEqual(plano(hexToRgb('#000000')), { r: 0, g: 0, b: 0 });
    assert.deepEqual(plano(hexToRgb('FFFFFF')), { r: 255, g: 255, b: 255 }, 'sin # también');
  });

  test('rgb → hex normaliza a mayúsculas y recorta fuera de rango', () => {
    assert.equal(rgbToHex(255, 107, 107), '#FF6B6B');
    assert.equal(rgbToHex(-20, 300, 12.6), '#00FF0D');
  });

  test('hex → rgb → hex vuelve al mismo color, exacto', () => {
    for (const hex of MUESTRA) {
      const { r, g, b } = hexToRgb(hex);
      assert.equal(rgbToHex(r, g, b), hex.toUpperCase(), `ida y vuelta de ${hex}`);
    }
  });

  test('hex → hsl → hex vuelve al mismo color con ±1 por canal', () => {
    // HSL trabaja en flotante y volver a 8 bits redondea: un desvío de una
    // unidad por canal es el ruido esperado, más que eso es un error real.
    for (const hex of MUESTRA) {
      const { h, s, l } = hexToHsl(hex);
      const vuelta = hslToHex(h, s, l);
      const a = hexToRgb(hex), b = hexToRgb(vuelta);
      for (const canal of ['r', 'g', 'b']) {
        assert.ok(Math.abs(a[canal] - b[canal]) <= 1,
          `${hex} → ${vuelta}: canal ${canal} se desvió ${Math.abs(a[canal] - b[canal])}`);
      }
    }
  });

  test('hsl → hex normaliza tonos fuera de rango en vez de romperse', () => {
    assert.equal(hslToHex(360, 1, 0.5), hslToHex(0, 1, 0.5));
    assert.equal(hslToHex(-90, 1, 0.5), hslToHex(270, 1, 0.5));
    assert.equal(hslToHex(0, 0, 0), '#000000');
    assert.equal(hslToHex(0, 0, 1), '#FFFFFF');
  });
});

describe('luminancia y contraste (WCAG 2.1)', () => {
  test('los extremos de luminancia son 1 y 0', () => {
    assert.equal(luminancia(BLANCO), 1);
    assert.equal(luminancia('#000000'), 0);
  });

  test('el contraste máximo posible es 21:1', () => {
    assert.ok(Math.abs(contraste(BLANCO, '#000000') - 21) < 1e-9);
  });

  test('un color contra sí mismo da 1:1', () => {
    for (const hex of MUESTRA.slice(0, 50)) {
      assert.ok(Math.abs(contraste(hex, hex) - 1) < 1e-9, hex);
    }
  });

  test('el contraste es simétrico', () => {
    for (const hex of MUESTRA.slice(0, 50)) {
      assert.equal(contraste(hex, BLANCO), contraste(BLANCO, hex), hex);
    }
  });

  test('nunca es menor que 1 ni mayor que 21', () => {
    for (const hex of MUESTRA) {
      const c = contraste(hex, INK);
      assert.ok(c >= 1 && c <= 21, `${hex} dio ${c}`);
    }
  });
});

describe('studioOnColor — elegir el texto por medición, no a ojo', () => {
  test('sobre un fondo claro va la tinta oscura; sobre uno oscuro, blanco', () => {
    assert.equal(onColor(BLANCO), INK);
    assert.equal(onColor('#000000'), BLANCO);
  });

  test('siempre devuelve la opción de mayor contraste real', () => {
    // La regla anterior era un umbral fijo de luminancia, y con él los acentos
    // de tono medio se llevaban texto blanco a 2,8:1. Esta propiedad es la que
    // arregló ese error, y es la que hay que impedir que se pierda.
    for (const hex of MUESTRA) {
      const elegido = onColor(hex);
      const otro = elegido === BLANCO ? INK : BLANCO;
      assert.ok(contraste(hex, elegido) >= contraste(hex, otro),
        `sobre ${hex} eligió ${elegido}, pero ${otro} contrasta más`);
      assert.equal(contraste(hex, elegido), mejorContraste(hex));
    }
  });
});

describe('studioPalette — el invariante que sostiene la legibilidad', () => {
  test('todos los tokens son colores hexadecimales válidos', () => {
    for (const hex of MUESTRA) {
      for (const [token, valor] of Object.entries(paleta(hex))) {
        assert.match(valor, /^#[0-9A-F]{6}$/i, `${hex} → ${token} = ${valor}`);
      }
    }
  });

  // accentDark y accentSoft son fondos que derivamos nosotros, y el código los
  // empuja fuera de la franja de luminancia media donde ningún texto llega a
  // 4,5:1. Esa es una promesa que sí podemos exigir para cualquier entrada.
  const EXIGIBLES = [
    ['texto sobre accentDark', p => contraste(p.onAccentDark, p.accentDark)],
    ['texto sobre accentSoft', p => contraste(p.onAccentSoft, p.accentSoft)],
    ['accentInk sobre la tarjeta blanca', p => contraste(p.accentInk, BLANCO)],
    ['accentInkSoft sobre accentSoft', p => contraste(p.accentInkSoft, p.accentSoft)]
  ];

  for (const [descripcion, medir] of EXIGIBLES) {
    test(`${descripcion} cumple AA (4,5:1) para cualquier acento`, () => {
      for (const hex of MUESTRA) {
        const c = medir(paleta(hex));
        assert.ok(c >= MINIMO - 1e-9,
          `acento ${hex}: ${descripcion} da ${c.toFixed(3)}:1, bajo el mínimo`);
      }
    });
  }

  test('el acento de la creadora se publica intacto', () => {
    // Documentado en js/studio.js: "El acento de la creadora no se toca nunca:
    // ese color es suyo". Por eso el par onAccent/accent NO puede exigirse a
    // 4,5:1 — solo se garantiza que se elige el mejor texto posible sobre él.
    for (const hex of ACENTOS) {
      assert.equal(paleta(hex).accent, hex);
    }
    const bajoElMinimo = coloresAleatorios(400, 999)
      .filter(h => contraste(paleta(h).onAccent, h) < MINIMO);
    assert.ok(bajoElMinimo.length > 0,
      'si ya ningún acento baja de 4,5:1, el código cambió y este test sobra');
  });

  test('un acento inválido cae en el color por defecto', () => {
    for (const malo of [null, undefined, '', 'rojo', '#FFF', '#GGGGGG', 42, {}]) {
      assert.equal(paleta(malo).accent, MARCA_DEFECTO.accent,
        `paleta(${JSON.stringify(malo)})`);
    }
  });

  test('acepta el hex en minúsculas', () => {
    assert.equal(paleta('#ff6b6b').accent, '#ff6b6b');
  });
});

describe('studioColor — resolver un token de plantilla', () => {
  const pal = paleta('#FF6B6B');

  test('un literal de color pasa tal cual', () => {
    // Los velos degradados necesitan alfa, y eso no cabe en un token.
    assert.equal(color('#123456', pal), '#123456');
    assert.equal(color('rgba(0,0,0,.5)', pal), 'rgba(0,0,0,.5)');
    assert.equal(color('rgb(1,2,3)', pal), 'rgb(1,2,3)');
  });

  test('un token conocido devuelve su valor', () => {
    assert.equal(color('accentDark', pal), pal.accentDark);
    assert.equal(color('card', pal), '#FFFFFF');
  });

  test('un token desconocido cae en la tinta en vez de dejar el hueco en blanco', () => {
    assert.equal(color('inventado', pal), pal.ink);
    assert.equal(color(null, pal), pal.ink);
    assert.equal(color(42, pal), pal.ink);
  });
});

// Las tres funciones que EMPUJAN un color hasta que se lee. Hasta ahora solo se
// ejercitaban de rebote, a través de studioPalette. Probadas de frente, porque
// son bucles con tope de iteraciones: si el tope se alcanza sin haber llegado al
// contraste pedido, el color sale igual y nadie lo nota. Las tres tienen que
// converger o topar en el extremo (negro puro, blanco puro), nunca a medio
// camino ni en NaN.

const bgLegible = app.get('studioReadableBg');
const tintaLegible = app.get('studioReadableInk');
const bgParaBlanco = app.get('studioBgParaBlanco');

const HEX = /^#[0-9A-F]{6}$/;

describe('studioReadableBg — un fondo que admita texto encima', () => {
  test('siempre devuelve un hex bien formado', () => {
    for (const c of [...ACENTOS, ...coloresAleatorios(120)]) {
      assert.match(bgLegible(c, -1), HEX, `oscureciendo ${c}`);
      assert.match(bgLegible(c, +1), HEX, `aclarando ${c}`);
    }
  });

  test('saca cualquier color de la franja de contraste muerto', () => {
    // La franja muerta es la de los grises medios: ni el negro ni el blanco
    // llegan a 4,5:1 encima. Es donde un texto queda ilegible sin que el color
    // se vea "mal" a ojo.
    for (const c of coloresAleatorios(150)) {
      const oscuro = bgLegible(c, -1);
      const claro  = bgLegible(c, +1);
      const sirve = v => mejorContraste(v) >= MINIMO || /^#(000000|FFFFFF)$/.test(v);
      assert.ok(sirve(oscuro), `${c} → ${oscuro}: ${mejorContraste(oscuro).toFixed(2)}`);
      assert.ok(sirve(claro),  `${c} → ${claro}: ${mejorContraste(claro).toFixed(2)}`);
    }
  });

  test('un color que ya cumple no se toca', () => {
    for (const c of ['#000000', '#FFFFFF', '#1A1A1A']) {
      assert.equal(bgLegible(c, -1), c);
    }
  });

  test('la dirección manda: -1 nunca aclara, +1 nunca oscurece', () => {
    for (const c of coloresAleatorios(80)) {
      const l0 = hexToHsl(c).l;
      assert.ok(hexToHsl(bgLegible(c, -1)).l <= l0 + 1e-9, `${c} se aclaró con dir -1`);
      assert.ok(hexToHsl(bgLegible(c, +1)).l >= l0 - 1e-9, `${c} se oscureció con dir +1`);
    }
  });
});

describe('studioReadableInk — el acento usable como texto', () => {
  test('alcanza el mínimo sobre blanco, o cae en la tinta neutra', () => {
    for (const c of [...ACENTOS, ...coloresAleatorios(150)]) {
      const tinta = tintaLegible(c, BLANCO);
      assert.match(tinta, HEX, `${c}`);
      const ok = contraste(tinta, BLANCO) >= MINIMO || tinta === INK;
      assert.ok(ok, `${c} → ${tinta}: ${contraste(tinta, BLANCO).toFixed(2)}:1`);
    }
  });

  test('conserva el tono de la creadora mientras puede', () => {
    // Es la razón de existir de la función: oscurecer sin virar el color. Se
    // comprueba sobre acentos saturados, donde el tono es reconocible.
    for (const c of ACENTOS) {
      const tinta = tintaLegible(c, BLANCO);
      if (tinta === INK) continue;
      // El tono va en grados (0–360). Solo baja la luminosidad, así que lo
      // único que puede mover el matiz es el redondeo a enteros de 0–255 al
      // volver a hex: en la práctica, menos de un grado.
      const dh = Math.abs(hexToHsl(tinta).h - hexToHsl(c).h);
      assert.ok(Math.min(dh, 360 - dh) < 1, `${c} → ${tinta}: el tono viró ${dh.toFixed(2)}°`);
    }
  });

  test('un color que ya contrasta se devuelve intacto', () => {
    assert.equal(tintaLegible('#000000', BLANCO), '#000000');
  });

  test('sobre un fondo oscuro no se queda a medio camino', () => {
    // La función solo sabe oscurecer: contra un fondo negro no hay salida y
    // debe terminar en la tinta neutra en vez de devolver algo ilegible.
    for (const c of coloresAleatorios(60)) {
      const tinta = tintaLegible(c, '#000000');
      assert.match(tinta, HEX);
      assert.ok(contraste(tinta, '#000000') >= MINIMO || tinta === INK, `${c} → ${tinta}`);
    }
  });
});

describe('studioBgParaBlanco — el fondo de la vista previa de marca', () => {
  test('cualquier acento acaba admitiendo texto blanco', () => {
    for (const c of [...ACENTOS, ...coloresAleatorios(150)]) {
      const fondo = bgParaBlanco(c);
      assert.match(fondo, HEX, `${c}`);
      const ok = contraste(fondo, BLANCO) >= MINIMO || hexToHsl(fondo).l <= 0.001;
      assert.ok(ok, `${c} → ${fondo}: ${contraste(fondo, BLANCO).toFixed(2)}:1`);
    }
  });

  test('nunca aclara: el texto blanco solo puede ganar oscureciendo', () => {
    for (const c of coloresAleatorios(80)) {
      assert.ok(hexToHsl(bgParaBlanco(c)).l <= hexToHsl(c).l + 1e-9, c);
    }
  });

  test('acepta un mínimo distinto y lo respeta', () => {
    for (const c of ACENTOS) {
      const fondo = bgParaBlanco(c, 7);
      assert.ok(contraste(fondo, BLANCO) >= 7 || hexToHsl(fondo).l <= 0.001, `${c} → ${fondo}`);
    }
  });
});
