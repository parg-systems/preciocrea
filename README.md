# PrecioCrea ✨

Calculadora de precios para emprendedoras creativas. Ayuda a determinar el precio justo de productos artesanales usando los **4 pilares del precio profesional**.

## ¿Qué hace?

Guía paso a paso para calcular el precio de cualquier producto creativo considerando:

1. **Materiales** — costo de insumos y packaging
2. **Tiempo** — valor de la mano de obra (horas × valor hora)
3. **Creatividad** — carga mental y diseño (5% a 40% adicional)
4. **Costos fijos** — gastos estructurales del negocio prorrateados por unidad

Entrega un **precio mínimo** (punto de equilibrio) y un **precio ideal** con márgenes de 30%, 50%, 80% o 120%. Muestra ambos precios con y sin IVA (19%).

Los dos pilares más difíciles tienen **asistente opcional**:

- **Valor hora** (pilar 2): meta mensual, tiempo disponible, horas realmente cobrables
  y cotizaciones. Compara el resultado con el mínimo legal por hora.
- **Costos fijos** (pilar 4): la parte de la casa que ocupa el taller, los gastos solo
  del negocio, la cuota mensual de las herramientas y las unidades producidas al mes.

Ambos permiten guardar el resultado y reutilizarlo en todos los productos.

Y con el precio ya calculado, genera la **publicación para Instagram** del producto.

## Características

- Aplicación web de una sola página (SPA), sin dependencias externas
- PWA instalable como app nativa en iOS y Android
- Funciona offline (Service Worker con caché)
- Guarda productos en `localStorage` del dispositivo
- Buscador de productos por nombre y descripción (insensible a acentos)
- Exporta e importa datos en JSON como respaldo
- **Publicaciones**: historias (1080×1920) y carruseles de catálogo (1080×1350) con la marca de cada creadora
- Guía de ayuda integrada con ejemplos y fundamentos teóricos
- Interfaz mobile-first, diseño responsivo
- Idioma: español (Chile)

## Navegación (desde 2.0.0)

La app tiene dos tipos de pantalla:

- **Pestañas** — barra fija inferior con cuatro secciones: **Inicio ✨**,
  **Productos 🎨**, **Publicar 📸** y **Tu marca 👤**. Conservan el encabezado y
  la píldora de aniversario.
- **Sheets** — calculadora, resultados, detalle, respaldo, guía y las dos vistas
  del Estudio. Ocupan la pantalla completa, esconden encabezado y barra, y se
  cierran con su propia flecha ←.

`showView(id)` decide cuál es cuál con la lista `TAB_VIEWS` (`js/app.js`) y marca
`.sheet-open` en el `<body>`; el CSS hace el resto. Cada pestaña se repinta al
entrar, porque sus datos pueden haber cambiado mientras se estaba en otra.

El **logotipo** es el botón de "volver al inicio" y está en las dos: grande en
el encabezado de las pestañas, compacto en las cabeceras de las sheets.
`goHome()` pregunta antes de salir si hay trabajo sin guardar — un cálculo
empezado, un resultado sin guardar, un producto editado, la marca cambiada o
una publicación sin descargar.

Los **4 pilares** de la pestaña Inicio abren su sección de la guía con
`openHelp(id)`. Al añadir secciones nuevas, si se quiere enlazarlas hay que
darles un `id` en `index.html`.

> **Cuidado con los desplazamientos automáticos.** La hoja de estilos declara
> `html { scroll-behavior: smooth }`, así que `scrollTo(x, y)` y
> `scrollTo({behavior:'auto'})` **animan** — y `auto`, por especificación,
> significa "usa el scroll-behavior calculado", no "instantáneo". Para saltar de
> golpe hay que pedir `behavior:'instant'` explícitamente. Si no, la animación
> de `showView()` sigue corriendo y pisa cualquier salto posterior.

La **bienvenida de aniversario** se muestra una sola vez (clave
`pc_welcome_20` en `localStorage`) y queda siempre accesible desde la píldora
«5 años de viviLoaiza.cl» del encabezado.

## Publicaciones

Desde la pestaña **Publicar**, desde el botón 📸 de cualquier producto de la
lista, desde el detalle del producto o desde el puente «Publícalo hoy mismo» al
final de los resultados, se generan imágenes listas para Instagram.

**Marca blanca.** La publicación es de la creadora: ella configura su nombre, su @, su logo y su color en la vista *Tu marca*, y a partir de ese único color se derivan todos los fondos y colores de texto de la pieza. No hay plantillas-imagen: cada publicación se **dibuja por código** sobre Canvas 2D, así que el proyecto no incorpora ningún archivo gráfico y cualquier color produce una pieza legible.

- **Historia** — 1080×1920, cuatro estilos.
- **Catálogo** — carrusel 1080×1350 (4:5): portada + una lámina por producto, hasta 9.
- La foto se toma del teléfono, se corrige su orientación EXIF y se encuadra arrastrando sobre la vista previa.
- El nombre, la **descripción** y el icono del producto viajan a la publicación, y se pueden retocar ahí sin alterar el producto guardado.
- El precio puede mostrarse con IVA incluido, como "Consulta por precio" u ocultarse.
- El **color** arranca en el de la marca pero se puede cambiar solo para esa publicación.
- Si hay **logo**, sustituye al nombre escrito de la marca.

> **Las fotos de producto no se guardan.** Viven solo en memoria mientras se edita la publicación: una foto en `localStorage` consumiría la cuota que necesitan los productos guardados. El **logo sí se guarda** (reducido a 360 px, unos 40-90 KB) porque es un dato de marca que se configura una vez. Todo el perfil de marca viaja dentro del respaldo `.json`.

Las plantillas viven en `STUDIO_TEMPLATES` (`js/studio.js`) como datos puros, con coordenadas normalizadas a `[0,1]`. Agregar un estilo nuevo es añadir un objeto a ese array; no hay que tocar el motor de render.

## Cómo usar

Abre `index.html` directamente en el navegador — no requiere servidor ni instalación.

El sitio publicado vive en **<https://preciocrea.parg.cl>**, donde funciona como
PWA instalable. El despliegue no es una elección abierta de hosting: hay un solo
camino y está descrito en [Al publicar](#al-publicar).

## Distribución portable (archivo único)

Para casos en que no se puede usar el link (enviar por WhatsApp/Drive/email), se puede generar un único `preciocrea-portable.html` con CSS, JS e ícono embebidos:

```bash
node scripts/build-portable.js
```

El archivo `preciocrea-portable.html` queda en la raíz. Se abre con doble click en cualquier navegador moderno. **Limitación:** no funciona como PWA instalable (los Service Workers requieren HTTPS), pero la app funciona normal —publicaciones incluidas— y `localStorage` persiste los productos.

Como el build le quita el service worker y el manifest, el navegador nunca lo considera instalable. La app lo detecta con `esPortable()` (¿hay `<link rel="manifest">`?) y, si alguien toca «Instalar en tu teléfono», lo dice claramente en vez de dar unos pasos que no van a funcionar.

El script aborta con error si alguna sustitución no encuentra su patrón en `index.html`: un portable con una referencia externa sin inlinear se ve bien al generarlo y falla en el teléfono de la clienta, así que conviene enterarse al construirlo.

## Tests

```bash
npm install                       # solo la primera vez
npx playwright install chromium   # solo la primera vez (~115 MB)

node --test tests/                # tanda rápida: 373 pruebas, ~4 s
npx playwright test               # tanda de navegador: 36 pruebas, ~34 s
npm run test:todo                 # las dos
```

**409 pruebas en total, en dos tandas.** La rápida corre sobre el código tal
como está en disco y cubre la fórmula del precio (con la regresión de la 1.6.0
escrita como test), el parseo de montos y horas en español de Chile, los
saneadores de todo lo que entra desde `localStorage` o un respaldo, el mensaje
de WhatsApp, el contraste AA de las publicaciones, los dos asistentes con el
HTML real, la importación de punta a punta y que cada `data-action` tenga
manejador.

La de navegador levanta un Chromium y cubre lo que fuera de uno no existe: que
el Estudio produzca un **JPEG válido de 1080×1920** y no una imagen en blanco,
que el service worker precachee y la app **abra sin conexión**, que una
corrección publicada llegue en la siguiente apertura, que el botón Atrás no se
salga de la app, y que el recorrido completo no genere **ni una petición a un
tercero**. `tests/README.md` explica qué protege cada archivo y qué queda fuera
a propósito.

**La app sigue sin dependencias.** `jsdom` y `Playwright` son de desarrollo: no
están en la lista `ASSETS` de `sw.js`, no las mira `build-portable.js` y no
viajan ni en el sitio publicado ni en el portable. Clonar y abrir `index.html`
sigue sin instalar nada; el `npm install` solo hace falta para correr los tests.

**Trabajar en `tests/` no obliga a subir `BUILD`**: esa carpeta no se despacha.

## Estructura del proyecto

```
preciocrea/
├── index.html                    ← Aplicación principal
├── manifest.webmanifest          ← Manifest PWA
├── sw.js                         ← Service Worker (¡subir BUILD en cada cambio!)
├── CNAME                         ← Dominio propio para GitHub Pages (no borrar)
├── robots.txt                    ← Permite el rastreo a propósito (ver dentro)
├── css/
│   └── styles.css                ← Todos los estilos
├── js/
│   ├── app.js                    ← Calculadora, productos, respaldo
│   └── studio.js                 ← Publicaciones: marca, plantillas y motor de render
├── assets/
│   ├── icons/
│   │   ├── icon-192.png          ← Ícono PWA
│   │   ├── icon-512.png          ← Ícono grande (splash de instalación)
│   │   ├── icon-192-maskable.png ← Con zona segura para la máscara de Android
│   │   └── icon-512-maskable.png
│   ├── fonts/                    ← Tipografías propias, no CDN (ver Tecnologías)
│   │   ├── nunito-var.woff2
│   │   ├── fraunces-var.woff2
│   │   └── fraunces-var-italic.woff2
│   ├── og-image.png              ← 1200×630, la tarjeta al compartir el enlace
│   ├── screenshots/              ← Capturas del manifest (ficha de instalación)
│   │   ├── inicio.png            ← 390×900, narrow
│   │   ├── resultados.png        ← 390×900, narrow
│   │   └── escritorio.png        ← 1280×720, wide
│   ├── audio/
│   │   ├── podcast_preciocrea.mp3
│   │   └── Cobra lo que realmente vale tu trabajo.mp3
│   └── docs/
│       ├── guia_operativa.pptx
│       ├── lanzamiento_emocional.pptx
│       ├── propuesta_de_valor.pdf
│       └── propuesta_de_valor.docx
├── docs/
│   └── QA_CHECKLIST.md           ← Pruebas manuales pre-release
├── tests/                        ← Tanda automática: node --test tests/
│   ├── README.md                 ← Qué cubre cada archivo y qué no cubre
│   ├── helpers/                  ← Los arneses: node:vm y jsdom
│   ├── e2e/                      ← Tanda de navegador (Playwright) + su servidor
│   └── *.test.js                 ← Precio, entrada, saneo, color, CSP, asistentes…
├── scripts/
│   └── build-portable.js         ← Genera el HTML de archivo único
├── package.json                  ← Solo para los tests. La app no lo usa
├── playwright.config.js          ← Config de la tanda de navegador
├── node_modules/                 ← ⨯ no versionado: dependencias de desarrollo
├── test-results/                 ← ⨯ no versionado: salidas de Playwright
├── slides/
│   ├── guia_operativa/           ← Diapositivas PNG de la guía
│   └── lanzamiento_emocional/    ← Diapositivas PNG del lanzamiento
├── dist/                         ← ⨯ no versionado: portables por versión
└── _archivo/                     ← ⨯ no versionado: versiones anteriores
```

Lo marcado con ⨯ está en `.gitignore` y **no aparece al clonar**: `dist/`,
`_archivo/`, `.claude/`, `node_modules/`, `test-results/` y el
`preciocrea-portable.html` de la raíz son artefactos locales. Todos se
regeneran, salvo `_archivo/`, que es histórico de esta máquina.

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Interfaz | HTML5, CSS3 con variables custom |
| Lógica | JavaScript vanilla (sin frameworks) |
| Persistencia | localStorage API |
| Offline | Service Worker + Cache API |
| Instalación | Web App Manifest (PWA) |
| Tipografías | Fraunces + Nunito, servidas desde el propio proyecto |
| Publicaciones | Canvas 2D nativo (sin librerías) |

**La app no contacta ningún servidor externo.** Las tipografías se sirven desde
`assets/fonts/` en vez de Google Fonts: así se ven igual sin conexión y la IP de
cada usuaria no viaja a un tercero cada vez que abre la app. Son las variantes
variables (un archivo cubre todos los pesos): 96 KB frente a los 285 KB que
pesarían los pesos por separado.

### Al publicar

**Primero, las dos tandas automáticas: `npm run test:todo`** (ver
[Tests](#tests)). Entre otras cosas verifican solas la coherencia de versión
entre `sw.js`, `index.html`, `CHANGELOG.md`, el checklist y `package.json` —que
es justo lo que se había desincronizado antes— y que la app abra sin conexión
con el `BUILD` nuevo. Recién después va `docs/QA_CHECKLIST.md`, que es lo que
solo se puede comprobar con el teléfono en la mano.

**Subir `BUILD` en `sw.js` en cada entrega**, aunque `VERSION` no se mueva. Son
cosas distintas: `VERSION` es lo que se le muestra a la creadora, `BUILD` es la
llave del caché. Si la llave no cambia, el service worker sigue sirviendo los
archivos viejos para siempre y, como `sw.js` queda idéntico, el navegador ni
siquiera detecta que hay algo nuevo: no aparece el banner de actualización y no
hay forma de salir de ahí desde el teléfono.

La regla exacta es: **sube `BUILD` si cambia cualquier archivo de la lista
`ASSETS` de `sw.js`.** No es «HTML, CSS o JS» — `manifest.webmanifest` también
está en esa lista y también se sirve cache-first, así que corregirlo sin subir
`BUILD` cae en la misma trampa. Y si `VERSION` cambia, hay que tocar además el
pie de la app en `index.html`, que lleva el número escrito a mano.

### Cómo se despliega

| Pieza | Dónde |
|---|---|
| Repositorio | `parg-systems/preciocrea`, rama `master` |
| Hosting | GitHub Pages, despliegue clásico desde rama (`master` / raíz) |
| Dominio | `preciocrea.parg.cl`, fijado por el archivo `CNAME` de la raíz |
| DNS | Cloudflare (solo DNS, sin proxy): `CNAME preciocrea → parg-systems.github.io` |
| Cabeceras | Las de GitHub Pages: `max-age=600`, no configurables |

Publicar es `git push origin master`: no hay workflow ni paso de build. **No
borrar el `CNAME`** — sin él Pages vuelve a la URL de `github.io`.

El registro DNS va en **«DNS only»** (nube gris). El proxy de Cloudflare rompe el
desafío HTTP con que GitHub emite el certificado, y con el SSL en *Flexible*
produce un bucle de redirecciones.

#### Qué hace que una corrección llegue

GitHub Pages sirve todo con `Cache-Control: max-age=600` y **no permite
configurar cabeceras**. No hay forma de pedirle `no-cache`, así que el mecanismo
de invalidación es otro y vive en el propio código:

1. **El bump de `BUILD`** renombra el caché del service worker, que borra el
   anterior en su `activate`. Es la pieza principal.
2. **Network-first para navegaciones**, desde la 1.6.0: la app pide el documento
   a la red antes que al caché, así que una corrección publicada entra en la
   siguiente apertura.

Los 600 segundos acotan el peor caso a diez minutos sobre el propio `sw.js`, que
es aceptable. Si alguna vez importara reducirlo, la única vía sería un proxy
delante (Cloudflare naranja) con una regla de cabecera.

> **Se evaluó y se descartó** (julio 2026): la ganancia no justificaba la
> complejidad. Y encender el proxy **empeora las cosas por defecto** — el
> *Browser Cache TTL* del plan gratuito es de 4 horas y se aplica a `.js` y
> `.css`, así que `sw.js` pasó de 600 s a 14400 s con solo cambiar la nube a
> naranja. Quien lo retome tiene que ajustar también ese TTL, apagar *Rocket
> Loader* (inyecta un script en línea que la CSP `script-src 'self'` bloquea: la
> app abre en blanco) y apagar *Bot Fight Mode* (desafía a `facebookexternalhit`
> y mata la vista previa al compartir).

### Mejoras pendientes

**Atajos del manifest** (`shortcuts`): mantener pulsado el icono instalado y
saltar directo a la calculadora o a Productos. Quedó fuera a propósito porque no
es solo manifest — necesita leer un parámetro (`./?ir=calculadora`) al arrancar y
despachar la acción, y eso toca la **entrada guardián del botón Atrás**, que es
lo que costó el release 2.1.0 entero. El alcance está estudiado: parseo al final
del init (nunca arriba, por la zona muerta temporal), ruta en el mapa `RUTAS` de
`accionAtras()` para que el primer Atrás vuelva a Inicio y no salga de la app, e
iconos de 96×96 por atajo o Android muestra uno genérico. Conviene hacerlo solo,
en su propio release, con QA enfocado en Atrás.

## Color y legibilidad

Los colores luminosos de la paleta (`--coral`, `--purple`) son **colores de
fondo**: sobre blanco dan menos de 3:1 y no se pueden usar como texto. Para eso
están sus versiones con cuerpo. La regla que ordena todo esto: **cuando un texto
no se lee, se oscurece el fondo, nunca las letras de marca.**

| Token | Uso |
|---|---|
| `--coral`, `--purple` | Halos, fondos claros, adornos |
| `--coral-deep` `#DE3B57`, `--violet` `#8E3FD4` | Acentos con cuerpo: admiten letra blanca encima y se leen sobre blanco |
| `--coral-ink` `#B62A44`, `--violet-deep` `#5B2A8C` | Los mismos tonos **como letras** sobre fondo claro |
| `--blue-deep`, `--green-deep`, `--orange-deep` | Únicos tonos funcionales que admiten texto blanco |
| `--muted` `#7C7089` | Texto secundario |
| `--muted-soft` `#A79CB2` | El tono claro anterior, solo adornos y notas al pie |
| `--border` `#EFE7EE` | Borde de 1 px que separa las tarjetas del fondo |
| `--border-strong` | Bordes punteados y elementos que deben destacar |
| `--ink-night` `#2E1B3F` | El color del Estudio |

En las publicaciones ocurre lo mismo pero calculado en caliente: `studioPalette()` deriva del acento de la creadora los tokens `accentInk` (acento legible como texto) y `onAccent`/`onAccentDark` (qué color de letra va sobre cada fondo), midiendo contraste WCAG en vez de fijarlo a ojo.

## Los dos asistentes

Vistas `#view-rate` y `#view-fixed`, abiertas desde su paso del cálculo, desde la guía
y desde la pestaña «Tu marca». Misma arquitectura: una sola pantalla con bloques
numerados, borrador en memoria (`S.rateDraft` / `S.fixedDraft`), recálculo en vivo y
persistencia solo al pulsar el botón final — por eso salir de ahí no puede perder nada
guardado y no hace falta preguntar al volver.

> **Se reparten el trabajo sin solaparse.** En el de valor hora los gastos del hogar
> quedan fuera **a propósito**: sirven para saber cuánto necesita ganar, no son un
> costo del negocio. La proporción de la casa que ocupa el taller se cobra en el de
> costos fijos. Poner el arriendo en los dos lo cobraría dos veces, y por eso cada
> pantalla lo dice en un aviso destacado. Si se toca uno, revisar el texto del otro.

Para no pedir lo mismo dos veces, el asistente de costos fijos **siembra** el arriendo
y las cuentas con lo que se respondió en el de valor hora (`FIXED_HOGAR[].desdeRate`),
avisando de dónde salieron. Después son independientes.

### Valor hora

Cuatro bloques y el resultado recalculándose en vivo:

```
meta      = camino directo ? monto : totalHogar × parteNegocio/100
horasMes  = redondear( días × horasDía × 4,333 )
cobrables = redondear( horasMes × factorProducción/100 )
valorHora = redondear100( meta × (1 + cotizaciones/100) / cobrables )
```

Las horas se redondean **antes** de dividir, no solo al pintarlas: si la pantalla
dice «85 horas cobrables» y por dentro divide entre 84,5, quien rehaga la cuenta a
mano no llega al mismo número.

### Costos fijos

```
casa      = (arriendo + cuentas) × parteDeLaCasa/100
negocio   = suma de los gastos que existen solo por el emprendimiento
herram.   = valorHerramientas / (años × 12)
total     = casa + negocio + herramientas
porUnidad = total / unidadesAlMes
```

Con las referencias: ($450.000 + $120.000) × 15% = $85.500 · $32.500 del negocio ·
$250.000 / 36 meses = $6.944 → **$124.944 al mes**, que entre 30 unidades son **$4.165
por producto**. Este asistente entrega los **dos** campos del paso 4: gastos y unidades.

### Persistencia

Los perfiles viven en `pc_rate_v1` y `pc_fixed_v1` como
`{ …resultado, remember, savedAt, inputs }` — se guardan las respuestas y no solo el
resultado, para que al reabrir aparezcan sus montos y no las referencias. Con
`remember`, `resetState()` rellena los campos y las filas `.rate-saved` / `.fixed-saved`
explican de dónde salieron los números.

### Los montos de referencia

Están en `RATE_GASTOS`, `FIXED_HOGAR` y `FIXED_NEGOCIO` (`js/app.js`) y son un **punto
de partida para que la pantalla no empiece en blanco**, no un dato de la creadora: se
editan todos y la pantalla lo dice. Si envejecen, se cambian ahí junto con
`RATE_REF_FECHA`.

`RATE_MIN_MENSUAL` y `RATE_MIN_JORNADA` definen el piso legal por hora
(ingreso mínimo ÷ jornada × 4,333). Al actualizarlos hay que revisar también los dos
textos que lo citan a mano: el globo `#t-rate` y la sección «Paso 2» de la guía, en
`index.html`.

## Constantes configurables

En `js/app.js` se pueden ajustar sin tocar el resto del código:

```javascript
const IVA     = 0.19;          // Tasa de IVA aplicable
const MARGINS = [30, 50, 80, 120]; // Opciones de margen de ganancia (%)
const CR_MULT = { facil:0.05, moderado:0.15, intenso:0.25, obra:0.40 };

const RATE_MIN_MENSUAL = 500000;   // Ingreso mínimo mensual (Chile)
const RATE_MIN_JORNADA = 42;       // Jornada semanal legal (Ley 21.561)
```

## Créditos

Creada por [viviLoaiza.cl](https://viviloaiza.cl) para emprendedoras que necesitan herramientas para cobrar lo que realmente vale su trabajo.

**Queda prohibida su venta o distribución comercial.**
