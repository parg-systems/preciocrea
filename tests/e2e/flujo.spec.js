// El recorrido completo, en un navegador de verdad.
//
// La tanda de node --test ya prueba que calc() devuelve $28.162. Esto prueba
// algo distinto y que ninguna otra capa alcanza: que una persona que teclea
// esos mismos datos en la pantalla llegue a ver ese número. Entre la fórmula y
// el ojo hay cuatro pasos, delegación de eventos, formateo y render — y
// cualquiera de los cuatro puede romperse sin que un solo test unitario falle.

'use strict';

const { test, expect } = require('@playwright/test');

// El caso de regresión de la 1.6.0, tecleado como lo haría la creadora.
const CASO = {
  nombre: 'Jabón de lavanda',
  materiales: '2170',
  horas: '2,5',
  valorHora: '8000',
  creatividad: 'moderado',
  fijos: '80000',
  unidades: '30',
  minimo: '$28.162',
  ideal: '$42.243'
};

// Recorre los cuatro pasos y deja la pantalla en los resultados.
async function calcular(page, datos = CASO) {
  await page.locator('#view-home [data-action="startCalc"]').first().click();

  await page.locator('#inp-name').fill(datos.nombre);
  await page.locator('.mat-cost').first().fill(datos.materiales);
  await page.locator('[data-action="goStep"][data-step="2"]').click();

  await page.locator('#inp-hours').fill(datos.horas);
  await page.locator('#inp-rate').fill(datos.valorHora);
  await page.locator('[data-action="goStep"][data-step="3"]').click();

  await page.locator(`.cr-option[data-val="${datos.creatividad}"]`).click();
  await page.locator('[data-action="goStep"][data-step="4"]').click();

  await page.locator('#inp-fixed').fill(datos.fijos);
  await page.locator('#inp-units').fill(datos.unidades);
  await page.locator('[data-action="showResults"]').click();

  await expect(page.locator('#view-results')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  // La bienvenida de aniversario tapa la pantalla la primera vez.
  await page.evaluate(() => localStorage.setItem('pc_welcome_20', '1'));
  await page.reload();
  await expect(page.locator('#view-home')).toBeVisible();
});

test('los precios de la regresión aparecen en pantalla', async ({ page }) => {
  await calcular(page);

  await expect(page.locator('#res-min')).toHaveText(CASO.minimo);
  await expect(page.locator('#res-ideal')).toHaveText(CASO.ideal);
  await expect(page.locator('#res-name')).toHaveText(CASO.nombre);
});

test('el precio con IVA es el que más se destaca', async ({ page }) => {
  // Decisión de producto: el IVA está siempre activado y es el precio de venta.
  await calcular(page);

  await expect(page.locator('#res-ideal-iva')).toHaveText('$50.269');
  await expect(page.locator('#res-min-iva')).toHaveText('$33.513');
});

test('cambiar el margen recalcula sin volver a preguntar nada', async ({ page }) => {
  await calcular(page);

  await page.locator('[data-action="setMargin"][data-m="120"]').click();
  await expect(page.locator('#res-margin-lbl')).toHaveText('120');
  // $61.957, no $61.956: el ideal se calcula sobre el mínimo SIN redondear
  // (28.162,17 × 2,2), y solo entonces se redondea. Rehacer la cuenta con el
  // número que se ve en pantalla da un peso menos.
  await expect(page.locator('#res-ideal')).toHaveText('$61.957');

  await page.locator('[data-action="setMargin"][data-m="30"]').click();
  await expect(page.locator('#res-ideal')).toHaveText('$36.611');
});

test('el producto guardado sobrevive a cerrar y volver a abrir la app', async ({ page }) => {
  await calcular(page);
  await page.locator('[data-action="saveProduct"]').first().click();

  await page.reload();
  await page.locator('.tab-btn[data-view="view-products"]').first().click();

  const tarjeta = page.locator('#products-list').getByText(CASO.nombre);
  await expect(tarjeta).toBeVisible();
});

test('los montos se escriben con separador de miles y se entienden igual', async ({ page }) => {
  // "12.000" tiene que ser doce mil, no doce. Aquí se comprueba con el teclado
  // de por medio, no llamando a parseMonto.
  await calcular(page, { ...CASO, materiales: '2.170' });

  await expect(page.locator('#res-min')).toHaveText(CASO.minimo);
});

test('sin nombre no deja avanzar: el paso 1 se queda donde está', async ({ page }) => {
  await page.locator('#view-home [data-action="startCalc"]').first().click();
  await page.locator('.mat-cost').first().fill('1000');
  await page.locator('[data-action="goStep"][data-step="2"]').click();

  await expect(page.locator('#step-1')).toHaveClass(/active/);
  await expect(page.locator('#step-2')).not.toHaveClass(/active/);
});

test('el botón Atrás del navegador sale de la calculadora sin salir de la app', async ({ page }) => {
  // La entrada guardián: cada vista sheet empuja una entrada al historial y el
  // popstate la vuelve a armar. Si se rompe, el primer Atrás cierra la app —
  // que en una PWA instalada significa perder lo que se estaba calculando.
  await page.locator('#view-home [data-action="startCalc"]').first().click();
  await expect(page.locator('#view-calc')).toBeVisible();

  await page.goBack();

  await expect(page.locator('#view-home')).toBeVisible();
  await expect(page.locator('#view-calc')).toBeHidden();
});

test('el Atrás encadenado no deja la app en blanco', async ({ page }) => {
  // Varias sheets seguidas y todas atrás: el caso que costó el release 2.1.0.
  await page.locator('.tab-btn[data-view="view-products"]').first().click();
  await page.locator('.tab-btn[data-view="view-studio-hub"]').first().click();
  await page.locator('.btn-help').click();

  await page.goBack();
  await page.goBack();
  await page.goBack();

  await expect(page.locator('body')).toBeVisible();
  const visibles = await page.locator('.view:visible').count();
  expect(visibles).toBeGreaterThan(0);
});

test('no hay ni un error en la consola durante el recorrido', async ({ page }) => {
  // Incluye los «Refused to execute/apply» de la CSP, que es la forma en que un
  // manejador en línea o un atributo style se delatan en tiempo de ejecución.
  const errores = [];
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', e => errores.push(String(e)));

  await calcular(page);
  await page.locator('[data-action="saveProduct"]').first().click();
  await page.locator('.tab-btn[data-view="view-products"]').first().click();

  expect(errores).toEqual([]);
});

test('cero tráfico a terceros', async ({ page }) => {
  const ajenas = [];
  page.on('request', r => {
    const url = new URL(r.url());
    if (url.hostname !== '127.0.0.1' && url.protocol !== 'data:' && url.protocol !== 'blob:') {
      ajenas.push(r.url());
    }
  });

  await calcular(page);
  // Guardar devuelve solo a la lista de productos, que es una pestaña: desde
  // los resultados la barra inferior está escondida y no hay dónde pulsar.
  await page.locator('[data-action="saveProduct"]').first().click();
  await expect(page.locator('#view-products')).toBeVisible();
  await page.locator('.tab-btn[data-view="view-studio-hub"]').first().click();

  expect(ajenas).toEqual([]);
});

test('las tipografías salen del propio dominio, no de Google', async ({ page }) => {
  const fuentes = [];
  page.on('request', r => { if (r.resourceType() === 'font') fuentes.push(r.url()); });

  await page.reload();
  await page.waitForLoadState('networkidle');

  expect(fuentes.length).toBeGreaterThan(0);
  for (const f of fuentes) expect(f).toContain('/assets/fonts/');
});
