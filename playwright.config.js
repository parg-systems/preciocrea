// Configuración de los tests de navegador.
//
// Estos son la segunda tanda, no un reemplazo de la primera. `node --test
// tests/` sigue siendo lo que se corre en cada cambio: tarda cuatro segundos y
// cubre casi todo. Esto de aquí levanta un Chromium de verdad y solo cubre lo
// que ningún otro camino alcanza — el canvas, el service worker, la instalación
// y el botón Atrás.
//
// Los .spec.js viven en tests/e2e/ y NO los recoge `node --test tests/`: ese
// runner busca archivos *.test.js, así que las dos tandas conviven en la misma
// carpeta sin pisarse.

'use strict';

const { defineConfig, devices } = require('@playwright/test');

const PUERTO = 4173;

module.exports = defineConfig({
  testDir: './tests/e2e',
  // Un service worker es estado compartido del origen: dos tests registrando y
  // desregistrando a la vez se pisan. Se corre en serie, que además hace el
  // fallo reproducible.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Estos tests hablan con localhost: nada tarda de verdad. Un timeout corto
  // evita que un selector equivocado cueste treinta segundos por caso.
  timeout: 20 * 1000,
  expect: { timeout: 5 * 1000 },
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // El teléfono es el dispositivo real de la creadora: la app está limitada
    // a 480 px y toda la navegación es la barra inferior.
    viewport: { width: 390, height: 844 },
    hasTouch: true
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'],
                               viewport: { width: 390, height: 844 }, hasTouch: true } }
  ],

  webServer: {
    command: `node tests/e2e/servidor.js ${PUERTO}`,
    url: `http://127.0.0.1:${PUERTO}/index.html`,
    reuseExistingServer: true,
    timeout: 30 * 1000
  }
});
