// Geometría, texto y plantillas del estudio de publicaciones.
//
// Todo esto se dibuja sobre un canvas y termina en un JPEG. No hay DOM que
// inspeccionar ni error que salte: si el cálculo se equivoca, el resultado es
// una imagen con el texto cortado, la foto descuadrada o un color plano donde
// debía ir un degradado. Y para entonces ya está publicada.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, ctxFalso, plano } = require('./helpers/load.js');

const app = cargarApp();
const wrapLines = app.get('studioWrapLines');
const truncateLines = app.get('studioTruncateLines');
const fitWithin = app.get('studioFitWithin');
const coverRect = app.get('studioCoverRect');
const slug = app.get('studioSlug');
const precioTexto = app.get('studioPriceText');
const paleta = app.get('studioPalette');
const PLANTILLAS = plano(app.get('STUDIO_TEMPLATES'));
const ZOOM_MAX = app.get('STUDIO_ZOOM_MAX');
const IVA = app.get('IVA');

// 10 px por carácter: lo que se prueba es dónde parte el texto, no la
// tipografía real.
const ctx = ctxFalso(10);

describe('studioWrapLines — repartir el texto en líneas', () => {
  test('parte por palabras cuando no cabe', () => {
    assert.deepEqual(plano(wrapLines(ctx, 'hola mundo cruel', 100)), ['hola mundo', 'cruel']);
  });

  test('el texto que cabe entero queda en una sola línea', () => {
    assert.deepEqual(plano(wrapLines(ctx, 'hola', 100)), ['hola']);
  });

  test('una palabra más ancha que la caja se corta por caracteres', () => {
    // Un nombre de producto de 60 letras seguidas no puede romper el diseño.
    assert.deepEqual(plano(wrapLines(ctx, 'abcdefghijklmnopqrstuvwxyz', 100)),
      ['abcdefghij', 'klmnopqrst', 'uvwxyz']);
  });

  test('el texto vacío devuelve una línea vacía, no una lista vacía', () => {
    // Quien llama itera el resultado: una lista vacía dejaría el slot sin
    // dibujar y sin saber por qué.
    assert.deepEqual(plano(wrapLines(ctx, '', 100)), ['']);
    assert.deepEqual(plano(wrapLines(ctx, '     ', 100)), ['']);
  });

  test('nunca deja líneas vacías en medio', () => {
    const lineas = plano(wrapLines(ctx, 'uno   dos     tres cuatro cinco seis', 100));
    assert.ok(lineas.every(l => l.length > 0), `líneas: ${JSON.stringify(lineas)}`);
  });

  test('NO limita el número de líneas', () => {
    // Si truncara aquí, el autoescalado nunca se activaría: siempre vería un
    // bloque que "cabe" y jamás bajaría el tamaño de fuente.
    const lineas = plano(wrapLines(ctx, 'aaaaaaaaaa '.repeat(10), 100));
    assert.ok(lineas.length > 5, `solo ${lineas.length} líneas`);
  });
});

describe('studioTruncateLines — el último recurso', () => {
  test('si ya cabe, no toca nada', () => {
    const lineas = ['uno', 'dos'];
    assert.deepEqual(plano(truncateLines(ctx, lineas, 100, 3)), lineas);
  });

  test('recorta al máximo de líneas y marca el corte', () => {
    const out = plano(truncateLines(ctx, ['aaaa', 'bbbb', 'cccccccccc', 'dddd'], 100, 3));
    assert.equal(out.length, 3);
    assert.ok(out[2].endsWith('…'), `última línea: ${out[2]}`);
  });

  test('la elipsis cabe dentro del ancho', () => {
    const out = plano(truncateLines(ctx, ['aaaa', 'bbbb', 'cccccccccc', 'dddd'], 100, 3));
    assert.ok(ctx.measureText(out[2]).width <= 100, `"${out[2]}" no cabe`);
  });

  test('no deja un espacio colgando antes de la elipsis', () => {
    const out = plano(truncateLines(ctx, ['aaaa', 'bbbb', 'ccc ddddddd', 'eee'], 100, 3));
    assert.ok(!/\s…$/.test(out[2]), `última línea: "${out[2]}"`);
  });
});

describe('studioFitWithin — reducir una foto sin deformarla', () => {
  test('una imagen que ya cabe no se agranda', () => {
    assert.deepEqual(plano(fitWithin(100, 50, 200)), { width: 100, height: 50 });
  });

  test('reduce respetando la proporción', () => {
    assert.deepEqual(plano(fitWithin(4000, 3000, 1600)), { width: 1600, height: 1200 });
  });

  test('nunca devuelve una dimensión de cero', () => {
    // Un canvas de ancho 0 lanza al dibujar sobre él.
    for (const caso of [[0, 0, 100], [1, 10000, 100], [10000, 1, 100]]) {
      const r = plano(fitWithin(...caso));
      assert.ok(r.width >= 1 && r.height >= 1, `fitWithin(${caso}) → ${JSON.stringify(r)}`);
    }
  });
});

describe('studioCoverRect — el recorte de la foto', () => {
  // Invariante central: por más que se arrastre o se haga zoom, el recorte
  // siempre cae dentro de la foto. Un sx negativo o pasado de largo dibuja
  // borde vacío (negro o transparente) dentro de la publicación.
  const CASOS = [
    [1000, 500, 100, 100, 1, 0, 0],
    [1000, 500, 100, 100, 1, -5, 99],
    [1000, 500, 100, 100, NaN, NaN, NaN],
    [500, 1000, 100, 100, 3, 1, 1],
    [500, 1000, 100, 100, 0, -1, -1],
    [800, 800, 1080, 1350, 2.5, 0.5, -0.5],
    [1, 1, 1080, 1920, 1, 0, 0]
  ];

  test('el recorte nunca se sale de la foto', () => {
    for (const [sw0, sh0, dw, dh, zoom, ox, oy] of CASOS) {
      const r = plano(coverRect(sw0, sh0, dw, dh, zoom, ox, oy));
      const etiqueta = `coverRect(${[sw0, sh0, dw, dh, zoom, ox, oy]}) → ${JSON.stringify(r)}`;
      assert.ok(r.sx >= 0, `sx negativo: ${etiqueta}`);
      assert.ok(r.sy >= 0, `sy negativo: ${etiqueta}`);
      assert.ok(r.sx + r.sw <= sw0 + 1e-9, `se pasa por la derecha: ${etiqueta}`);
      assert.ok(r.sy + r.sh <= sh0 + 1e-9, `se pasa por abajo: ${etiqueta}`);
      assert.ok(r.sw > 0 && r.sh > 0, `recorte vacío: ${etiqueta}`);
    }
  });

  test('ningún valor sale NaN aunque entren NaN', () => {
    const r = plano(coverRect(1000, 500, 100, 100, NaN, NaN, NaN));
    for (const [k, v] of Object.entries(r)) {
      assert.ok(Number.isFinite(v), `${k} = ${v}`);
    }
  });

  test('el desplazamiento 0 centra el recorte', () => {
    const r = plano(coverRect(1000, 500, 100, 100, 1, 0, 0));
    assert.equal(r.sx, (1000 - r.sw) / 2);
  });

  test('el zoom se recorta al máximo permitido', () => {
    const alMaximo = plano(coverRect(1000, 1000, 100, 100, ZOOM_MAX, 0, 0));
    const pasado = plano(coverRect(1000, 1000, 100, 100, ZOOM_MAX * 10, 0, 0));
    assert.deepEqual(pasado, alMaximo);
  });

  test('el zoom nunca baja de 1: la foto siempre llena el hueco', () => {
    const normal = plano(coverRect(1000, 1000, 100, 100, 1, 0, 0));
    assert.deepEqual(plano(coverRect(1000, 1000, 100, 100, 0.1, 0, 0)), normal);
  });
});

describe('studioSlug — el nombre del archivo descargado', () => {
  test('quita acentos, baja a minúsculas y une con guiones', () => {
    assert.equal(slug('Jabón de lavanda'), 'jabon-de-lavanda');
    assert.equal(slug('ÑOÑO!!!'), 'nono');
  });

  test('sin nada aprovechable cae en "publicacion"', () => {
    for (const v of ['', '   ', '---', '!!!', null, undefined]) {
      assert.equal(slug(v), 'publicacion', `slug(${JSON.stringify(v)})`);
    }
  });

  test('nunca pasa de 40 caracteres', () => {
    const largo = slug('Aros de resina turquesa hechos a mano con amor y flores');
    assert.ok(largo.length <= 40, `${largo.length} caracteres`);
  });

  test('el corte a 40 puede dejar un guion final', () => {
    // Comportamiento real: el .slice(0, 40) va DESPUÉS de quitar los guiones
    // de los extremos, así que el corte puede caer justo sobre uno. Es
    // cosmético — el archivo se descarga igual — pero queda fijado aquí para
    // que quede constancia y no se descubra dos veces.
    assert.equal(slug('aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii'),
      'aaaa-bbbb-cccc-dddd-eeee-ffff-gggg-hhhh-');
  });
});

describe('studioPriceText — qué precio se publica', () => {
  const producto = { idealP: 10000 };

  test('por defecto publica el precio con IVA: el que paga quien compra', () => {
    assert.equal(precioTexto(producto, 'iva'), '$11.900');
    assert.equal(precioTexto(producto, 'iva'), app.get('fmt')(10000 * (1 + IVA)));
  });

  test('el modo consulta no muestra número', () => {
    assert.equal(precioTexto(producto, 'consulta'), 'Consulta por precio');
  });

  test('el modo oculto devuelve vacío y el slot no se dibuja', () => {
    assert.equal(precioTexto(producto, 'oculto'), '');
  });

  test('sin producto no hay precio', () => {
    assert.equal(precioTexto(null, 'iva'), '');
    assert.equal(precioTexto(undefined, 'consulta'), '');
  });

  test('un modo desconocido cae en el precio con IVA', () => {
    assert.equal(precioTexto(producto, 'inventado'), '$11.900');
    assert.equal(precioTexto(producto, undefined), '$11.900');
  });
});

describe('STUDIO_TEMPLATES — las plantillas como datos', () => {
  const FORMATOS = ['historia', 'catalogo'];

  test('hay plantillas y cada una tiene identidad', () => {
    assert.ok(PLANTILLAS.length > 0);
    const ids = PLANTILLAS.map(t => t.id);
    assert.equal(new Set(ids).size, ids.length, `ids repetidos: ${ids.join(', ')}`);
    for (const t of PLANTILLAS) {
      assert.ok(t.name, `${t.id} sin nombre visible`);
      assert.ok(FORMATOS.includes(t.format), `${t.id} declara formato "${t.format}"`);
    }
  });

  test('hay al menos una plantilla de cada formato', () => {
    for (const f of FORMATOS) {
      assert.ok(PLANTILLAS.some(t => t.format === f), `ningún template de formato ${f}`);
    }
  });

  test('las coordenadas están normalizadas', () => {
    // Las plantillas se expresan en fracciones del lienzo para servir a
    // 1080×1920 y a 1080×1350 sin tocar un número. Un valor en píxeles
    // colado aquí dibujaría el elemento fuera de la pieza.
    for (const t of PLANTILLAS) {
      for (const slot of t.slots) {
        for (const eje of ['x', 'y', 'w', 'h']) {
          const v = slot[eje];
          assert.ok(typeof v === 'number' && Number.isFinite(v),
            `${t.id}/${slot.role}: ${eje} = ${v}`);
          assert.ok(v >= -1 && v <= 2,
            `${t.id}/${slot.role}: ${eje} = ${v} no parece normalizado`);
        }
      }
    }
  });

  test('cada slot declara qué es y qué papel cumple', () => {
    for (const t of PLANTILLAS) {
      assert.ok(Array.isArray(t.slots) && t.slots.length > 0, `${t.id} sin slots`);
      for (const slot of t.slots) {
        assert.ok(slot.kind, `${t.id}: un slot sin kind`);
        assert.ok(slot.role, `${t.id}: un slot ${slot.kind} sin role`);
      }
    }
  });

  test('todo token de color de las plantillas existe en la paleta', () => {
    // Un token mal escrito no falla: studioColor() cae a pal.ink y el elemento
    // se dibuja de color tinta. En una decoración con opacidad 0,1 eso es
    // literalmente invisible hasta que alguien compara dos publicaciones.
    const pal = paleta('#FF6B6B');
    const tokens = new Set();
    const anotar = v => { if (typeof v === 'string') tokens.add(v); };

    for (const t of PLANTILLAS) {
      for (const stop of t.bg?.stops || []) anotar(stop.color);
      anotar(t.bg?.color);
      for (const d of t.decor || []) anotar(d.color);
      for (const slot of t.slots) {
        anotar(slot.color);
        anotar(slot.bgColor);
        for (const stop of slot.stops || []) anotar(stop.color);
      }
    }

    assert.ok(tokens.size > 0, 'no se recogió ningún token de color');
    const desconocidos = [...tokens].filter(tk =>
      tk.charAt(0) !== '#' && !/^rgba?\(/i.test(tk) && !(tk in pal)
    );
    assert.deepEqual(desconocidos, [],
      `tokens que caerían silenciosamente a pal.ink: ${desconocidos.join(', ')}`);
  });
});

// ---------------------------------------------------------------------------
// La capa que hay entre el producto y el canvas: qué plantilla toca, qué texto
// va en cada hueco y con qué tipografía. No dibuja nada, pero decide todo lo
// que se dibuja. Un id de plantilla que no existe o un `role` sin `case` no dan
// error: dan una pieza con un hueco vacío o con la estética equivocada.

const plantilla = app.get('studioTemplate');
const plantillasDe = app.get('studioTemplatesFor');
const plantillaDeLamina = app.get('studioSlideTemplate');
const textoDeSlot = app.get('studioSlotText');
const laminaDeProducto = app.get('studioProductSlide');
const fuenteDe = app.get('studioFontStr');
const cargarMarca = app.get('studioLoadBrand');
const STUDIO = app.get('STUDIO');
const KEY_BRAND = app.get('KEY_BRAND');

const PRODUCTO = { id: 7, name: 'Jabón de lavanda', desc: 'Aceite de oliva',
                   emoji: '🧼', idealP: 42243 };

function conMarca(campos) {
  app.almacen.set(KEY_BRAND, JSON.stringify(campos));
  cargarMarca();
}

describe('studioTemplatesFor — lo que puede elegir la creadora', () => {
  test('cada formato ofrece al menos una plantilla', () => {
    for (const formato of ['historia', 'catalogo']) {
      assert.ok(plantillasDe(formato).length > 0, `${formato} se quedó sin opciones`);
    }
  });

  test('no se cuela una plantilla de otro formato', () => {
    for (const formato of ['historia', 'catalogo']) {
      for (const t of plano(plantillasDe(formato))) {
        assert.equal(t.format, formato, t.id);
      }
    }
  });

  test('las láminas interiores del catálogo no se ofrecen sueltas', () => {
    // Van emparejadas con su portada por pairId: elegirlas por separado
    // produciría un carrusel con dos estéticas distintas.
    for (const formato of ['historia', 'catalogo']) {
      for (const t of plano(plantillasDe(formato))) {
        assert.notEqual(t.role, 'item', `${t.id} no debería ser elegible`);
      }
    }
  });

  test('un formato inventado devuelve una lista vacía, no todas', () => {
    assert.deepEqual(plano(plantillasDe('afiche')), []);
  });
});

describe('studioTemplate — resolver un id', () => {
  test('devuelve la plantilla pedida', () => {
    for (const t of PLANTILLAS) {
      assert.equal(plantilla(t.id).id, t.id);
    }
  });

  test('un id desconocido cae en una plantilla válida, nunca en undefined', () => {
    // Si devolviera undefined, el render reventaría con "cannot read slots".
    for (const id of ['no-existe', '', null, undefined, 42]) {
      const t = plantilla(id);
      assert.ok(t && Array.isArray(t.slots), `id ${JSON.stringify(id)}`);
    }
  });
});

describe('studioSlideTemplate — portada y láminas del carrusel', () => {
  const emparejadas = PLANTILLAS.filter(t => t.pairId);

  test('hay plantillas emparejadas que probar', () => {
    assert.ok(emparejadas.length >= 2);
  });

  test('cada pareja tiene su portada y su lámina', () => {
    const porPar = new Map();
    for (const t of emparejadas) {
      if (!porPar.has(t.pairId)) porPar.set(t.pairId, new Set());
      porPar.get(t.pairId).add(t.role);
    }
    for (const [pairId, roles] of porPar) {
      assert.deepEqual([...roles].sort(), ['cover', 'item'], pairId);
    }
  });

  test('la portada recibe la plantilla de portada y la lámina la suya', () => {
    for (const base of emparejadas) {
      const pieza = { templateId: base.id };
      assert.equal(plantillaDeLamina(pieza, { kind: 'cover' }).role, 'cover', base.id);
      assert.equal(plantillaDeLamina(pieza, { kind: 'product' }).role, 'item', base.id);
    }
  });

  test('la estética se mantiene: la pareja elegida no cambia', () => {
    for (const base of emparejadas) {
      const pieza = { templateId: base.id };
      for (const kind of ['cover', 'product']) {
        assert.equal(plantillaDeLamina(pieza, { kind }).pairId, base.pairId, base.id);
      }
    }
  });

  test('una plantilla sin pareja se usa para todas las láminas', () => {
    const suelta = PLANTILLAS.find(t => !t.pairId);
    const pieza = { templateId: suelta.id };
    assert.equal(plantillaDeLamina(pieza, { kind: 'cover' }).id, suelta.id);
    assert.equal(plantillaDeLamina(pieza, { kind: 'product' }).id, suelta.id);
  });

  test('sin lámina se asume que no es portada', () => {
    const base = emparejadas[0];
    assert.equal(plantillaDeLamina({ templateId: base.id }, null).role, 'item');
  });
});

describe('studioProductSlide — el producto convertido en lámina', () => {
  test('lleva lo que las plantillas consumen', () => {
    const lamina = plano(laminaDeProducto(PRODUCTO, 'iva'));

    assert.equal(lamina.kind, 'product');
    assert.equal(lamina.productId, 7);
    assert.equal(lamina.name, 'Jabón de lavanda');
    assert.equal(lamina.desc, 'Aceite de oliva');
    assert.equal(lamina.emoji, '🧼');
    assert.equal(lamina.priceText, precioTexto(PRODUCTO, 'iva'));
    assert.deepEqual(lamina.frame, { zoom: 1, ox: 0, oy: 0 });
    assert.equal(lamina.photo, null);
  });

  test('sin descripción ni emoji quedan cadenas vacías, no undefined', () => {
    // undefined se pintaría como el literal "undefined" sobre la imagen.
    const lamina = plano(laminaDeProducto({ id: 1, name: 'Vela' }, 'oculto'));
    assert.equal(lamina.desc, '');
    assert.equal(lamina.emoji, '');
    assert.equal(lamina.priceText, '');
  });

  test('el modo de precio se respeta', () => {
    assert.equal(plano(laminaDeProducto(PRODUCTO, 'consulta')).priceText, 'Consulta por precio');
    assert.equal(plano(laminaDeProducto(PRODUCTO, 'oculto')).priceText, '');
    assert.match(plano(laminaDeProducto(PRODUCTO, 'iva')).priceText, /^\$/);
  });
});

describe('studioSlotText — qué texto va en cada hueco', () => {
  const lamina = { name: 'Jabón', desc: 'Suave', priceText: '$50.269',
                   emoji: '🧼', headline: 'Titular', subhead: 'Bajada' };

  test('los datos del producto salen de la lámina', () => {
    conMarca({ name: 'Vivi' });
    assert.equal(textoDeSlot('name', lamina), 'Jabón');
    assert.equal(textoDeSlot('desc', lamina), 'Suave');
    assert.equal(textoDeSlot('price', lamina), '$50.269');
    assert.equal(textoDeSlot('emoji', lamina), '🧼');
    assert.equal(textoDeSlot('headline', lamina), 'Titular');
    assert.equal(textoDeSlot('subhead', lamina), 'Bajada');
  });

  test('los datos de marca salen de la marca GUARDADA', () => {
    conMarca({ name: 'Vivi Loaiza', handle: 'viviloaiza.cl', credit: true });
    STUDIO.brand.name = 'Borrador sin guardar';

    assert.equal(textoDeSlot('brand', lamina), 'Vivi Loaiza');
    assert.equal(textoDeSlot('handle', lamina), '@viviloaiza.cl');
    assert.equal(textoDeSlot('credit', lamina), 'hecho con PrecioCrea');
  });

  test('la arroba la pone la app, no la creadora', () => {
    conMarca({ name: 'Vivi', handle: 'viviloaiza.cl' });
    assert.equal(textoDeSlot('handle', lamina).match(/@/g).length, 1);
  });

  test('sin handle ni crédito el hueco queda vacío y el slot se omite', () => {
    conMarca({ name: 'Vivi', credit: false });
    assert.equal(textoDeSlot('handle', lamina), '');
    assert.equal(textoDeSlot('credit', lamina), '');
  });

  test('un role desconocido devuelve vacío en vez de undefined', () => {
    conMarca({ name: 'Vivi' });
    assert.equal(textoDeSlot('inventado', lamina), '');
  });

  test('el único role de texto sin manejador es el ya conocido', () => {
    // Un role escrito en una plantilla sin su `case` en studioSlotText deja un
    // hueco vacío en la imagen, sin ningún error que lo delate: el render pide
    // el texto con studioSlotText(slot.role, slide) (js/studio.js:1424) y
    // dibuja lo que reciba, aunque sea ''.
    //
    // HALLAZGO: 'eyebrow' es exactamente ese caso. Está declarado en las dos
    // portadas de catálogo (js/studio.js:799 y :883) y la portada lo trae con
    // el valor 'Catálogo' (:1994), pero studioSlotText no lo contempla y cae
    // en el `default`. Esa línea no se dibuja nunca.
    //
    // Se documenta en vez de arreglarse porque tocarlo cambia las imágenes que
    // la app genera hoy, y eso pide su propio release con QA visual. Cuando se
    // corrija, este test falla y hay que dejar la lista vacía. Si aparece OTRO
    // role mudo, también falla — que es para lo que sirve.
    conMarca({ name: 'Vivi', handle: 'vivi', credit: true });
    const roles = new Set();
    for (const t of PLANTILLAS) {
      for (const slot of t.slots) {
        if (slot.kind === 'text' && slot.role) roles.add(slot.role);
      }
    }

    assert.ok(roles.size > 0, 'no se recogió ningún role de texto');
    const mudos = [...roles].filter(r => textoDeSlot(r, lamina) === '');
    assert.deepEqual(mudos, ['eyebrow'], `roles sin texto: ${mudos.join(', ')}`);
  });

  test('la portada de catálogo trae el texto que ese hueco esperaba', () => {
    // La otra mitad del hallazgo: el dato existe en la lámina, así que el
    // arreglo es una línea en studioSlotText, no rehacer las plantillas.
    const portada = { kind: 'cover', eyebrow: 'Catálogo', headline: 'Mi catálogo' };
    assert.equal(portada.eyebrow, 'Catálogo');
    assert.equal(textoDeSlot('eyebrow', portada), '', 'hoy se pierde por el camino');
    assert.equal(textoDeSlot('headline', portada), 'Mi catálogo', 'el de al lado sí llega');
  });

  test('el logo se sirve por la misma vía, para que hideWith funcione', () => {
    conMarca({ name: 'Vivi', logo: 'data:image/png;base64,AAA' });
    assert.equal(textoDeSlot('logo', lamina), 'data:image/png;base64,AAA');
    conMarca({ name: 'Vivi' });
    assert.equal(textoDeSlot('logo', lamina), '');
  });
});

describe('studioFontStr — la tipografía de cada slot', () => {
  test('arma peso, tamaño y familia en el orden que exige el canvas', () => {
    assert.equal(fuenteDe({ family: 'display', weight: 700 }, 48),
      "700 48px 'Fraunces', Georgia, 'Times New Roman', serif");
  });

  test('el cuerpo usa Nunito', () => {
    assert.match(fuenteDe({ family: 'body', weight: 400 }, 24), /^400 24px 'Nunito',/);
  });

  test('cualquier familia que no sea "body" es la de titulares', () => {
    assert.match(fuenteDe({ family: 'otra' }, 20), /'Fraunces'/);
    assert.match(fuenteDe({}, 20), /'Fraunces'/);
  });

  test('sin peso declarado usa 700', () => {
    assert.match(fuenteDe({ family: 'body' }, 20), /^700 /);
  });

  test('siempre hay una tipografía de respaldo del sistema', () => {
    // Si Fraunces o Nunito no cargan, el canvas debe caer en algo legible en
    // vez de dibujar con la tipografía por defecto del navegador.
    for (const familia of ['display', 'body']) {
      const s = fuenteDe({ family: familia }, 20);
      assert.ok(s.split(',').length >= 3, s);
    }
  });

  test('cada slot de texto de las plantillas produce una fuente válida', () => {
    for (const t of PLANTILLAS) {
      for (const slot of t.slots) {
        if (slot.kind !== 'text') continue;
        assert.match(fuenteDe(slot, 40), /^\d+ 40px '(Fraunces|Nunito)'/, `${t.id}/${slot.role}`);
      }
    }
  });
});
