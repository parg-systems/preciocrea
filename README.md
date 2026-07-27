# PrecioCrea ✨

Calculadora de precios para emprendedoras creativas. Ayuda a determinar el precio justo de productos artesanales usando los **4 pilares del precio profesional**.

## ¿Qué hace?

Guía paso a paso para calcular el precio de cualquier producto creativo considerando:

1. **Materiales** — costo de insumos y packaging
2. **Tiempo** — valor de la mano de obra (horas × valor hora)
3. **Creatividad** — carga mental y diseño (5% a 40% adicional)
4. **Costos fijos** — gastos estructurales del negocio prorrateados por unidad

Entrega un **precio mínimo** (punto de equilibrio) y un **precio ideal** con márgenes de 30%, 50%, 80% o 120%. Muestra ambos precios con y sin IVA (19%).

Y con el precio ya calculado, genera la **publicación para Instagram** del producto.

## Características

- Aplicación web de una sola página (SPA), sin dependencias externas
- PWA instalable como app nativa en iOS y Android
- Funciona offline (Service Worker con caché)
- Guarda productos en `localStorage` del dispositivo
- Exporta e importa datos en JSON como respaldo
- **Publicaciones**: historias (1080×1920) y carruseles de catálogo (1080×1350) con la marca de cada creadora
- Guía de ayuda integrada con ejemplos y fundamentos teóricos
- Interfaz mobile-first, diseño responsivo
- Idioma: español (Chile)

## Publicaciones

Desde un producto guardado (botón **📸 Publicar**) o desde la tarjeta del home se generan imágenes listas para Instagram.

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

Para compartir o publicar: sube todo el proyecto a cualquier hosting estático (GitHub Pages, Netlify, etc.). Allí funciona como PWA instalable.

## Distribución portable (archivo único)

Para casos en que no se puede usar el link (enviar por WhatsApp/Drive/email), se puede generar un único `preciocrea-portable.html` con CSS, JS e ícono embebidos:

```bash
node scripts/build-portable.js
```

El archivo `preciocrea-portable.html` (~240 KB) queda en la raíz. Se abre con doble click en cualquier navegador moderno. **Limitación:** no funciona como PWA instalable (los Service Workers requieren HTTPS), pero la app funciona normal —publicaciones incluidas— y `localStorage` persiste los productos.

El script aborta con error si alguna sustitución no encuentra su patrón en `index.html`: un portable con una referencia externa sin inlinear se ve bien al generarlo y falla en el teléfono de la clienta, así que conviene enterarse al construirlo.

## Estructura del proyecto

```
preciocrea/
├── index.html                    ← Aplicación principal
├── manifest.webmanifest          ← Manifest PWA
├── sw.js                         ← Service Worker (bump VERSION al publicar)
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
├── slides/
│   ├── guia_operativa/           ← Diapositivas PNG de la guía
│   └── lanzamiento_emocional/    ← Diapositivas PNG del lanzamiento
└── _archivo/                     ← Versiones anteriores (no publicar)
```

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

`sw.js`, `index.html` y `manifest.webmanifest` deben servirse con
`Cache-Control: no-cache`; el resto puede ir con caché larga, porque el service
worker lo invalida por versión. Sin esa cabecera el service worker queda
congelado en el servidor y **una corrección publicada no llega a quien ya tiene
la app abierta**.

## Color y legibilidad

Los colores de marca (`--coral`, `--purple`) son **colores de fondo**: sobre blanco dan menos de 3:1 y no se pueden usar como texto. Para eso están `--coral-ink` y `--purple-ink`, y `--muted` para el texto secundario.

| Token | Uso |
|---|---|
| `--coral`, `--purple` | Fondos, botones, adornos |
| `--coral-ink`, `--purple-ink` | Los mismos tonos **como letras** sobre fondo claro |
| `--muted` | Texto secundario (5,2:1) |
| `--muted-soft` | El tono claro anterior, solo adornos sin texto |
| `--border-strong` | Bordes de tarjetas que deben destacar sobre el fondo crema |

En las publicaciones ocurre lo mismo pero calculado en caliente: `studioPalette()` deriva del acento de la creadora los tokens `accentInk` (acento legible como texto) y `onAccent`/`onAccentDark` (qué color de letra va sobre cada fondo), midiendo contraste WCAG en vez de fijarlo a ojo.

## Constantes configurables

En `js/app.js` se pueden ajustar sin tocar el resto del código:

```javascript
const IVA     = 0.19;          // Tasa de IVA aplicable
const MARGINS = [30, 50, 80, 120]; // Opciones de margen de ganancia (%)
const CR_MULT = { facil:0.05, moderado:0.15, intenso:0.25, obra:0.40 };
```

## Créditos

Creada por [viviLoaiza.cl](https://viviloaiza.cl) para emprendedoras que necesitan herramientas para cobrar lo que realmente vale su trabajo.

**Queda prohibida su venta o distribución comercial.**
