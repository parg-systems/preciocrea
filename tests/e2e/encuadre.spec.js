// El dedo sobre la vista previa: ¿desliza la pantalla o mueve la foto?
//
// Esta es la única tanda que puede responderlo. El scroll táctil lo decide el
// compositor del navegador a partir de touch-action, no el DOM: los eventos
// que se despachan desde page.evaluate no desplazan nada, por muy bien
// formados que estén. Hay que sintetizar el gesto por CDP, y para eso hace
// falta Chromium de verdad — que es justo lo que corre aquí.
//
// El fallo que motivó estos casos: #studio-canvas llevaba touch-action:none
// permanente y ocupa ~el 70% de la pantalla del teléfono, así que apoyar el
// dedo donde cae el pulgar no desplazaba el editor. Con mouse (la rueda no
// pasa por touch-action) y con lápiz funcionaba: por eso sobrevivió tanto.

'use strict';

const { test, expect } = require('@playwright/test');

const PRODUCTO = {
  id: 1, addedAt: 1, name: 'Jabón de lavanda', desc: 'Aceite de oliva',
  emoji: '🧼', date: '31-07-2026',
  mat: 2170, labor: 20000, cr: 3326, struct: 2667,
  minP: 28162, idealP: 42243, margin: 50, crLvl: 'moderado'
};

const MARCA = { name: 'Vivi Loaiza', handle: 'viviloaiza.cl', accent: '#E86A92', credit: true };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(([producto, marca]) => {
    localStorage.setItem('pc_v1', JSON.stringify([producto]));
    localStorage.setItem('pc_brand_v1', JSON.stringify(marca));
    localStorage.setItem('pc_welcome_20', '1');
  }, [PRODUCTO, MARCA]);
  await page.goto('/index.html');
  await expect(page.locator('#view-home')).toBeVisible();
});

async function abrirEstudio(page, formato = 'historia') {
  await page.evaluate(f => openStudio(f, 1), formato);
  await expect(page.locator('#view-studio-edit')).toBeVisible();
  await page.waitForFunction(() => typeof STUDIO !== 'undefined' && !!STUDIO.piece);
}

// Mete una foto en la lámina activa sin pasar por el selector de archivos.
// Alta y estrecha a propósito: recortada a "cover" sobra por arriba y por
// abajo, así que el arrastre vertical tiene recorrido de verdad que medir.
async function ponerFoto(page) {
  await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 2000;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4488cc';
    ctx.fillRect(0, 0, 600, 2000);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(0, 900, 600, 200);
    studioSetPhoto(STUDIO.piece.slides[STUDIO.piece.active], c);
    renderStudioPhotoBar();
    studioPreview();
  });
}

const centroDelCanvas = async page => {
  const caja = await page.locator('#studio-canvas').boundingBox();
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
};

const encuadre = page => page.evaluate(() => {
  const s = STUDIO.piece.slides[STUDIO.piece.active];
  return { ox: s.frame.ox, oy: s.frame.oy, zoom: s.frame.zoom };
});

// Un dedo que se apoya y sube 300 px. Es UN SOLO gesto: el mismo que Vivi hace
// para bajar por el editor y el mismo con el que encuadra la foto. Cuál de las
// dos cosas ocurre lo decide touch-action, y eso es justo lo que se mide.
//
// Va por CDP y no por page.evaluate porque los eventos despachados desde JS no
// llegan al compositor y no desplazan nada. page.mouse tampoco sirve: genera
// eventos de mouse, y la diferencia entre dedo y mouse es la mitad del asunto.
// (Input.synthesizeScrollGesture, que sería lo natural, no mueve la página en
// este arnés; dispatchTouchEvent sí, y además es más fiel al gesto real.)
async function dedoQueSube(page, { x, y }, alto = 300) {
  const cdp = await page.context().newCDPSession(page);
  const punto = (px, py) => [{ x: Math.round(px), y: Math.round(py), radiusX: 12, radiusY: 12, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(x, y) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent',
      { type: 'touchMove', touchPoints: punto(x, y - alto * i / 10) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(250);   // que el desplazamiento termine de asentarse
}

// El centro de la vista previa, con la pantalla arriba del todo: pulsar un
// botón desplaza la página, y medir después dejaría el punto fuera de cuadro.
//
// El behavior:'instant' es obligatorio, no cosmético: html lleva
// scroll-behavior:smooth, así que un scrollTo a secas ANIMA. Sin esto el gesto
// se sintetiza mientras la página aún se está moviendo y el scrollY final es
// un resto de esa animación, no el efecto del dedo. Es el mismo tropiezo que
// dejó su marca en js/app.js (showView → scrollTo).
async function centroDeLaVistaPrevia(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => window.scrollY < 1);
  // Margen para que el compositor reciba el touch-action vigente: es él quien
  // decide de quién es el gesto, y lee su propia copia del árbol, no el DOM.
  // Con menos, el gesto se sintetiza contra la región táctil anterior y el
  // resultado depende de en qué frame caiga: 0 px unas veces, 17 px otras.
  await page.waitForTimeout(300);
  return centroDelCanvas(page);
}

test('el editor es más largo que la pantalla: hay algo que deslizar', async ({ page }) => {
  // Si esto dejara de ser cierto, los tests de abajo pasarían sin probar nada.
  await abrirEstudio(page);
  await ponerFoto(page);

  const medidas = await page.evaluate(() => ({
    documento: document.documentElement.scrollHeight,
    pantalla: window.innerHeight,
    canvas: document.getElementById('studio-canvas').getBoundingClientRect().height
  }));

  expect(medidas.documento).toBeGreaterThan(medidas.pantalla);
  // La vista previa sigue siendo la protagonista: más de media pantalla.
  expect(medidas.canvas).toBeGreaterThan(medidas.pantalla * 0.5);
});

test('el dedo desliza la pantalla apoyado sobre la foto', async ({ page }) => {
  // ESTE es el fallo que reportó Vivi. Contra el código anterior falla: el
  // scrollY se queda clavado en 0 por mucho que el dedo suba.
  await abrirEstudio(page);
  await ponerFoto(page);

  await dedoQueSube(page, await centroDeLaVistaPrevia(page));

  // El dedo subió 300 px: la pantalla tiene que haberlos seguido, no arañar
  // unos pocos. La distancia importa — un puñado de píxeles sería el gesto
  // escapándose antes de que el navegador lo bloquee, no un desplazamiento.
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
});

test('sin foto, la vista previa tampoco atrapa el dedo', async ({ page }) => {
  await abrirEstudio(page);

  await dedoQueSube(page, await centroDeLaVistaPrevia(page));

  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
});

test('con el modo apagado, ese mismo gesto no descuadra la foto', async ({ page }) => {
  // El otro lado de la misma moneda: antes, al intentar bajar, el dedo movía
  // la foto sin querer.
  await abrirEstudio(page);
  await ponerFoto(page);

  const antes = await encuadre(page);
  await dedoQueSube(page, await centroDeLaVistaPrevia(page));

  expect(await encuadre(page)).toEqual(antes);
});

test('"Mover la foto" enciende el modo y ahí el dedo sí encuadra', async ({ page }) => {
  await abrirEstudio(page);
  await ponerFoto(page);

  await page.locator('#studio-frame-btn').click();
  await expect(page.locator('#studio-frame-btn')).toHaveAttribute('aria-pressed', 'true');

  const antes = await encuadre(page);
  await dedoQueSube(page, await centroDeLaVistaPrevia(page));
  const despues = await encuadre(page);

  expect(despues.oy).not.toBe(antes.oy);

  // Y mientras dura el modo, la pantalla no se va detrás del gesto. El umbral
  // no es 0 a propósito: quien decide de quién es el gesto es el compositor,
  // con su propia copia del árbol, y en este arnés a veces deja escapar una
  // decena de píxeles antes de aplicar el touch-action recién puesto. Lo que
  // separa "bloqueado" de "no bloqueado" son dos órdenes de magnitud: sin
  // bloquear, este mismo gesto desplaza más de 200 px (los dos tests de
  // arriba). Un umbral de 0 sería exacto y a la vez intermitente; este distingue
  // lo que hay que distinguir.
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(30);
});

test('tocar "Listo" devuelve el desplazamiento a la pantalla', async ({ page }) => {
  await abrirEstudio(page);
  await ponerFoto(page);

  await page.locator('#studio-frame-btn').click();
  await page.locator('#studio-frame-btn').click();
  await expect(page.locator('#studio-frame-btn')).toHaveAttribute('aria-pressed', 'false');

  await dedoQueSube(page, await centroDeLaVistaPrevia(page));

  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
});

test('el mouse sigue arrastrando la foto sin tocar el botón', async ({ page }) => {
  // Lo que hoy funciona en el PC de Vivi y con el S Pen de su teléfono. Este
  // test existe para que el arreglo del dedo no se lo lleve por delante.
  await abrirEstudio(page);
  await ponerFoto(page);

  const { x, y } = await centroDelCanvas(page);
  const antes = await encuadre(page);

  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x, y - 120 * i / 6);
  await page.mouse.up();

  expect((await encuadre(page)).oy).not.toBe(antes.oy);
});

test('touch-action dice lo que debe en cada estado', async ({ page }) => {
  // Rápido y determinista: comprueba la regla que el compositor lee, sin
  // depender de la síntesis de gestos.
  await abrirEstudio(page);
  await ponerFoto(page);

  const leer = () => page.evaluate(() =>
    getComputedStyle(document.getElementById('studio-canvas')).touchAction);

  expect(await leer()).toContain('pan-y');

  await page.locator('#studio-frame-btn').click();
  expect(await leer()).toBe('none');
});

test('el modo se apaga al cambiar de lámina en un catálogo', async ({ page }) => {
  await page.evaluate(() => openCatalogo());
  await page.locator('[data-action="toggleStudioPick"][data-id="1"]').click();
  await page.locator('[data-action="startCatalogo"]').click();
  await expect(page.locator('#view-studio-edit')).toBeVisible();

  await ponerFoto(page);
  await page.locator('#studio-frame-btn').click();
  await expect(page.locator('#studio-frame-btn')).toHaveAttribute('aria-pressed', 'true');

  // Saltar a la otra lámina, que no tiene foto: el bloqueo no puede sobrevivir.
  await page.evaluate(() => setStudioSlide(STUDIO.piece.active === 0 ? 1 : 0));

  expect(await page.evaluate(() => STUDIO._framing)).toBe(false);
  expect(await page.evaluate(() =>
    document.querySelector('.studio-stage').classList.contains('encuadrando'))).toBe(false);

  await dedoQueSube(page, await centroDeLaVistaPrevia(page));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
});

test('el modo encuadre no deja errores en la consola', async ({ page }) => {
  const errores = [];
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', e => errores.push(String(e)));

  await abrirEstudio(page);
  await ponerFoto(page);
  await page.locator('#studio-frame-btn').click();
  await dedoQueSube(page, await centroDeLaVistaPrevia(page), 120);
  await page.locator('#studio-frame-btn').click();

  expect(errores).toEqual([]);
});
