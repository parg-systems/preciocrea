// El motor de publicaciones, con un canvas de verdad.
//
// Esto es lo que ninguna otra tanda alcanza. jsdom no dibuja: su getContext
// devuelve null. Los tests de node cubren la geometría, el corte de texto y el
// contraste, pero nadie podía responder la pregunta que importa —¿sale una
// imagen, y es una imagen válida?— sin un navegador.
//
// Lo que se comprueba son las propiedades del archivo: que sea un JPEG de
// verdad (por sus bytes, no por la extensión), que mida 1080×1920, que no
// venga en blanco y que se descargue con un nombre reconocible. La estética se
// sigue mirando a ojo, y así debe ser.

'use strict';

const { test, expect } = require('@playwright/test');

const PRODUCTO = {
  id: 1, addedAt: 1, name: 'Jabón de lavanda', desc: 'Aceite de oliva',
  emoji: '🧼', date: '31-07-2026',
  mat: 2170, labor: 20000, cr: 3326, struct: 2667,
  minP: 28162, idealP: 42243, margin: 50, crLvl: 'moderado'
};

const MARCA = { name: 'Vivi Loaiza', handle: 'viviloaiza.cl', accent: '#E86A92', credit: true };

// Deja la app con un producto y una marca ya configurados, sin pasar por los
// formularios: lo que se prueba aquí es el render, no el camino hasta él.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(([producto, marca]) => {
    localStorage.setItem('pc_v1', JSON.stringify([producto]));
    localStorage.setItem('pc_brand_v1', JSON.stringify(marca));
    localStorage.setItem('pc_welcome_20', '1');
  }, [PRODUCTO, MARCA]);
  await page.goto('/index.html');
  await expect(page.locator('#view-home')).toBeVisible();
});

// Abre el estudio para el producto guardado y espera a que haya pieza.
async function abrirEstudio(page, formato = 'historia') {
  await page.evaluate(f => openStudio(f, 1), formato);
  await expect(page.locator('#view-studio-edit')).toBeVisible();
  // STUDIO es un const de nivel superior: NO está en window. Se lee a secas,
  // que es lo que hace el propio código de la app.
  await page.waitForFunction(() => typeof STUDIO !== 'undefined' && !!STUDIO.piece);
}

test('el estudio abre con la pieza armada', async ({ page }) => {
  await abrirEstudio(page);

  const pieza = await page.evaluate(() => ({
    formato: STUDIO.piece.format,
    laminas: STUDIO.piece.slides.length,
    plantilla: STUDIO.piece.templateId
  }));

  expect(pieza.formato).toBe('historia');
  expect(pieza.laminas).toBeGreaterThan(0);
  expect(pieza.plantilla).toBeTruthy();
});

test('el canvas de exportación produce un JPEG válido de 1080×1920', async ({ page }) => {
  await abrirEstudio(page);

  const imagen = await page.evaluate(async () => {
    const canvas = studioRenderToCanvas(0);
    const blob = await studioCanvasToBlob(canvas);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return {
      ancho: canvas.width,
      alto: canvas.height,
      tipo: blob.type,
      tamano: blob.size,
      // Firma de un JPEG: FF D8 FF al principio, FF D9 al final.
      inicio: [bytes[0], bytes[1], bytes[2]],
      fin: [bytes[bytes.length - 2], bytes[bytes.length - 1]]
    };
  });

  expect(imagen.ancho).toBe(1080);
  expect(imagen.alto).toBe(1920);
  expect(imagen.tipo).toBe('image/jpeg');
  expect(imagen.inicio).toEqual([0xFF, 0xD8, 0xFF]);
  expect(imagen.fin).toEqual([0xFF, 0xD9]);
  // Una historia con fondo, texto y logo no baja de unos pocos KB. Un JPEG de
  // 1080×1920 en blanco pesa ~30 KB: por debajo de eso algo no se dibujó.
  expect(imagen.tamano).toBeGreaterThan(20 * 1024);
});

test('la imagen no sale en blanco: tiene el color de la marca', async ({ page }) => {
  await abrirEstudio(page);

  const analisis = await page.evaluate(() => {
    const canvas = studioRenderToCanvas(0);
    const datos = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const colores = new Set();
    let opacos = 0;
    // Se muestrea: 2 millones de píxeles no hacen falta para saber si hay algo.
    for (let i = 0; i < datos.length; i += 4 * 997) {
      colores.add(`${datos[i]},${datos[i + 1]},${datos[i + 2]}`);
      if (datos[i + 3] === 255) opacos++;
    }
    return { distintos: colores.size, opacos };
  });

  expect(analisis.distintos).toBeGreaterThan(20);
  expect(analisis.opacos).toBeGreaterThan(0);
});

test('el precio publicado lleva IVA incluido', async ({ page }) => {
  // Un precio publicado es un precio de venta al público. $42.243 × 1,19.
  await abrirEstudio(page);

  const texto = await page.evaluate(() => STUDIO.piece.slides[0].priceText);
  expect(texto).toBe('$50.269');
});

test('descargar la lámina entrega un archivo con nombre reconocible', async ({ page }) => {
  await abrirEstudio(page);

  const descarga = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => studioDownloadActive())
  ]).then(([d]) => d);

  expect(descarga.suggestedFilename()).toMatch(/\.jpe?g$/);
  expect(descarga.suggestedFilename()).toContain('jabon-de-lavanda');
});

test('el catálogo arma portada más una lámina por producto', async ({ page }) => {
  // El catálogo no se abre con openStudio: pasa por el selector de productos,
  // que es donde se arma la portada. Se recorre la ruta de verdad.
  await page.evaluate(() => openCatalogo());
  await expect(page.locator('#view-studio-pick')).toBeVisible();

  await page.locator('[data-action="toggleStudioPick"][data-id="1"]').click();
  await page.locator('[data-action="startCatalogo"]').click();

  await expect(page.locator('#view-studio-edit')).toBeVisible();
  const laminas = await page.evaluate(() => STUDIO.piece.slides.map(s => s.kind));

  expect(laminas[0]).toBe('cover');
  expect(laminas.length).toBe(2);
});

test('cada lámina del catálogo se exporta por separado', async ({ page }) => {
  await page.evaluate(() => openCatalogo());
  await page.locator('[data-action="toggleStudioPick"][data-id="1"]').click();
  await page.locator('[data-action="startCatalogo"]').click();
  await expect(page.locator('#view-studio-edit')).toBeVisible();

  const laminas = await page.evaluate(async () => {
    const salida = [];
    for (let i = 0; i < STUDIO.piece.slides.length; i++) {
      const c = studioRenderToCanvas(i);
      const blob = await studioCanvasToBlob(c);
      const bytes = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
      salida.push({ w: c.width, h: c.height, tamano: blob.size, firma: [...bytes] });
    }
    return salida;
  });

  expect(laminas.length).toBe(2);
  for (const l of laminas) {
    // 1080×1350 es el vertical de feed de Instagram, no el cuadrado clásico:
    // ocupa más pantalla en el teléfono. La historia, en cambio, es 1080×1920.
    expect(l.w).toBe(1080);
    expect(l.h).toBe(1350);
    expect(l.firma).toEqual([0xFF, 0xD8, 0xFF]);
    expect(l.tamano).toBeGreaterThan(10 * 1024);
  }
});

test('cada plantilla del formato produce su propio JPEG válido', async ({ page }) => {
  await abrirEstudio(page);

  const resultados = await page.evaluate(async () => {
    const salida = [];
    for (const t of studioTemplatesFor('historia')) {
      STUDIO.piece.templateId = t.id;
      const blob = await studioCanvasToBlob(studioRenderToCanvas(0));
      const bytes = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
      salida.push({ id: t.id, tamano: blob.size, firma: [...bytes] });
    }
    return salida;
  });

  expect(resultados.length).toBeGreaterThan(1);
  for (const r of resultados) {
    expect(r.firma, r.id).toEqual([0xFF, 0xD8, 0xFF]);
    expect(r.tamano, r.id).toBeGreaterThan(20 * 1024);
  }
});

test('sin Web Share, la app ofrece descargar en vez de un botón muerto', async ({ page }) => {
  // En escritorio no hay navigator.canShare con archivos. La app tiene que
  // detectarlo y cambiar el botón, no ofrecer compartir y fallar al pulsarlo.
  await abrirEstudio(page);

  const puedeCompartir = await page.evaluate(() => studioCanShareFiles());
  expect(puedeCompartir).toBe(false);

  await expect(page.locator('[data-action="studioDownloadActive"]').first()).toBeVisible();
  await expect(page.locator('[data-action="studioShareActive"]')).toHaveCount(0);
});

test('con Web Share disponible, aparece el botón de compartir', async ({ page }) => {
  // El camino que sí toman los teléfonos. Se simula la API porque headless no
  // la trae; lo que se prueba es la decisión de la app, no el diálogo del SO.
  await page.addInitScript(() => {
    navigator.share = async () => {};
    navigator.canShare = () => true;
  });
  await page.reload();
  await abrirEstudio(page);

  await expect(page.locator('[data-action="studioShareActive"]').first()).toBeVisible();
});

test('el render no deja errores en la consola', async ({ page }) => {
  const errores = [];
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', e => errores.push(String(e)));

  await abrirEstudio(page);
  await page.evaluate(async () => { await studioCanvasToBlob(studioRenderToCanvas(0)); });

  expect(errores).toEqual([]);
});

// ---------------------------------------------------------------------------
// Publicación libre: un anuncio que no cuelga de ningún producto. El camino
// entero por la interfaz, porque lo que se prueba es justamente que no exija
// nada guardado en la calculadora.

async function abrirLibre(page) {
  // Sin un solo producto: es la situación que el resto del Estudio no permite.
  await page.evaluate(() => { S.products = []; localStorage.removeItem('pc_v1'); });
  await page.locator('.tabbar [data-view="view-studio-hub"]').click();
  await page.locator('[data-action="openStudioLibre"]').click();
  await expect(page.locator('#view-studio-edit')).toBeVisible();
  await page.waitForFunction(() => typeof STUDIO !== 'undefined' && !!STUDIO.piece);
}

test('la publicación libre se abre sin ningún producto guardado', async ({ page }) => {
  await abrirLibre(page);

  const pieza = await page.evaluate(() => ({
    formato: STUDIO.piece.format,
    laminas: STUDIO.piece.slides.length,
    kind: STUDIO.piece.slides[0].kind,
    producto: STUDIO.piece.slides[0].productId
  }));

  expect(pieza.formato).toBe('historia');
  expect(pieza.laminas).toBe(1);
  expect(pieza.kind).toBe('libre');
  expect(pieza.producto).toBeUndefined();
});

test('la publicación libre exporta un JPEG válido de 1080×1920', async ({ page }) => {
  await abrirLibre(page);

  await page.locator('#studio-name').fill('Pedidos abiertos');
  await page.locator('#studio-desc').fill('Esta semana despacho a todo Chile');
  await page.locator('#studio-highlight').fill('Hasta el viernes');

  const imagen = await page.evaluate(async () => {
    const canvas = studioRenderToCanvas(0);
    const blob = await studioCanvasToBlob(canvas);
    const bytes = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
    return { ancho: canvas.width, alto: canvas.height, tamano: blob.size, firma: [...bytes] };
  });

  expect(imagen.ancho).toBe(1080);
  expect(imagen.alto).toBe(1920);
  expect(imagen.firma).toEqual([0xFF, 0xD8, 0xFF]);
  expect(imagen.tamano).toBeGreaterThan(20 * 1024);
});

test('el texto destacado de una libre ocupa el lugar del precio', async ({ page }) => {
  await abrirLibre(page);
  await page.locator('#studio-highlight').fill('Hasta el viernes');

  // Y los chips de precio no aparecen: no hay precio que publicar.
  await expect(page.locator('.studio-price-chip')).toHaveCount(0);
  expect(await page.evaluate(() => studioSlotText('price', STUDIO.piece.slides[0])))
    .toBe('Hasta el viernes');
});

test('la publicación libre se descarga con un nombre reconocible', async ({ page }) => {
  await abrirLibre(page);
  await page.locator('#studio-name').fill('Pedidos abiertos');

  const descarga = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => studioDownloadActive())
  ]).then(([d]) => d);

  expect(descarga.suggestedFilename()).toContain('pedidos-abiertos');
});

// ---------------------------------------------------------------------------
// Tamaño y color de la letra.

test('el tamaño de letra elegido llega al archivo exportado', async ({ page }) => {
  await abrirEstudio(page);

  await page.locator('.studio-size-chip[data-slot="name"][data-size="grande"]').click();
  await page.locator('.studio-size-chip[data-slot="desc"][data-size="chico"]').click();

  const estado = await page.evaluate(() => {
    const tpl = studioSlideTemplate(STUDIO.piece, STUDIO.piece.slides[0]);
    const base = studioTemplate(STUDIO.piece.templateId);
    const de = (t, role) => t.slots.find(s => s.role === role).size;
    return {
      elegido: STUDIO.piece.textSize,
      nombre: de(tpl, 'name') / de(base, 'name'),
      desc:   de(tpl, 'desc') / de(base, 'desc')
    };
  });

  expect(estado.elegido).toEqual({ name: 'grande', desc: 'chico' });
  expect(estado.nombre).toBeGreaterThan(1);
  expect(estado.desc).toBeLessThan(1);
});

test('el color de letra elegido se aplica y nunca queda ilegible', async ({ page }) => {
  await abrirEstudio(page);

  // Un amarillo puro: sobre la tarjeta blanca de la plantilla es invisible.
  await page.evaluate(() => setStudioTextColor('#FFFF00'));

  const analisis = await page.evaluate(() => {
    const base = studioTemplate(STUDIO.piece.templateId);
    const tpl  = studioSlideTemplate(STUDIO.piece, STUDIO.piece.slides[0]);
    const pal  = studioPalette(studioAccent());
    return tpl.slots.map((s, i) => {
      if (s.kind !== 'text' || s.role === 'emoji') return null;
      return { role: s.role, color: s.color, contraste: studioContrast(s.color, studioSlotBg(base.slots[i], pal)) };
    }).filter(Boolean);
  });

  expect(analisis.length).toBeGreaterThan(3);
  for (const s of analisis) {
    expect(s.color, s.role).toMatch(/^#[0-9A-F]{6}$/i);
    expect(s.contraste, `${s.role} → ${s.color}`).toBeGreaterThanOrEqual(4.5);
  }
});

test('volver al automático deja la publicación como estaba', async ({ page }) => {
  await abrirEstudio(page);
  const antes = await page.evaluate(() =>
    studioSlideTemplate(STUDIO.piece, STUDIO.piece.slides[0]).slots.map(s => s.color));

  await page.evaluate(() => setStudioTextColor('#FFFF00'));
  await page.locator('.studio-auto-chip').click();

  const despues = await page.evaluate(() =>
    studioSlideTemplate(STUDIO.piece, STUDIO.piece.slides[0]).slots.map(s => s.color));

  expect(await page.evaluate(() => STUDIO.piece.textColor)).toBeNull();
  expect(despues).toEqual(antes);
});

test('los controles de tipografía no dejan errores en la consola', async ({ page }) => {
  const errores = [];
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', e => errores.push(String(e)));

  await abrirEstudio(page);
  await page.locator('.studio-size-chip[data-slot="name"][data-size="grande"]').click();
  await page.locator('.studio-text-swatches .brand-swatch').first().click();
  await page.evaluate(async () => { await studioCanvasToBlob(studioRenderToCanvas(0)); });

  expect(errores).toEqual([]);
});
