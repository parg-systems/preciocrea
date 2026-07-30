# Changelog

Historial de cambios de PrecioCrea. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

> **Nota sobre versionado:** La versión **1.0.0** (2026-05-15) marca el primer release público estable, sin etiqueta "BETA". Las entradas fechadas antes de esa (1.1.0 – 1.4.0, de marzo a mayo de 2026) son iteraciones internas de la reorganización del proyecto, anteriores al 1.0.0 pese a llevar un número mayor. De ahí que haya dos entradas `[1.1.0]` y dos `[1.0.0]` en este archivo.
>
> **El siguiente release salta a 1.5.0** para dejar atrás ese solapamiento: `v1.2.0`, `v1.3.0` y `v1.4.0` ya existen como tags de la etapa interna, así que retomar la numeración en 1.1.x habría vuelto a chocar con ellos en dos releases más. Desde 1.5.0 hay un solo hilo de versiones y se aplica semver convencional.

---

## [2.2.0] — 2026-07-30 · miniaturas de producto en la lista

### Añadido

- **La foto del producto deja huella.** Al subir una foto en el Estudio se
  genera una miniatura de 200×200 (JPEG, center-crop sobre fondo blanco,
  ~10-20 KB) que reemplaza al emoji en la tarjeta de la lista de productos,
  con el emoji como fallback cuando no hay foto. La foto grande sigue viviendo
  solo en memoria: la decisión de diseño de no persistirla no cambia.
- La miniatura vive en una clave propia de localStorage (`pc_thumbs_v1`,
  mapa id → data URL con tope de 30 KB por entrada), separada de `pc_v1`:
  el respaldo JSON no la incluye a propósito y `sanitizeImportedProduct`,
  `exportData` e `importData` quedan intactos. Carga defensiva (rechaza
  JSON corrupto, prefijos que no sean JPEG e ids inválidos), poda de
  huérfanos al arranque y borrado junto con el producto. Todo best-effort:
  si la cuota está llena, la subida de foto al Estudio sigue igual, solo
  que sin miniatura.
- Verificado en navegador contra la app corriendo: subida de PNG con
  transparencia (fondo blanco, no negro), persistencia tras recargar,
  arranque limpio con `pc_thumbs_v1` corrupto o con entradas maliciosas,
  eliminación junto al producto y respaldo JSON sin miniaturas. Cero
  errores de consola.
- `BUILD` sube a 9.

## [2.1.1] — 2026-07-30 · CSP completamente estricta: adiós a los estilos en línea

Se paga la última deuda de la CSP: los ~87 atributos de estilo en línea del
marcado (estático y generado por innerHTML) se migraron a clases de
`styles.css` — un bloque nuevo al final de la hoja: acentos de paso, fondos
de iconos, chips, degradados de los botones «siguiente» y utilidades de
espaciado. Los tres casos dinámicos (swatches de color de la marca y del
editor, barras del desglose) se pintan ahora por CSSOM desde JS, que la CSP
sí permite.

- **`style-src` queda en `'self'` a secas**, igual que `script-src`: la CSP
  completa ya no contiene ningún `'unsafe-inline'`.
- El **portable** relaja ambas directivas vía `build-portable.js` (su JS y su
  CSS viajan inline dentro del archivo), con guard que aborta el build si
  alguna sustitución no ocurre.
- Verificado en navegador: apariencia idéntica pantalla por pantalla (inicio,
  calculadora, resultados con sus barras de color, marca con los 8 swatches,
  asistentes con sus acentos, editor del Estudio), cero violaciones en
  consola y continuidad de precios intacta. De paso se validó en vivo el
  flujo del banner de actualización: el SW viejo sirvió la 2.1.0, el banner
  apareció y «Recargar» activó la 2.1.1 limpiando el caché anterior.
- `BUILD` sube a 8.

## [2.1.0] — 2026-07-30 · botón Atrás, CSP estricta y cierre de pendientes

### Añadido

- **El botón Atrás de Android ya no saca de la app.** Retrocede como se
  espera: cierra el modal o la bienvenida si están abiertos, retrocede paso a
  paso dentro de la calculadora, cierra la pantalla activa (resultados,
  detalle, respaldo, guía, asistentes, Estudio — con sus mismos avisos de
  trabajo sin guardar), vuelve a Inicio desde cualquier pestaña, y solo desde
  Inicio, sin nada abierto, sale de la app. Implementado con una entrada
  guardián en `history` que cada `popstate` re-arma y despacha la misma
  acción que harían el ← o Escape.
- **Ficha de instalación enriquecida en Android**: el manifest declara dos
  capturas reales (Inicio y Resultados, `form_factor: narrow`).

### Seguridad

- **CSP sin `unsafe-inline` en `script-src`.** Los 182 manejadores en línea
  (`onclick`/`oninput`/`onchange`, incluidos los del marcado generado por
  JS) se migraron a delegación de eventos con `data-action` / `data-input` /
  `data-change` y tres listeners en `app.js`. Un script inyectado ya no puede
  ejecutarse ni como atributo de evento. `style-src` conserva
  `'unsafe-inline'` (los `style=""` de presentación siguen; deuda aceptada).
- El **portable** es la excepción deliberada: su JS viaja inline dentro del
  archivo, así que `build-portable.js` reescribe la meta CSP para permitirlo
  y falla ruidosamente si esa sustitución no ocurre.

### Corregido

- **«Guardar cambios» sin cambios ya no mueve el precio**: recalcular desde
  las partes redondeadas derivaba ±$1-2 en cada guardado. Ahora es un no-op
  con aviso.
- **Icono de iOS nítido**: `apple-touch-icon` de 180×180 real
  (`icon-180.png`, también precacheado) en vez del de 192 reescalado.
- Metas nuevas: `description` y `mobile-web-app-capable` (adiós al aviso de
  deprecación de Chrome).

### Cambiado

- Los MP3 sin referenciar (~11 MB) salen de `assets/audio/` hacia
  `_archivo/audio/`: se conservan en el repo pero no se publicarían con la
  app.
- `build-portable.js`: además del parche de CSP, quita el `apple-touch-icon`
  (el portable no se instala) y vigila que ninguna referencia a
  `assets/icons/` sobreviva al inlineado.

### Notas

- `BUILD` sube a 7. Fórmulas intactas: el caso de continuidad sigue dando
  $28.162 / $42.243 (verificado en navegador, junto con cero violaciones CSP
  y el recorrido completo del botón Atrás).

## [2.0.1] — 2026-07-29 · revisión general: bugs y experiencia de uso

Auditoría completa de la 2.0.0 (lógica, UI/UX e infraestructura PWA) con
corrección de todo lo encontrado. Las fórmulas de cálculo no se tocaron: el
caso de continuidad (materiales 2.170 · 2,5 h × $8.000 · moderada ·
$80.000/30 u) sigue dando mínimo $28.162 e ideal $42.243.

### Corregido — crítico

- **En iPhone la app moría al arrancar.** `setupInstallPrompt()` leía
  `deferredInstallPrompt` antes de su declaración `let` (zona muerta temporal):
  el `ReferenceError` abortaba el resto de `app.js` y dejaba sin selector de
  icono, sin guía de instalación, sin diálogos de confirmación y sin service
  worker. El arranque ahora vive al final del archivo, donde ninguna
  declaración puede quedar pendiente.
- **El flujo de actualización del service worker no funcionaba.** El
  `skipWaiting()` del install activaba la versión nueva al instante: la página
  se recargaba sola encima de quien estuviera a mitad de un cálculo (también en
  la primera visita) y el banner «Hay una nueva versión» nunca llegaba a operar.
  Ahora el SW espera, el banner es quien dispara la activación, «Recargar» tiene
  respaldo (`location.reload()`) y la primera visita ya no se recarga sola.
- **Fetch del SW endurecido.** Un 404/500 del hosting o una conexión colgada ya
  no tapan la app a quien la tiene en caché (fallo → caché, con tope de 4 s);
  la página «Sin conexión» solo se sirve a navegaciones (a un `.js` fallido le
  llegaba HTML → pantalla en blanco); el caché se consulta acotado al propio
  (`caches.match` global podía servir una copia vieja); el `cache.put` va en
  `waitUntil`.
- **La fila «Instalar en tu teléfono» nunca se ocultaba** con la app ya
  instalada: el `display:flex` de `.settings-row` anulaba el atributo `hidden`.
- **Las miniaturas de estilo de Publicar no elegían el estilo**: las cuatro
  abrían siempre «Tarjeta». Ahora cada una abre el editor con su plantilla.

### Corregido — datos

- **Números a la chilena.** «12.000» en un campo de dinero valía $12 (el
  navegador lo leía como decimal) y «2,5» horas valía 0 con un error confuso.
  Los campos de dinero ahora son enteros (puntos y comas = separadores de
  miles) y las horas aceptan coma o punto decimal.
- **Importar un respaldo cuyos productos venían sin id** les daba a todos el
  mismo (`Date.now()` del mismo milisegundo): borrar uno borraba todos. Se
  reparan al entrar, igual que hace `loadProducts()`.
- **Si el guardado fallaba (cuota llena, Safari privado), memoria y disco
  divergían.** Eliminar, duplicar, importar y «Guardar cambios» ahora deshacen
  el cambio en memoria cuando `localStorage` rechaza la escritura, como ya
  hacía «Guardar producto».
- **El doble toque en Guardar/Duplicar creaba productos repetidos**: los
  botones quedaban vivos durante el 1,4 s previo al cambio de vista. Guarda de
  reentrada en las tres rutas.
- **Los recortes de rango se reflejan en el campo**: escribir 24 h/día ya no
  calcula con 16 mientras la pantalla dice 24.

### Corregido — experiencia de uso

- **Lo tecleado en «Tu marca» sin pulsar Guardar ya no se filtra** a las
  publicaciones, los respaldos ni a la guarda «¿ya configuró su marca?»: todo
  lo que publica y exporta sale ahora de la versión guardada; el formulario
  conserva el borrador al cambiar de pestaña, como siempre. `studioBrandDirty()`
  dejó de mutar el estado al consultarlo, y la intención pendiente («guarda y
  seguimos publicando») caduca al salir del formulario sin guardar.
- **Contraste**: `--muted-soft` pasaba de 2,4:1 sobre el fondo en los rótulos
  de pestañas, placeholders, «PRECIO MÍNIMO» y ayudas; ahora 5,1:1 (y `--muted`
  4,7:1), sin tocar ningún color de marca. La vista previa de «Tu marca»
  oscurece el fondo con acentos claros (el nombre desaparecía sobre mostaza o
  verde), con la misma lógica de contraste del motor de canvas.
- **Toasts**: los avisos largos se cortaban por ambos lados en móvil
  (`white-space:nowrap` sin `max-width`); ahora se parten en líneas. Además se
  anuncian a lectores de pantalla (`role="status"`).
- **Navegación**: las flechas ← de Respaldo y Guía vuelven a la vista de origen
  (antes siempre al inicio); tras guardar o publicar desde resultados ya no se
  pregunta «¿salir sin guardar?»; el aviso de trabajo pendiente ignora los
  campos prellenados por los perfiles guardados; el emoji de resultados respeta
  el icono elegido; `setMargin`/`resetState` quedaron acotados a su vista (no
  pisaban los chips de los asistentes); sin productos, «Publicar» lleva a
  Calcular en vez de dejar un callejón sin salida.
- **Móvil**: los inputs con letra bajo 16 px hacían zoom permanente en iOS
  (materiales, detalle, asistentes, buscador); zonas de toque ampliadas en los
  «?» de ayuda (20 px reales), el ✕ de materiales, la ✕ del buscador y la
  papelera (que además estaba al 40 % de opacidad, casi invisible sin hover).
- **Accesibilidad**: etiquetas (`<label for>`/`aria-label`) en todos los campos
  de la calculadora, asistentes, marca y Estudio; las opciones de creatividad,
  el acordeón de la guía y las tarjetas responden a teclado
  (`role="button"`, Enter/Espacio, `aria-expanded`/`aria-pressed`);
  `aria-current` en la pestaña activa; los diálogos mueven el foco al abrir,
  lo devuelven al cerrar y atrapan Tab; la guía de instalación cierra con
  Escape y con el fondo; el fondo no se desplaza bajo los modales.
- **Menores**: el respaldo exportado añade el `<a>` al documento antes del
  click (en navegadores antiguos no descargaba pero decía «descargado»);
  `confirmDialog` no puede quedarse trabado si algo lanza a medio armar; el
  selector de icono no duplica listeners al abrirse dos veces; la bienvenida no
  reaparece en la misma sesión con el almacenamiento bloqueado; el editor del
  Estudio vacía su marcado al cerrarse; los avisos de los asistentes aclaran
  cómo se reparte el arriendo: en el valor hora van los gastos de la casa
  completos (fijan el sueldo objetivo); en costos fijos, si la casa es también
  el taller se cobra la fracción que este ocupa, y si el taller es arrendado
  aparte, la fracción de la casa va en 0% y ese arriendo entra como gasto del
  negocio — nunca los dos a la vez.

### Notas

- `BUILD` sube a 6. Recordatorio para el hosting: `sw.js`, `index.html` y
  `manifest.webmanifest` deben servirse con `Cache-Control: no-cache` (se
  configura en el panel del proveedor, no en el repo).
- Pendientes documentados para otra ronda: botón Atrás de Android
  (`history`/`popstate`), deriva de ±$1-2 al reguardar el detalle sin cambios,
  `screenshots` del manifest y `apple-touch-icon` de 180 px.

## [2.0.0] — 2026-07-28 · rediseño completo de la interfaz

Se aplica el rediseño 2.0 que estaba en `_archivo/PrecioCrea 2.0 aniversario/`.
Era una maqueta de diseño (formato Design Component: navegable, sin lógica real),
así que aquí se lleva a la app: piel nueva y arquitectura de información nueva,
**sin tocar una sola fórmula de cálculo ni el motor de publicaciones**. Un
producto calculado en la 1.6.0 da exactamente el mismo precio en la 2.0.0, y las
imágenes que genera el Estudio son idénticas píxel a píxel.

Es un salto mayor de versión por la navegación: quien abra la app se va a
encontrar con otra estructura, no con la misma pantalla repintada.

### Añadido

- **Barra de pestañas.** Cuatro secciones fijas abajo — Calcular ✨ · Productos 🎨
  · Publicar 📸 · Tu marca 👤 — en vez del scroll único de ocho bloques que era el
  home. Las pantallas de trabajo (calculadora, resultados, detalle, respaldo,
  guía, estudio) pasan a ser *sheets*: ocupan todo y esconden el encabezado y la
  barra, para que no compitan con lo que la creadora está haciendo.
- **Pantalla de bienvenida de aniversario.** Sustituye a la cinta fija que
  aparecía en todas las pantallas. Se muestra una sola vez (clave
  `pc_welcome_20`) y queda siempre a mano en la píldora del encabezado. Absorbe
  el onboarding "Antes de empezar", que deja de ser una tarjeta suelta del home.
- **Buscador de productos.** Filtra por nombre y descripción, sin acentos ni
  mayúsculas ("jabon" encuentra "Jabón de lavanda"). Aparece a partir de cuatro
  productos guardados; por debajo de eso la lista se recorre de un vistazo.
- **"Publícalo hoy mismo"** al final de los resultados: guarda el producto y
  abre el Estudio de una vez, en lugar de obligar a guardar, volver a la lista y
  entrar por separado.
- **"Los 4 pilares"** en la pestaña Calcular: explica de qué está hecho un precio
  antes de calcular ninguno. Antes el home vacío no decía nada.
- **Asistente de valor hora.** El paso 2 pedía el número más difícil de la app
  —cuánto vale tu hora— con un globo de ayuda como única guía. Ahora hay un
  asistente opcional, pensado para quien trabaja desde su casa, que llega ahí
  por partes: cuánto necesitas ganar al mes (con el gasto del hogar desglosado y
  montos de referencia de Santiago, editables), cuánto tiempo puedes dedicarle,
  cuánto de ese tiempo se cobra de verdad y cuánto se llevan AFP, salud e
  impuestos. El resultado se compara con el mínimo legal por hora y avisa si
  queda por debajo. Se abre desde el paso 2, desde la guía y desde «Tu marca».
- **Asistente de costos fijos.** El hermano del anterior, para el paso 4, con la
  misma lógica: la parte de tu casa que ocupa el taller (con el arriendo y las
  cuentas ya sembrados desde el asistente de valor hora, si lo usaste), los
  gastos que existen solo por el negocio, la cuota mensual de tus herramientas y
  las unidades que produces al mes. El resultado dice cuánto carga cada producto
  y qué pasa si no lo cobras. Los dos asistentes se reparten el trabajo sin
  solaparse: en el del valor hora los gastos del hogar quedan fuera **a
  propósito**, porque la proporción que le toca al negocio se cobra aquí.
- **El valor hora y los costos fijos se pueden guardar y reutilizar.** Con «recordar este valor»,
  cada producto nuevo arranca con ellos ya puestos y una fila lo anuncia — los
  números nunca aparecen por arte de magia. Viven en `pc_rate_v1` y `pc_fixed_v1`
  y viajan en el respaldo, que pasa a `version: 4` (v1, v2 y v3 se siguen
  importando igual).
- **Los 4 pilares llevan a la guía.** Cada tarjeta abre su sección
  correspondiente ya desplegada y con la página posicionada en ella: quien se
  pregunta qué entra en "Creatividad" lo pregunta justo ahí, no en el índice.
- **El logotipo vuelve al inicio** desde cualquier pantalla. Va en el
  encabezado de las pestañas y, en versión compacta, también en las cabeceras
  de las pantallas completas — que es justo donde antes desaparecía. Si hay
  trabajo sin guardar (un cálculo empezado, un resultado sin guardar, un
  producto editado, la marca cambiada o una publicación sin descargar),
  pregunta antes de salir.
- **Muestrario de estilos** en la pestaña Publicar. Las cuatro miniaturas se
  dibujan con `studioRenderSlide`, el mismo motor que exporta la imagen final,
  con el color de la marca y el primer producto guardado: cada estilo se ve como
  es de verdad —dónde va la foto, dónde el precio, si el fondo es pleno o
  partido— en vez de prometer algo que la publicación no cumple.
- **Sección "Publicar tu precio"** en la guía, que faltaba desde que el Estudio
  existe.

### Cambiado

- **Sistema visual.** Fondo plano `#FBF6F2` en vez del crema con tres manchas
  difuminadas; el color se concentra dentro de las tarjetas. El acento que lleva
  texto pasa del coral luminoso a la frambuesa `#DE3B57` y el violeta `#8E3FD4`
  (el coral se queda para halos y fondos claros). Bordes de 1 px, sombras casi
  planas salvo en las piezas con degradado, botones en píldora y titulares en
  Fraunces 900 con tracking negativo.
- **Resultados y detalle** dejan de mostrar dos cajas de precio en paralelo: el
  precio ideal con IVA es ahora la pieza protagonista y el mínimo queda como una
  fila de referencia debajo.
- **"Tu marca"** deja de estar escondida dentro de Respaldo y pasa a ser una
  pestaña propia, con accesos a Respaldo y a la Guía al final.
- **La versión que se muestra en la guía** decía `v1.5.0` mientras el service
  worker declaraba `1.6.0`. Ahora hay una sola línea, al final de la guía, y dice
  qué versión es, para quién y de quién.
- La barra de progreso de la calculadora pasa de cuatro puntos de tamaño variable
  a cuatro segmentos iguales, con el nombre del paso a la izquierda.

### Corregido

- **El buscador rompía el arranque.** Su variable de estado se declaraba con
  `let` por debajo del bloque de inicio, así que la primera llamada a
  `renderProducts()` caía en la zona muerta temporal y abortaba el resto del
  arranque en silencio — entre otras cosas, la bienvenida no llegaba a aparecer.
  Se declara arriba, junto al estado.
- **Guardar un producto cuando el almacenamiento está lleno** dejaba el producto
  vivo en memoria: la app lo mostraba como guardado y al siguiente arranque había
  desaparecido. Ahora se deshace el alta si la escritura falla.
- **Instalar la app dependía de que el navegador avisara, y a veces no avisa.**
  El aviso «Instalar en tu teléfono» del inicio solo aparece cuando llega el
  evento `beforeinstallprompt`: en escritorio tarda, en Firefox no llega nunca y
  en Android desaparece para siempre si ya se rechazó una vez. Peor: en esos
  casos el botón **no hacía nada**, porque la única guía manual que existía era
  la de iPhone. Ahora hay una fila fija en «Tu marca», siempre disponible salvo
  que la app ya esté instalada, y una guía por plataforma — con el aviso de que
  si no aparece la opción es porque el enlace se abrió dentro de Instagram o
  WhatsApp, que es lo que pasa casi siempre. En el archivo portable dice la
  verdad: esa copia no se instala, y explica por qué.
- **El nombre del caché era la versión, y eso escondió una entrega entera.** El
  service worker guardaba todo bajo `preciocrea-${VERSION}`. Al añadir el
  asistente de valor hora dentro de la misma 2.0.0, la llave del caché no cambió
  y `sw.js` quedó byte a byte idéntico: los navegadores que ya tenían la app
  siguieron sirviendo los archivos viejos **sin mostrar siquiera el banner de
  actualización**. El código estaba publicado y nadie lo veía. Ahora hay un
  `BUILD` aparte de `VERSION`: la versión es lo que se le muestra a la creadora,
  el build es la llave del caché y sube en cada cambio de HTML, CSS o JS.
- **El piso legal por hora estaba desactualizado.** La guía y el globo del
  paso 2 decían «~$1.800/hr en Chile». Con el ingreso mínimo en $500.000 y
  jornada de 42 horas semanales son unos **$2.750** — la app estaba dando un
  suelo un 35% más bajo del real, justo en el pilar que más pesa en el precio.
- **Salir de "Tu marca" a otra pestaña perdía lo escrito.** Al volver, el
  formulario se repintaba desde el estado anterior. Ahora se vuelca antes de
  salir, con `captureBrandForm()`.
- **Los desplazamientos automáticos no llegaban a su destino.** `showView()`
  usaba la forma de dos argumentos de `scrollTo`, que hereda el
  `scroll-behavior: smooth` de la hoja de estilos: lanzaba una animación de
  vuelta arriba que seguía corriendo y pisaba cualquier salto posterior. Ojo al
  tocar esto: `behavior:'auto'` **no** arregla nada — según la especificación
  significa "usa el scroll-behavior calculado", o sea el suave. Hay que pedir
  `behavior:'instant'`.

### Se conserva

Nada de la 1.6.0 se pierde: prohibición de venta, `© viviLoaiza.cl`, el aviso de
marcas registradas y el bloque "Sobre la creadora" con el enlace a Instagram
siguen ahí, rediseñados. La maqueta original los eliminaba.

---

## [1.6.0] — 2026-07-27 · edición de aniversario

Auditoría completa antes del release público: seguridad, funcionalidad y bugs.
Nada de lo de abajo es una funcionalidad nueva — es lo que hacía falta para que
la app aguante estar en manos de gente que no puede reportar un fallo ni
recuperarse de él. **Los datos viven solo en el teléfono de cada creadora**, así
que un error de guardado no tiene vuelta atrás.

### Corregido — datos

- **Lo guardado en el navegador entraba sin revisar.** Al importar un respaldo
  cada producto se saneaba campo por campo, pero al arrancar la app el contenido
  de `localStorage` se cargaba tal cual. Si ese dato no tenía la forma esperada
  —un respaldo de una versión antigua, una escritura interrumpida al agotarse la
  cuota, cualquier corrupción— el home reventaba al calcular el promedio y **la
  app quedaba en blanco, sin manera de volver desde el teléfono**. Ahora el
  arranque pasa por el mismo saneo que la importación: lo válido se conserva, lo
  roto se descarta y la app abre siempre.
- **El detalle escribía sobre el producto antes de que la creadora guardara.**
  Cambiar el margen o la carga creativa modificaba el producto en el acto. Al
  salir sin pulsar "Guardar cambios" el cambio seguía vivo, con los precios
  viejos, y el siguiente guardado de cualquier otra cosa lo escribía a disco: un
  producto que decía "margen 120%" con el precio calculado al 50%. **Un precio
  equivocado y silencioso, en una app que existe para dar el precio correcto.**
  Ahora los cambios esperan en un borrador y solo se aplican al guardar.
- **Duplicar un producto podía chocar con otro guardado un segundo después.**
  Los identificadores salían de la hora del sistema y podían repetirse. Con dos
  productos del mismo id, editar o eliminar uno afectaba al otro. Los ids nuevos
  ahora se comprueban contra los existentes, y los repetidos que ya estuvieran
  guardados se reparan al cargar.

### Corregido — la app deja de romperse

- **Enter borraba el producto.** En el aviso de "¿Eliminar producto?" el foco
  arranca en *Cancelar*, pero la tecla Enter confirmaba igual: quien la pulsara
  creyendo que activaba el botón enfocado perdía el producto. Enter ya no
  confirma; el botón que tenga el foco responde por su cuenta.
- **El home no cargaba con el almacenamiento bloqueado.** El recordatorio de
  respaldo era el único punto que leía `localStorage` sin protección, y en un
  navegador con el almacenamiento restringido esa lectura falla y **dejaba la
  pantalla de inicio a medio dibujar**.
- **Sin conexión y sin caché, el service worker respondía con nada**, que para el
  navegador es un error de red y no una página. Ahora hay una pantalla de
  "sin conexión" que además recuerda que los productos siguen guardados.

### Cambiado — actualizaciones y despliegue

- **La app ya no se queda congelada en una versión vieja.** Todo se servía desde
  el caché antes que desde la red, incluida la propia página: publicada una
  corrección, quien ya hubiera abierto la app seguía con la versión anterior
  hasta que el service worker se reemplazara solo. Ahora la página se pide a la
  red primero (con el caché como red de seguridad) y el resto —estilos, código,
  tipografías— sigue viniendo del caché, que es donde corresponde.
- El precacheo distingue lo esencial de lo accesorio: un icono que falte ya no
  impide que la app funcione sin conexión.

### Cambiado — privacidad y accesibilidad

- **Las tipografías dejan de pedirse a Google.** Fraunces y Nunito viven ahora en
  el proyecto. Cada apertura de la app enviaba la IP de la creadora a un tercero,
  y como el service worker no cachea otros orígenes **la tipografía de marca
  desaparecía justo sin conexión**, que es lo que la app promete cubrir. Son las
  variantes variables: 96 KB en total, frente a los 285 KB que pesarían los pesos
  por separado. Sin ningún origen externo, la política de seguridad de contenido
  pudo cerrarse.
- **Se desbloqueó el zoom.** El viewport lo impedía. Esta app es para creadoras de
  todas las edades y algunas simplemente no podían ampliar para leer.

### Añadido

- Iconos de 512×512, incluidos los *maskable* con su zona segura: Android ya no
  recorta el icono al instalar ni muestra una pantalla de bienvenida borrosa. El
  manifiesto declara además `id`, que mantiene la identidad de la PWA estable
  entre despliegues.
- El generador del portable inlinea las tipografías y **aborta si sobrevive
  cualquier referencia externa**, así que el archivo único sigue funcionando con
  doble clic y sin conexión.

### Nota de despliegue

Al publicar, `sw.js`, `index.html` y `manifest.webmanifest` deben servirse con
`Cache-Control: no-cache`. Sin eso, la corrección del punto anterior se pierde:
el servidor congelaría el service worker y las creadoras se quedarían con la
versión vieja igual.

---

## [1.5.0] — 2026-07-25

Primer release con publicaciones. Recoge además las dos rondas de correcciones
que se hicieron sobre la marcha (anotadas abajo como 1.1.1 y 1.1.2, números que
nunca llegaron a publicarse).

### La corrección de legibilidad de la ronda anterior estaba mal enfocada

La ronda anterior arregló el contraste **oscureciendo las letras**. Funcionaba en la medición y rompía la app: el hero del home con texto casi negro sobre el degradado coral no es PrecioCrea. El error de fondo fue tratar un problema de *fondos demasiado claros* como si fuera un problema de *letras demasiado claras*.

Esta versión invierte el criterio: **las letras vuelven a los colores de siempre y lo que se oscurece es el fondo que hay debajo**, conservando el tono. El coral sigue siendo coral, solo que con cuerpo.

- Se revirtieron `--muted` (vuelve a `#9A8FAA`), el logotipo, el hero del home (texto blanco y sus opacidades originales) y `--coral-ink` / `--purple-ink`, que ahora son alias de los colores de marca.
- Se añadieron `--coral-deep`, `--orange-deep`, `--purple-deep`, `--blue-deep` y `--green-deep`: **solo para fondos que llevan letras blancas**. Los tonos claros siguen intactos para adornos, halos y chips.

### Corregido

- **Botones con la letra ilegible.** Afectaba a "Guardar cambios" del detalle, "Guardar producto", "Compartir" y "Descargar" de las publicaciones, "Salir igual" y el resto de botones de confirmación, los cuatro botones "siguiente" del cálculo (uno por pilar), las burbujas de ayuda "?", "Configurar mi marca", "Seleccionar archivo" y el CTA final de la guía.
- **La tarjeta "Precio Ideal".** La etiqueta, el valor con IVA y la nota de abajo iban en blanco sobre el degradado claro, con velos de opacidad encima que remataban el problema. Fondo con cuerpo y opacidades subidas.
- **El enlace "Sitio web" de la guía y del respaldo.** Iba en coral claro mientras el de Instagram, al lado, ya venía en tonos profundos. Ahora hacen juego.
- **La tarjeta verde "Protege tu trabajo"** del respaldo.
- **Al publicar "Sin precio", la descripción salía escrita encima del nombre.** El slot del nombre declara `absorb: ['desc','price']` para quedarse con el espacio de lo que falte y no dejar huecos muertos, pero en las plantillas el orden es nombre → descripción → precio: sin precio, el nombre se estiraba hasta el final del precio **saltando por encima de la descripción**, que sí tenía texto, y como va centrado en su caja acababa dibujado justo sobre ella. Ahora la expansión solo toma huecos contiguos y se detiene en el primer elemento con contenido. Sin precio ni descripción el nombre sigue recentrándose en toda la tarjeta, como antes.
- **El archivo portable salía sin ningún color de marca.** `css/styles.css` se guarda con BOM (U+FEFF). Servida como hoja aparte da igual, porque el navegador lo descarta al decodificar el archivo — por eso `index.html` se veía bien. Pero el build la pega dentro de un `<style>`, y ahí ya no hay decodificación: el carácter queda como texto y el parser de CSS lo lee como el principio de un selector, se traga el comentario de cabecera y convierte la primera regla en `﻿ :root`, que no matchea nada. Esa primera regla es justo la de las variables, así que **el portable perdía la paleta entera** y salía con los colores por defecto del navegador. `read()` quita el BOM de cada archivo fuente, y un guard nuevo aborta el build si aparece cualquier carácter invisible dentro del documento: el fallo anterior se generaba sin avisar y solo se veía al abrir el archivo.
- **Dos tarjetas del home rompían la columna**, cada una por un motivo distinto. "Aún no has respaldado tus productos" es un `<button>`, y los controles de formulario se encogen al contenido en vez de ocupar el ancho disponible: quedaba más estrecha. "Comparte tus productos" no tenía margen lateral y se salía 22 px por cada lado: quedaba más ancha. Las dos comparten ya los 22 px del resto.

### Cambiado

- **La publicación ya no ofrece "Precio ideal" ni "Con IVA" por separado.** Quedan tres modos: **Precio** (el ideal con IVA ya incluido), **Consultar** y **Sin precio**. Un precio publicado es un precio de venta al público y ahí el IVA va siempre incluido; poder publicar el neto llevaba a cobrar de menos. Las marcas ya guardadas en el modo antiguo pasan solas a "Precio".

---

## [1.1.1] — 2026-07-25 · sin publicar

Correcciones tras la primera prueba en teléfono. Recogidas dentro de la 1.5.0.

### Legibilidad — el problema de fondo era la paleta

Varios textos eran casi invisibles. Al medirlos, el origen resultó ser de siempre, no de la versión nueva: **los colores de marca son demasiado claros para usarse como texto**.

- **`--muted` (`#9A8FAA`) daba 2,9:1** sobre el fondo, muy por debajo del mínimo legible de 4,5:1, y se usaba en textos pequeños de toda la app (etiquetas de estadísticas, precios de la lista, pie de página, subtítulos). Ahora es `#736787` → 5,2:1. El tono claro anterior queda como `--muted-soft`, solo para adornos.
- **El hero del home** tenía texto blanco sobre un degradado luminoso: 2,1:1. En vez de apagar el coral, que es el color de la marca, se invirtió el texto a tinta oscura sobre el mismo degradado → 15,4:1. Se quitaron además las opacidades de `.hero-greeting` y `.hero-desc`, que restaban el poco contraste que quedaba.
- **`--coral` y `--purple` como color de letras** daban 2,8:1 y 2,5:1 sobre blanco. Se añadieron `--coral-ink` y `--purple-ink` (5,1:1 y 6,7:1) para cuando el color de marca es el de un texto. Afectaba al logotipo "preciocrea", al botón "Calcular precio" y a los precios de la lista.
- Misma corrección en el motor de publicaciones: el `muted` de la paleta generada.

### Cambiado

- **La tarjeta "Comparte tus productos" no tenía marco.** Sobre el fondo crema, una tarjeta blanca con borde lila pálido no se distinguía. Ahora lleva borde marcado (`--border-strong`), sombra con cuerpo y un filete de color arriba.

### Añadido

- **Descripción del producto.** Campo opcional en el paso 1 y editable en el detalle. Es el texto que aparece en las publicaciones y se suma al mensaje de WhatsApp. Todas las plantillas se reorganizaron para darle sitio.
- **Icono del producto editable.** Se sigue sugiriendo según el nombre, pero ahora se puede elegir entre 40 iconos o **quitarlo**. Sin icono, la publicación no deja un hueco: el círculo que lo contenía desaparece y el resto se recoloca.
- **Logo de la marca.** Se sube desde *Tu marca*, se guarda con el perfil y sustituye al nombre escrito en las publicaciones. Se reduce a 360 px y se guarda en PNG para conservar la transparencia; ocupa unos 40-90 KB frente a los 300-600 KB de una foto de producto, que por eso siguen sin guardarse.
- **Color propio por publicación.** El acento arranca en el de la marca pero se puede cambiar solo para esa pieza, sin tocar el perfil, y volver al de la marca con un toque.

### Corregido

- **Subir el logo borraba el nombre y el @ que se estaban escribiendo**, porque el formulario se repintaba desde un estado que aún no los tenía. Ahora se vuelcan al estado antes de repintar.
- El saneo del logo importado rechaza URLs remotas, `javascript:`, `data:text/html` y SVG (que puede llevar script), además de archivos desmedidos: un respaldo puede llegar por WhatsApp desde cualquier parte.
- El emoji vacío ya no deja espacios sueltos en el mensaje de WhatsApp ni un hueco en la lista del home.

---

## [1.1.0] — 2026-07-25 · sin publicar · Edición de aniversario 🎉

> Esta es la 1.1.0 **posterior** a la 1.0.0, siguiendo semver. No confundir con la 1.1.0 interna de la reorganización, listada más abajo.

### Cinco años de viviLoaiza.cl

- **Cinta superior** con degradado coral → morado → azul y un destello que la cruza cada pocos segundos. Va dentro de `.app` pero fuera de las `.view`, así que acompaña a todas las pantallas sin duplicar marcado. Enlaza a viviloaiza.cl.
- **Tarjeta de aniversario** en el home, en el lugar de la tarjeta de viviLoaiza: distintivo "5 años", mensaje de agradecimiento y los enlaces al sitio y a Instagram.
- La cinta respeta `prefers-reduced-motion`: si el sistema pide menos animación, el destello no se ejecuta.
- La marca conserva su grafía (`viviLoaiza.cl`); solo el "5 AÑOS DE" va en mayúsculas.
- Es contenido conmemorativo y permanente para esta versión. Para retirarlo basta con quitar el bloque `ANIVERSARIO` de `css/styles.css` y su marcado en `index.html`.
- **Las publicaciones no llevan sello de aniversario**: siguen siendo 100% de cada creadora.

### Publicaciones — crea imágenes para Instagram desde tus productos

Hasta ahora la app terminaba en un número: calculabas el precio y quedabas sin nada que publicar. Ahora, desde cualquier producto guardado, se genera la imagen lista para subir.

**La publicación es de la creadora, no de PrecioCrea.** Ella configura su nombre, su Instagram y su color, y todo el material gráfico se dibuja por código (degradados, formas y tipografía sobre Canvas 2D). No se incorporó ni un archivo de imagen nuevo al proyecto.

#### Añadido

- **Vista "Tu marca"** (`#view-brand`): nombre, @ de Instagram, color de acento (8 sugeridos + selector libre), modo de precio por defecto y si mostrar el pie "hecho con PrecioCrea". Se configura una sola vez. Accesible desde Respaldo o desde el primer intento de publicar.
- **Historias 1080×1920** con cuatro estilos: *Tarjeta*, *Bloque*, *Círculo* y *Pantalla completa*. Se eligen con miniaturas que dibujan la plantilla real con los datos reales.
- **Carrusel catálogo 1080×1350 (4:5)**: portada editable + una lámina por producto. Dos estilos emparejados (*Suave* y *Nítido*); portada y láminas cambian juntas. El orden en que se tocan los productos es el orden de las láminas. Máximo 9 productos.
- **Foto del producto**: se elige del teléfono, se corrige la orientación EXIF (las fotos de iPhone ya no salen giradas), se reduce a 1800 px y se encuadra arrastrando sobre la vista previa o con el control de zoom. Nunca puede quedar un borde vacío.
- **Precio opcional en la publicación**: precio ideal, con IVA, "Consulta por precio" o sin precio. Al ocultarlo, el nombre se recentra y los adornos asociados desaparecen — no queda un hueco.
- **Compartir con la hoja nativa** (`navigator.share` con archivos) además de descargar. En iPhone es la acción principal, porque `<a download>` deja la imagen en Archivos y no en Fotos.
- **Aviso al salir sin descargar**: la foto y el encuadre no se guardan en ningún lado, así que salir sin exportar pide confirmación.
- El perfil de marca **viaja dentro del respaldo** (`.json` versión 2). Al importar un respaldo con otra marca, se pregunta antes de reemplazar la propia.

#### Detalles de diseño

- **Los colores se derivan del acento de la creadora**, no se eligen a mano: los fondos y el color de texto se calculan midiendo contraste WCAG, de modo que un acento amarillo, negro o gris medio siga produciendo una publicación legible.
- **El texto se ajusta a su caja**: si el nombre no cabe, primero se reduce la tipografía y solo se recorta como último recurso. Un nombre de 60 caracteres sin espacios se parte por letras en vez de romper el diseño.
- Sin dependencias nuevas: ni librerías, ni imágenes, ni cambios en la política de seguridad (CSP).

#### Corregido

- **`scripts/build-portable.js` generaba un archivo roto.** El contenido de `app.js` se pasaba como cadena de reemplazo a `String.replace`, que interpreta `$'` como patrón especial; la secuencia aparece literalmente en `fmt()` (`return '$' + …`) y se expandía al resto del documento. En el `preciocrea-portable.html` publicado, `fmt()` quedaba con un error de sintaxis que impedía ejecutar todo el script. Ahora el reemplazo se pasa como función y el script **falla ruidosamente** si alguna sustitución no encuentra su patrón, en vez de generar un archivo silenciosamente roto.
- `exportData()` revocaba el object URL inmediatamente después de `click()`, lo que aborta la descarga en algunos WebView de Android. Ahora se revoca con margen.

#### Cambiado

- El botón de acciones del detalle del producto pasa a tres columnas: WhatsApp · Duplicar · **Publicar**.
- `sw.js`: `VERSION` a `1.1.0` y `js/studio.js` añadido a los assets cacheados.

---

## [1.0.0] — 2026-05-15

### Primer release público estable

Marca viviLoaiza presente en home, respaldo y ayuda; flujo simplificado; UI lista para entregar a clientas.

### Marca viviLoaiza en toda la app

- **Tarjeta del home** antes de la tarjeta de Spotify: avatar "vL" + título + dos chips de enlace, **sitio (viviloaiza.cl)** e **Instagram (@viviloaiza.cl)**, este último con gradiente IG y logo SVG oficial.
- **Vista de Respaldo:** reemplazada la caja de "Preferencias" por un bloque "Sobre viviLoaiza" con avatar grande, presentación y los dos enlaces (sitio + Instagram) como botones destacados.
- **Vista de Ayuda:** al final de la guía aparece el bloque "Sobre la creadora" con los mismos enlaces, antes de los botones de acción.
- Todos los enlaces abren en pestaña nueva con `noopener noreferrer` por seguridad.

### UI

- Eliminada la etiqueta **BETA** del header del home — la app pasa a release público.
- Espaciado vertical uniforme entre tarjetas del home (16 px) — antes "Antes de empezar" quedaba pegada a "Instalar en tu teléfono".
- En la vista de Ayuda se mantiene el botón secundario **"Probar con ejemplo"** junto al CTA principal, coherente con la tarjeta de bienvenida.

### Eliminado

- Toggle "Mostrar precios con IVA" en la vista de Respaldo. El IVA queda **siempre activo** en home, detalle, resultados y al compartir por WhatsApp. Motivo: simplificar la app y evitar configuraciones que invitan al error.
- Limpieza asociada: clave `KEY_SHOW_IVA` en localStorage, funciones `isIvaVisible`/`applyIvaPreference`/`toggleShowIva`, clases CSS `.pref-toggle*`, `.pref-switch`, `.pref-slider`, `.hide-iva`.

---

## [1.4.0] — 2026-05-12

### Logos de marca en los botones

- Botón "WhatsApp" en el detalle del producto: ahora muestra el logo oficial verde de WhatsApp en lugar del emoji 📱.
- Botón "Instalar en tu teléfono": el subtítulo lista las plataformas con chips que incluyen los logos de Android (bugdroid verde) y Apple — más claro de un vistazo que es compatible con ambos sistemas.
- Modal de instalación en iPhone: el ícono superior ahora es el logo de Apple (más reconocible que el emoji genérico).
- Footer: disclaimer extendido para cubrir Spotify, WhatsApp, Android y Apple como marcas referenciales de sus respectivos propietarios.

---

## [1.3.0] — 2026-05-12

### Instalación con un toque

- Botón "Instalar en tu teléfono" en el home, visible solo cuando aplica (oculto si la app ya está instalada en modo standalone).
- En Android/desktop Chrome usa el evento `beforeinstallprompt` para abrir el diálogo nativo de instalación con un toque.
- En iOS (donde Apple no expone esa API) abre una guía visual con los 3 pasos de Safari: Compartir → Agregar a inicio → Agregar. Incluye tip para usuarias de Chrome en iPhone (deben usar Safari).
- Toast "🎉 ¡App instalada!" al detectar el evento `appinstalled`.
- Bump `VERSION` a 1.3.0 en `sw.js` para que las instalaciones previas vean el banner "Hay una nueva versión disponible".

---

## [1.2.0] — 2026-05-12

### Calidad y seguridad para las usuarias

#### Correcciones
- **Crítico:** corregido un doble `<script>` que impedía la carga de `js/app.js` en navegadores estrictos. Agregado `<body>` de apertura que faltaba.
- `esc()` ahora también escapa comillas dobles y simples y maneja `null`/`undefined`.

#### Seguridad de datos
- Validación y sanitización del archivo importado: límite de 1 MB, reconstrucción de cada producto desde cero (rechaza campos desconocidos, valida tipos, longitudes y rangos).
- Mensajes diferenciados para archivo grande, sin productos, ningún producto válido y productos ya existentes.
- Nuevo helper `persistProducts()` con aviso claro cuando `localStorage` falla (cuota llena, Safari modo privado) — reemplaza los `try/catch` mudos en `saveProduct`, `delProduct`, `saveDetProduct` e `importData`.
- Modal de confirmación reutilizable antes de eliminar productos, con cierre por ESC/backdrop y foco en "Cancelar" por defecto.

#### PWA
- `sw.js` y `manifest.webmanifest` como archivos reales (antes se generaban inline con `Blob`/`URL.createObjectURL`).
- Service Worker con `VERSION` explícita, limpieza de caches antiguos en `activate` y soporte para `SKIP_WAITING`.
- Ícono PNG real en `assets/icons/icon-192.png` (decodificado desde el data URI embebido).
- Banner "Hay una nueva versión disponible — Recargar" cuando el SW detecta un update.

#### Endurecimiento
- Meta `Content-Security-Policy` restrictiva en `index.html` (default `'self'`, manifest/worker mismo origen, object/frame externos bloqueados, Google Fonts permitido).
- `maxlength` en inputs de texto (100/60 chars), `max` en inputs numéricos (100M/9999h/100k unidades) e `inputmode` para teclado numérico móvil.
- `sanitizeNum()` capea con `Math.min(n, MAX_INPUT_NUM)` además de rechazar `NaN`/`Infinity`/negativos.

#### UX de confianza
- Banner de recordatorio inteligente: cuenta productos sin respaldar y días desde el último backup; estado "urgente" amarillo si pasaron 7+ días o hay 3+ productos nuevos.
- Banner de onboarding descartable la primera vez con CTA "Probar con ejemplo" (jabón de lavanda pre-rellenado).
- Toggle "Mostrar precios con IVA" persistente en la vista de respaldo.
- Botón "📱 WhatsApp" en el detalle del producto: abre `wa.me` con mensaje pre-armado (nombre, precio, c/IVA si está activo).
- Botón "📋 Duplicar" en el detalle: crea una copia para variantes del producto.

#### Documentación
- `docs/QA_CHECKLIST.md` con escenarios manuales a pasar antes de cada release (smoke test, onboarding, backup/restore, robustez, validaciones, compartir, IVA, PWA, seguridad, layout).

---

## [1.1.0] — 2026-05-09

### Reorganización y mejora del proyecto

#### Estructura
- Separado el archivo monolítico `preciocrea.html` en tres archivos:
  - `index.html` — estructura HTML
  - `css/styles.css` — todos los estilos (~1.400 líneas de CSS)
  - `js/app.js` — toda la lógica (~620 líneas de JavaScript)
- Creadas carpetas `assets/audio/`, `assets/docs/`, `slides/` para organizar multimedia y documentos
- Archivos duplicados y versiones anteriores movidos a `_archivo/`
- PPTXs renombrados a nombres descriptivos sin sufijos de versión
- Diapositivas PNG organizadas por tema en `slides/`

#### Código
- Extraída constante `IVA = 0.19` (antes `1.19` hardcodeado en 8 lugares)
- Extraída constante `MARGINS = [30, 50, 80, 120]` (antes array literal repetido)
- Service Worker actualizado a versión `pc-v3` con caché extendido para los nuevos archivos separados
- Añadido `</body></html>` que faltaba en el HTML original
- Inicializado repositorio git con control de versiones

#### Documentación
- Creado `README.md` con descripción, estructura y guía de uso
- Creado `CHANGELOG.md` (este archivo)
- Creado `.gitignore` apropiado para el proyecto

---

## [1.0.0] — 2026-03-08

### Lanzamiento inicial

#### Aplicación
- Calculadora de precios con flujo de 4 pasos (materiales, tiempo, creatividad, costos fijos)
- Vista de resultados con precio mínimo y precio ideal
- Selector de márgenes de ganancia: 30%, 50%, 80%, 120%
- Cálculo automático de precios con y sin IVA (19%)
- Lista de productos guardados con estadísticas

#### Funcionalidades
- Guardado de productos en localStorage
- Vista de detalle/edición de productos guardados
- Eliminación de productos
- Exportación de datos a JSON (respaldo)
- Importación de respaldo JSON (merge sin duplicados)

#### Interfaz
- Diseño mobile-first con paleta coral/púrpura/amarillo
- Animaciones CSS y transiciones entre vistas
- Tooltips contextuales en cada campo del formulario
- Tarjeta link al podcast en Spotify

#### Guía integrada
- Vista de ayuda con 7 secciones expandibles
- Explicación de cada pilar del precio con ejemplos reales
- Sección de errores comunes
- Mantras para emprendedoras

#### PWA
- Service Worker para funcionamiento offline
- Web App Manifest para instalación como app nativa
- Ícono embebido en base64
