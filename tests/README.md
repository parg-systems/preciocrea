# Tests de PrecioCrea

```bash
npm install                           # solo la primera vez
npx playwright install chromium       # solo la primera vez (~115 MB)

node --test tests/                    # la tanda rápida (~4 s, 373 pruebas)
npx playwright test                   # la tanda de navegador (~34 s, 36 pruebas)
npm run test:todo                     # las dos, en orden

node --test tests/precio.test.js      # un solo archivo
node --test --test-name-pattern="regresión" tests/
npx playwright test -g "sin conexión" # un solo caso de navegador
npx playwright test --headed          # viéndolo pasar, para depurar
```

**Corre siempre la primera; la segunda, antes de publicar.** La rápida cubre
casi todo en cuatro segundos. La de navegador cubre lo que no existe fuera de
uno: el canvas, el service worker, la instalación y el botón Atrás.

**La app sigue sin dependencias; el taller tiene dos.** La mayor parte de la
tanda no necesita nada: el runner (`node --test`) y `node:vm` vienen con Node
desde la 18. Tres archivos —`asistentes`, `importar` y la parte de render de
`seguridad`— usan **jsdom**, y la tanda de navegador usa **Playwright**. Las
dos son `devDependencies`.

Eso no toca la promesa del README. `package.json` no está en la lista `ASSETS`
de `sw.js`, no lo mira `scripts/build-portable.js`, y ni él ni `node_modules/`
viajan en el sitio publicado ni en el portable: quien clone el repo y abra
`index.html` sigue sin instalar nada. Solo quien corra los tests necesita el
`npm install`.

## Cómo se prueba una app que no exporta nada

`js/app.js` y `js/studio.js` son scripts clásicos: definen globales de nivel
superior y no tienen un solo `export`. `tests/helpers/load.js` los evalúa dentro
de un contexto de `node:vm` con los stubs mínimos de navegador que hay en
`tests/helpers/dom.js`, y devuelve una manija para alcanzar esas globales.

Tres detalles que conviene saber antes de tocar los helpers:

- **`vm.runInContext`, nunca `eval()`.** Con eval indirecto los `const` de nivel
  superior (`S`, `IVA`, `CR_MULT`, `ACCIONES`, `STUDIO_TEMPLATES`) viven en un
  ámbito efímero y desaparecen. Como `calc()` lee `S.p`, sin esto no se puede
  probar el precio.
- **Objetos de otro *realm*.** Lo que se crea dentro del contexto tiene otro
  `Object.prototype`, y `assert.deepEqual` del modo estricto compara prototipos
  por referencia. Para compararlo hay que pasarlo por `plano()`.
- **El arranque puede fallar y no pasa nada.** El IIFE `init()` está al final de
  `js/app.js`, después de todas las declaraciones. Su error se captura en
  `errores` y se ignora.

**Ningún test toca el código de producción.** Los archivos se leen tal cual
están en disco. La única excepción con efecto en el disco es
`tests/seguridad.test.js`, que ejecuta `scripts/build-portable.js` y por tanto
regenera `preciocrea-portable.html` — un artefacto de build, ya en `.gitignore`.

`tests/` **no** está en la lista `ASSETS` de `sw.js`, así que trabajar aquí
**no obliga a subir `BUILD`**.

## Qué cubre cada archivo

| Archivo | Qué protege |
|---|---|
| `precio.test.js` | La fórmula del precio, con la regresión documentada de la 1.6.0 ($28.162 / $42.243), el desglose, los niveles de creatividad, los márgenes e invariantes sobre entradas aleatorias |
| `entrada.test.js` | `parseMonto`, `parseHoras`, `fmt`, `fmtShort`, `normalizar` y `getEmoji` — el parseo en español de Chile, donde ya hubo dos errores silenciosos |
| `repo.test.js` | Coherencia de versión entre `sw.js`, `index.html`, `CHANGELOG.md`, el checklist y `package.json`; integridad de `ASSETS` y `NUCLEO`; iconos del manifest contra el tamaño real del PNG; CSP sin `unsafe-inline`; cero `<script>` y `on*=` en línea |
| `delegacion.test.js` | Que cada `data-action`/`data-input`/`data-change` del proyecto tenga manejador. Un nombre mal escrito no da error: da un botón muerto |
| `color.test.js` | Conversiones de color y el contraste AA (4,5:1) de las publicaciones para cualquier acento que elija la creadora |
| `sanitizadores.test.js` | Todo lo que entra desde `localStorage` o un respaldo importado, incluida la contaminación de prototipo |
| `estudio.test.js` | Corte de texto, recorte de foto, nombres de archivo y coherencia de las plantillas del estudio |
| `seguridad.test.js` | `esc()`, los siete guards de `scripts/build-portable.js`, y que un nombre malicioso no llegue a crear un elemento en el DOM |
| `compartir.test.js` | El mensaje de WhatsApp: precio, precio con IVA y las dos ramas que ensucian el formato (sin emoji, sin descripción) |
| `miniaturas.test.js` | El tope de 30 KB, la poda de miniaturas huérfanas y la reversión cuando el almacenamiento se niega |
| `respaldo.test.js` | `exportData`: formato v4 completo, nombre del archivo, marca guardada vs. borrador, y la ida y vuelta por el saneador |
| `asistentes.test.js` | **(jsdom)** `rateRecalc` y `fixedRecalc`: los cuatro valores hora del checklist, el desglose, los recortes y el aviso del piso legal |
| `importar.test.js` | **(jsdom)** `importData` de punta a punta con `File` y `FileReader` reales: tamaño, JSON roto, v1–v4, duplicados e ids repetidos |

## Los tres arneses

| Arnés | Cuándo | Coste |
|---|---|---|
| `helpers/load.js` (`node:vm`) | Lógica pura: precio, parseo, saneadores, color, plantillas | Instantáneo, sin dependencias |
| `helpers/dom-real.js` (jsdom) | Lo que solo existe pintado: los asistentes, la importación, el render de la lista | ~1 s por archivo, necesita `npm install` |
| `e2e/*.spec.js` (Playwright) | Lo que no existe fuera de un navegador: canvas, service worker, instalación, historial | ~34 s y ~115 MB de Chromium |

Usa el más barato que alcance. La regla práctica: si la función recibe datos y
devuelve datos, va en `load.js`; si los lee del DOM por `getElementById`,
necesita `dom-real.js`; si depende de que el navegador *haga* algo —dibujar,
cachear, instalar, navegar—, es Playwright.

Sube un escalón solo cuando el de abajo no pueda responder la pregunta. Un test
de precio en Playwright tarda mil veces más y no protege nada nuevo.

### La tanda de navegador

Vive en `tests/e2e/`, con nombres `*.spec.js`. Ese sufijo no es decorativo:
`node --test tests/` busca `*.test.js`, así que **las dos tandas conviven en la
misma carpeta sin recogerse la una a la otra**.

| Archivo | Qué protege |
|---|---|
| `flujo.spec.js` | El recorrido de la creadora: los cuatro pasos, que $28.162 y $42.243 aparezcan en pantalla, el guardado que sobrevive a la recarga, el botón Atrás y cero tráfico a terceros |
| `estudio.spec.js` | Que el canvas produzca un JPEG **válido** —por sus bytes, no por su extensión— de 1080×1920, que no salga en blanco, la descarga y el reemplazo de Compartir por Descargar cuando no hay Web Share |
| `pwa.spec.js` | El service worker: nombre del caché con `VERSION` y `BUILD`, la app abriendo sin conexión, el borrado del caché viejo, y que una corrección publicada llegue en la siguiente apertura |
| `servidor.js` | No es un test: 60 líneas de `node:http` para servir el sitio. Un service worker no se registra desde `file://` |

Tres cosas que se aprendieron peleando con ella:

- **`context.route`, no `page.route`.** Las peticiones que hace el service
  worker no pasan por el enrutado de la página, y el test del network-first
  depende justo de interceptar una de esas.
- **Las vistas *sheet* esconden la barra de pestañas.** Desde los resultados no
  hay dónde pulsar para cambiar de sección: primero se sale de la sheet.
- **`STUDIO` y `S` no están en `window`.** Son `const` de nivel superior, igual
  que en los otros dos arneses. Dentro de `page.evaluate` se leen a secas.

Dos trampas comunes a los dos arneses:

- **Objetos de otro *realm*.** `assert.deepEqual` del modo estricto compara
  prototipos por referencia: un array que viene de la app falla contra uno
  escrito en el test aunque el contenido sea idéntico. Se arregla con `plano()`
  (arnés de vm) o con un spread `[...]` (jsdom).
- **`window.eval` no sirve para cargar.** Ni en vm ni en jsdom: los `const` de
  nivel superior se evaporan y `studio.js` muere con `ACCIONES is not defined`.
  Van por `vm.runInContext` o como `<script>` inyectado.

## Qué NO cubre

Por decisión, no por olvido:

- **Layout, tipografía y color en pantalla.** Que la imagen sea un JPEG válido
  de 1080×1920 lo dice Playwright; que sea *bonita* y se lea al sol, no. Se
  revisa con el teléfono en la mano.
- **Safari y iOS de verdad.** Solo está instalado Chromium. El WebKit de
  Playwright no es Safari iOS, y las trampas que ha dado esta app —el modo
  privado que lanza al escribir en `localStorage`, la instalación desde
  «Compartir», el gesto que exige `navigator.share`— son precisamente las que
  ese motor no reproduce. Sigue en `docs/QA_CHECKLIST.md`.
- **El diálogo de instalación y el de compartir.** Los pinta el sistema
  operativo, fuera del alcance del navegador. Lo que sí se prueba es la
  decisión de la app: qué botón muestra en cada caso.

## Un hallazgo abierto

`tests/estudio.test.js` documenta que el role `eyebrow` —la palabra «Catálogo»
de las dos portadas de carrusel— nunca se dibuja: está declarado en las
plantillas y en la lámina, pero `studioSlotText` no lo contempla y devuelve
cadena vacía. El test afirma el comportamiento **actual**, así que cuando se
corrija fallará y habrá que dejar la lista vacía. No se arregló aquí porque
cambia las imágenes que la app genera y eso pide su propio release con QA
visual.
