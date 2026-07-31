# Tests de PrecioCrea

```bash
npm install                           # solo la primera vez (instala jsdom)
node --test tests/                    # toda la tanda (~4 segundos)
node --test tests/precio.test.js      # un solo archivo
node --test --test-name-pattern="regresión" tests/
```

**La app sigue sin dependencias; el taller tiene una.** La mayor parte de la
tanda no necesita nada: el runner (`node --test`) y `node:vm` vienen con Node
desde la 18. Solo tres archivos —`asistentes`, `importar` y la parte de render
de `seguridad`— usan **jsdom**, y está declarado como `devDependency`.

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

## Los dos arneses

| Arnés | Cuándo | Coste |
|---|---|---|
| `helpers/load.js` (`node:vm`) | Lógica pura: precio, parseo, saneadores, color, plantillas | Instantáneo, sin dependencias |
| `helpers/dom-real.js` (jsdom) | Lo que solo existe pintado: los asistentes, la importación, el render de la lista | ~1 s por archivo, necesita `npm install` |

Usa el segundo únicamente cuando el primero no alcance. La regla práctica: si
la función recibe datos y devuelve datos, va en `load.js`; si los lee del DOM
por `getElementById`, necesita `dom-real.js`.

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

- **El render sobre canvas, `toBlob`, Web Share y la PWA instalada.** Necesitan
  un navegador real: jsdom no dibuja (su `getContext` devuelve `null`). Siguen
  en `docs/QA_CHECKLIST.md`, y son la puerta natural para Playwright si algún
  día se decide pagar ese coste.
- **Layout y CSS.** Se revisan con el teléfono en la mano.

## Un hallazgo abierto

`tests/estudio.test.js` documenta que el role `eyebrow` —la palabra «Catálogo»
de las dos portadas de carrusel— nunca se dibuja: está declarado en las
plantillas y en la lámina, pero `studioSlotText` no lo contempla y devuelve
cadena vacía. El test afirma el comportamiento **actual**, así que cuando se
corrija fallará y habrá que dejar la lista vacía. No se arregló aquí porque
cambia las imágenes que la app genera y eso pide su propio release con QA
visual.
