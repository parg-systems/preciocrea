# Checklist de QA manual — PrecioCrea

Pasar todos los escenarios antes de publicar una versión nueva.

> **Antes que nada: subir `BUILD` en `sw.js`.** En cada entrega que toque HTML,
> CSS o JS, aunque `VERSION` no cambie. Si no, el service worker sigue sirviendo
> los archivos viejos, no aparece el banner de actualización, y estarás probando
> —y publicando— la versión anterior sin darte cuenta.

> **Solo para el lanzamiento público: borrar `robots.txt`.** Mientras el sitio
> está en pruebas ese archivo bloquea a todos los buscadores con `Disallow: /`.
> Si sobrevive al día del lanzamiento, `preciocrea.parg.cl` nace invisible para
> Google. No aplica a las entregas de prueba: solo a la que abre el sitio al público.

## Smoke test (5 min)

- [ ] Abrir `index.html` directo en navegador local — la app renderiza sin errores en la consola.
- [ ] Crear un producto desde cero: ingresar nombre, agregar 2 materiales, llenar tiempo, elegir nivel creativo, costos fijos. El resultado muestra precios mínimo e ideal.
- [ ] El producto aparece en la pestaña **Productos** y al recargar sigue ahí.
- [ ] Abrir el producto, editar el valor de materiales, guardar. Se actualizan los precios.
- [ ] Eliminar el producto — el modal de confirmación aparece y muestra el nombre. Confirmar borra; cancelar lo conserva.

## Navegación (pestañas y sheets)

- [ ] Las cuatro pestañas alternan y **marcan su botón** en la barra inferior: Inicio, Productos, Publicar, Tu marca.
- [ ] **Los 4 pilares llevan a la guía.** Cada tarjeta abre su sección (Materiales, Tu tiempo, Creatividad, Costos fijos) **desplegada** y con la página posicionada en ella; las demás quedan cerradas. El botón `?` del encabezado abre la guía arriba, con la primera sección abierta.
- [ ] **El logotipo vuelve al inicio** desde las cuatro pestañas y también desde calculadora, resultados, detalle, respaldo, guía y las dos vistas del Estudio.
- [ ] **Pregunta antes de salir** si hay trabajo sin guardar: cálculo con algo escrito, resultados sin guardar, detalle con un valor o margen cambiado, "Tu marca" con cambios, publicación sin descargar. "Seguir aquí" deja todo como estaba.
- [ ] **No pregunta** cuando no hay nada que perder: calculadora recién abierta y en blanco, detalle sin tocar, cualquier pestaña.
- [ ] En la calculadora, el logotipo y la barra de progreso **caben en la misma fila** también a 320px.
- [ ] Escribir el nombre de la marca, cambiar de pestaña y volver a "Tu marca": **lo escrito sigue ahí**.
- [ ] Al abrir cualquier sheet (calculadora, resultados, detalle, respaldo, guía, estudio) **desaparecen encabezado, píldora de aniversario y barra inferior**.
- [ ] Cada ← vuelve donde corresponde: detalle → Productos, estudio → Publicar. Respaldo y guía vuelven **a donde se abrieron**: desde «Tu marca» → Tu marca, desde el encabezado o los pilares → la pestaña donde se estaba.
- [ ] La barra inferior **nunca tapa** el último bloque de ninguna pestaña, ni el toast ni el banner de nueva versión.
- [ ] En iPhone con barra de gestos, la barra de pestañas respeta el área segura (no queda pegada al borde).

## Bienvenida de aniversario y primer uso

- [ ] En una pestaña incógnita (sin localStorage previo): aparece la pantalla de aniversario **antes que la app**.
- [ ] Dice exactamente: «Cinco años de **viviLoaiza.cl** acompañando a creadores. Gracias por confiar. 💛» — con el corazón amarillo.
- [ ] "Entrar a PrecioCrea" la cierra. Recargar: **no vuelve a aparecer**.
- [ ] La píldora «🎉 5 años de viviLoaiza.cl» del encabezado la **reabre** en cualquier momento.
- [ ] "Probar con un ejemplo" la cierra y prellena la calculadora con el jabón de lavanda.
- [ ] En una pantalla corta (DevTools, 640 px de alto) la bienvenida **se desplaza** y el botón sigue alcanzable.

## Buscador de productos

- [ ] Con menos de 4 productos el campo de búsqueda **no aparece**.
- [ ] Con 4 o más, buscar "jabon" (sin tilde) encuentra "Jabón de lavanda".
- [ ] Buscar texto que no existe muestra el estado vacío con el término buscado, no una lista en blanco.
- [ ] La ✕ limpia la búsqueda y devuelve la lista completa.
- [ ] Guardar o eliminar un producto con una búsqueda activa **no deja la lista desincronizada**.

## Backup y restore

- [ ] Con productos guardados, "Descargar respaldo" genera un archivo `preciocrea-respaldo-YYYY-MM-DD.json` válido (abrirlo en un editor, debe ser JSON con `app: "PrecioCrea"`, `version: 4`, `products: [...]`, `brand: {...}`, `rate` y `fixed`).
- [ ] Importar un respaldo **v2 (sin `rate`)** y uno **v3 (sin `fixed`)**: entran sin errores y lo que falta no se toca.
- [ ] Importar un respaldo con `rate` o `fixed` corruptos (`{"rate":"HOLA"}`): se descartan sin tumbar la importación de los productos.
- [ ] Importar un respaldo **antiguo (versión 1, sin `brand`)**: importa los productos y la marca local no se toca.
- [ ] Importar un respaldo con **otra marca**: pregunta antes de reemplazar. Al declinar, se conserva la marca propia.
- [ ] Importar un respaldo que solo trae marca (sin productos): la aplica en vez de decir "no tiene productos".
- [ ] Después del export, el banner de recordatorio desaparece.
- [ ] Importar el mismo archivo: muestra "Estos productos ya están guardados".
- [ ] Importar un archivo con un producto distinto: lo agrega sin duplicar los existentes.
- [ ] Importar un archivo que no es JSON (ej. un `.txt`): toast "Archivo inválido", sin crash.
- [ ] Importar un archivo `.json` mal formado (ej. `{"products": [{"name": null}]}`): los inválidos se descartan, el toast dice "Ningún producto válido" o cuenta los válidos.
- [ ] Importar un archivo > 1 MB: toast "Archivo demasiado grande".

## Robustez de datos

- [ ] En **Safari modo privado** (iOS): crear un producto. Al fallar `localStorage.setItem`, aparece un toast claro indicando que no se pudo guardar.
- [ ] Llenar localStorage manualmente hasta el tope (DevTools → Application → localStorage → llenar con strings grandes) e intentar guardar: el toast indica "Sin espacio para guardar".
- [ ] **Almacenamiento corrupto.** En la consola, `localStorage.setItem('pc_v1','{"a":1}')` y recargar. La app abre vacía y usable, **no en blanco**. Repetir con `'[null,42,"texto"]'` y con `'{no es json'`.
- [ ] **Almacenamiento bloqueado.** Deshabilitar todas las cookies/datos de sitio para el dominio y abrir: el home se dibuja completo (con el aviso de que no se puede guardar), no a medias.
- [ ] Un respaldo con **dos productos del mismo `id`**: al cargar quedan como productos independientes; editar uno no cambia el otro.

## Integridad de los precios

- [ ] **Cambios descartados no se guardan.** Abrir un producto, cambiar margen y carga creativa, volver al inicio **sin pulsar "Guardar cambios"**, guardar otro producto cualquiera y recargar: el primero conserva su margen y su precio originales.
- [ ] **Cambios confirmados sí se guardan.** Lo mismo pero pulsando "Guardar cambios": el margen nuevo queda, y el precio ideal **corresponde a ese margen** (no al anterior).
- [ ] **Duplicar y guardar seguido.** Duplicar un producto e inmediatamente guardar otro nuevo: los dos aparecen en el home y se editan y eliminan por separado, sin que uno afecte al otro.
- [ ] Importar un respaldo hecho en otro teléfono: el recordatorio avisa de que esos productos **aún no están respaldados aquí**.

## Asistente de valor hora

- [ ] **Aritmética.** Sin tocar nada, el resultado es **$8.300** ($1.170.000 de hogar × 50% = $585.000 · 5 días × 6 h × 4,33 = 130 h · 65% = 85 h cobrables · +20% ÷ 85).
- [ ] Cambiar un solo dato mueve el número como corresponde: negocio al 100% → ~$16.500 · 3 días → ~$13.800 · sin cotizaciones → ~$6.900.
- [ ] **Lo que se muestra es lo que se usa.** El número de «horas cobrables» de la fórmula, dividido a mano, da el mismo valor hora de la tarjeta.
- [ ] **Piso legal.** Con una meta baja y muchas horas el aviso se pone rojo («bajo el mínimo legal»); al subir la meta vuelve a verde.
- [ ] **Doble conteo.** El aviso «aquí van los gastos de tu casa, los del negocio van en el paso 4» está visible sin desplegar nada.
- [ ] Los dos caminos del bloque 1 funcionan: «Ayúdame a calcularlo» (desglose) y «Ya lo sé» (un solo monto).
- [ ] **Guardar y reutilizar.** Marcar «recordar», usar el valor, recargar la app y empezar un producto nuevo: el campo del paso 2 viene relleno y la fila azul lo anuncia. Desmarcar y comprobar que deja de rellenarse y la fila desaparece.
- [ ] **Reapertura.** Volver a abrir el asistente muestra *sus* montos, no las referencias.
- [ ] Los **tres accesos** (paso 2, guía, «Tu marca») abren el asistente, y el ← devuelve a cada origen. Volver al paso 2 conserva lo que ya estaba escrito en el cálculo.
- [ ] La fila de «Tu marca» resume el valor guardado; sin valor dice «Calcúlalo una vez y reutilízalo».
- [ ] **Almacenamiento bloqueado.** Con las cookies del sitio bloqueadas, «Usar este valor» igual lo lleva al paso 2 y avisa de que no se pudo recordar.
- [ ] A **320px**: las seis filas de gasto no se solapan con su monto, los 7 días caben en una fila y no hay desplazamiento horizontal.
- [ ] **Los montos son de referencia, no un dato.** La nota al pie lo dice, con su fecha, y todos los campos se pueden cambiar.

## Asistente de costos fijos

- [ ] **Aritmética.** Sin tocar nada: ($450.000 + $120.000) × 15% = **$85.500** de casa · **$32.500** del negocio · $250.000 ÷ 36 meses = **$6.944** → total **$124.944**, que entre 30 unidades son **$4.165 por producto**.
- [ ] La proporción de la casa mueve el total: 25% → ~$218.000 · 0% («taller aparte») → ~$39.400.
- [ ] **Siembra desde el valor hora.** Calcular primero el valor hora con un arriendo distinto (ej. $620.000) y abrir después este asistente: el arriendo y las cuentas vienen con esos montos y la nota dice de dónde salieron.
- [ ] **Sin solaparse con el paso 2.** El aviso «solo la parte del negocio» está visible, y el del asistente de valor hora remite al paso 4. El arriendo no debe cobrarse en los dos.
- [ ] **Entrega los dos campos del paso 4:** gastos fijos **y** unidades al mes.
- [ ] **Guardar y reutilizar.** Marcar «recordar», usar los valores, recargar y empezar un producto nuevo: los dos campos vienen rellenos y la fila verde lo anuncia. Desmarcar → vuelven a vacío y unidades a 20.
- [ ] **Reapertura.** Volver a abrirlo muestra *sus* montos, no las referencias.
- [ ] Los **tres accesos** (paso 4, guía, «Tu marca») funcionan y el ← devuelve a cada origen.
- [ ] **Almacenamiento bloqueado.** Aplica los valores igual y avisa de que no se pudieron recordar.
- [ ] A **320px** las filas no se solapan con su monto, los 4 chips de proporción caben y no hay desplazamiento horizontal.

## Validaciones de entrada

- [ ] Nombre del producto vacío: no permite avanzar (toast "Ponle nombre").
- [ ] Materiales sin costo positivo: no permite avanzar.
- [ ] Horas o valor hora en 0: no permite avanzar.
- [ ] Escribir un valor enorme (ej. 999999999999999): el cálculo se capea, no muestra `NaN` ni infinitos.
- [ ] Pegar caracteres no numéricos en un input numérico: `parseMonto`/`parseHoras` los normalizan a 0.
- [ ] **Escritura a la chilena.** «12.000» en un material vale $12.000 (no $12) y «2,5» horas avanza y calcula 2,5 (no bloquea con "mayor a 0").
- [ ] Escribir 24 en «horas por día» del asistente: el campo se corrige a 16 y la fórmula usa 16.

## Compartir y duplicar

- [ ] Botón WhatsApp abre wa.me en pestaña nueva con el mensaje pre-armado, incluyendo nombre, precio y línea c/IVA.
- [ ] Botón "Duplicar" crea una copia con sufijo "(copia)" en el nombre y fecha de hoy. La copia es independiente de la original.

## Legibilidad (revisar con el teléfono al sol, no solo en el escritorio)

- [ ] Pestaña Calcular: saludo, título y descripción del hero se leen con claridad, **en blanco sobre el degradado coral**; el logotipo "preciocrea" en frambuesa y violeta, con el distintivo `2.0`.
- [ ] La bienvenida de aniversario: el `5`, «años juntas», el párrafo y los dos bloques de filas se leen sobre el degradado.
- [ ] Las tarjetas oscuras del Estudio (teaser del home, hero de Publicar, puente de resultados, "Publicar este producto" del detalle) tienen texto blanco legible y el distintivo amarillo "Nuevo" se lee en su fondo.
- [ ] Ningún botón de letra blanca se pierde en su fondo. Recorrer: "Guardar producto", "Guardar cambios", "Guardar mi marca", los cuatro "siguiente" del cálculo, "Compartir" y "Descargar" del Estudio, "Crear una historia", "Seleccionar archivo", "Salir igual" de los avisos, "Empezar a calcular" de la guía.
- [ ] Tarjeta "Precio ideal · con IVA": se leen la etiqueta, el valor grande y la nota con el neto y el margen.
- [ ] Fila "Precio mínimo": el valor y la nota de la derecha no se pisan en pantallas estrechas.
- [ ] Enlaces "Sitio web" e "Instagram" (guía): los dos igual de legibles.
- [ ] **Regla al tocar colores:** si el color va de **letras**, se usa el tono con cuerpo (`--coral-deep`, `--coral-ink`, `--violet`, `--muted`) — el coral y el morado luminosos son fondo, no letra. Si el problema es que unas letras blancas se pierden, lo que se oscurece es el **fondo**: `--coral-deep`, `--orange-deep`, `--violet-deep`, `--blue-deep`, `--green-deep`. Nunca al revés.

## Producto — descripción e icono

- [ ] Al escribir el nombre, el icono se sugiere solo (ej. "Aros" → 💎).
- [ ] Tocar el icono abre la parrilla; al elegir otro, **escribir un nombre distinto ya no lo pisa**.
- [ ] "Sin icono" lo deja vacío: la lista de Productos muestra el 🎨 de reserva sin hueco y el mensaje de WhatsApp no queda con espacios sueltos.
- [ ] La descripción se guarda, se ve en la lista de Productos y se puede editar desde el detalle.
- [ ] Producto con descripción larga (160 caracteres): en la publicación se reparte en dos líneas y reduce el tamaño; no desborda ni pisa el precio.

## Publicaciones — logo y color

- [ ] Subir un logo desde *Tu marca* **después de escribir el nombre y el @**: al volver, los campos siguen con lo escrito.
- [ ] El logo aparece en la publicación **en lugar** del nombre escrito, sin invadir la línea del `@`.
- [ ] Probar los cuatro estilos con un logo oscuro: en "Pantalla completa" y "Bloque" el fondo es oscuro, así que conviene un logo claro (la app lo advierte).
- [ ] "Quitar" el logo lo borra y vuelve el nombre escrito.
- [ ] Cambiar el color dentro del editor afecta solo a esa publicación; el perfil de marca no cambia y aparece "↺ Volver al de mi marca".
- [ ] Importar un respaldo cuyo `logo` sea una URL remota, un `javascript:` o un SVG: se descarta sin aplicarse.

## Publicaciones — perfil de marca

- [ ] Sin marca configurada, tocar 📸 en un producto lleva a *Tu marca*, y al guardar **continúa al editor** (no vuelve a Publicar: la intención no se pierde).
- [ ] Con la marca ya guardada y sin intención pendiente, "Guardar mi marca" lleva a la pestaña **Publicar**.
- [ ] La tarjeta de marca del hub de Publicar refleja el nombre y el @ guardados; sin marca dice "Configura tu marca".
- [ ] **Las cuatro miniaturas del hub se ven distintas entre sí** y cada una corresponde a su estilo: Tarjeta (tarjeta blanca flotando), Bloque (bloque de color abajo), Círculo (círculo centrado), Pantalla completa (fondo pleno oscuro).
- [ ] **Tocar una miniatura abre el editor en ESE estilo** (elegir producto y comprobar que la plantilla activa es la tocada, no siempre «Tarjeta»). Volver al hub y entrar con el 📸 de un producto: vuelve al estilo por defecto.
- [ ] Las miniaturas usan **el color de la marca** y el primer producto guardado. Cambiar el color en *Tu marca* y volver a Publicar: se repintan con el color nuevo.
- [ ] Sin ningún producto guardado, las miniaturas se dibujan igual (producto de muestra), no salen en blanco.
- [ ] Escribir el @ como `@@Telar/De.Luna!` guarda `TelarDe.Luna` — se descartan arrobas y caracteres inválidos.
- [ ] La vista previa del formulario cambia de color al tocar cada muestra y al usar el selector libre.
- [ ] Recargar la app conserva la marca. En DevTools, `pc_brand_v1` pesa menos de 200 bytes.

## Publicaciones — historia

- [ ] Probar los 8 acentos sugeridos **más un amarillo puro (`#FFFF00`) y un gris medio (`#808080`)**: en los cuatro estilos, nombre, precio, marca y @ se leen siempre. Ningún texto queda del mismo color que su fondo.
- [ ] Nombre largo ("Amigurumi personalizado gigante edición limitada de invierno"): se reparte en dos líneas y **reduce el tamaño**; no se corta con "…" ni pisa el precio.
- [ ] Nombre de 60 caracteres sin espacios: se parte por letras, no se desborda.
- [ ] Los tres modos de precio. Con "Precio", el número coincide con la línea c/IVA del detalle (nunca con el neto). Con "Consultar" sale el texto "Consulta por precio".
- [ ] **"Sin precio" con las dos combinaciones de descripción**, porque el hueco se reparte distinto:
  - Con descripción: nombre y descripción quedan separados, cada uno en su sitio. **No deben superponerse.**
  - Sin descripción: el nombre se recentra ocupando todo el espacio libre de la tarjeta, sin hueco muerto ni píldora vacía.
- [ ] Foto horizontal, vertical, cuadrada y un PNG con transparencia: todas llenan el hueco sin deformarse ni dejar borde.
- [ ] **Foto de iPhone tomada en vertical**: sale derecha, no girada.
- [ ] Arrastrar la foto a los cuatro extremos con el zoom al máximo: nunca aparece borde vacío. "↺ Centrar" la devuelve al inicio.
- [ ] Archivo que no es imagen o de más de 20 MB: toast claro, sin crash.
- [ ] La imagen descargada mide exactamente **1080×1920** y se ve **idéntica a la vista previa**.
- [ ] Salir con "←" sin haber descargado: pregunta. "Seguir editando" conserva la foto; "Salir igual" vuelve a la pestaña Publicar.
- [ ] Tras descargar, salir ya no pregunta.
- [ ] **"Publícalo hoy mismo"** al final de los resultados: guarda el producto (aparece en Productos) **y** abre el editor con ese producto, en un solo paso. Con el almacenamiento lleno, avisa y **no** abre el editor.

## Publicaciones — catálogo

- [ ] "Seleccionar varias" marca hasta 9. Al intentar la décima: toast de máximo.
- [ ] El orden en que se tocan los productos es el orden de las láminas (los números del círculo lo confirman).
- [ ] Escribir el título de portada y luego marcar/desmarcar un producto **no borra lo escrito**.
- [ ] Cambiar de estilo cambia la portada **y** las láminas a la vez, manteniendo la misma estética.
- [ ] Los chips de lámina cambian los campos editables: la portada muestra título y bajada; las láminas, nombre y precio.
- [ ] "Descargar las N láminas" baja los archivos numerados `-01`, `-02`… en orden. En Android Chrome aparece el permiso de descargas múltiples.
- [ ] Tocar el botón dos veces seguidas no duplica ni corrompe las descargas.

## Publicaciones — compartir, offline y memoria

- [ ] **Android Chrome (PWA instalada):** "📤 Compartir" abre la hoja nativa e Instagram aparece como destino.
- [ ] **iPhone Safari:** la acción principal del carrusel es "Compartir las N láminas" (no descargar) y llegan a Fotos. Ningún texto de la app promete "galería" en iOS.
- [ ] Cancelar la hoja de compartir **no descarga nada** a espaldas de la usuaria.
- [ ] **Modo avión / DevTools Offline:** aparece el aviso de tipografía de respaldo y la imagen exportada usa **la misma fuente que la vista previa** (mismo layout, distinta tipografía, ningún texto desbordado).
- [ ] Carrusel de 9 productos con foto en un teléfono de gama baja (o CPU 6× lenta en DevTools): no se cierra la pestaña; menos de ~1,5 s por lámina.
- [ ] En DevTools → Application → localStorage: **ninguna clave contiene base64**. Las fotos no se guardan.

## Publicaciones — file:// y portable

- [ ] Abrir `index.html` con doble clic: se puede crear y descargar una historia, sin errores en consola.
- [ ] `node scripts/build-portable.js` termina sin error. Si falla, **no publicar**: significa que algo no se inlineó.
- [ ] Buscar `<script src="js/` dentro de `preciocrea-portable.html`: **cero resultados**.
- [ ] La meta CSP del **portable** dice `script-src 'self' 'unsafe-inline'` **y** `style-src 'self' 'unsafe-inline'` (su JS y su CSS viajan inline; sin eso abre en blanco o sin paleta). La de `index.html` NO lleva `unsafe-inline` en ninguna directiva.
- [ ] Buscar `function fmt(n)` en el portable: la línea siguiente debe ser `return '$' + Math.round(n)…`, sin HTML incrustado.
- [ ] Abrir el portable con doble clic y descargar una historia con foto.

## Marca viviLoaiza, créditos y legales

- [ ] Pie de la pestaña Calcular: "Creada con amor por **viviLoaiza.cl**…", **"Queda prohibida su venta o distribución comercial."**, el distintivo **© viviLoaiza.cl** y el aviso de marcas registradas (Spotify, WhatsApp, Android, Apple). Los cuatro deben estar.
- [ ] Vista de Ayuda: al final aparece el bloque "Sobre la creadora" con los dos enlaces (sitio + Instagram), ambos abren en pestaña nueva.
- [ ] Justo debajo, la línea de versión dice **«Versión 2.2.0 · creada para viviloaiza.cl por parg»**, y el número **coincide con `VERSION` de `sw.js`**.
- [ ] IVA siempre activado: en la lista de productos, detalle, resultados y WhatsApp se ve el precio con IVA sin opción de ocultarlo.

## PWA

- [ ] Servir la app por HTTPS (ej. GitHub Pages) e instalar como PWA en Android Chrome: aparece el ícono en el cajón de apps.
- [ ] Instalar en iOS Safari ("Compartir → Agregar a inicio"): se abre en modo standalone.
- [ ] **El acceso a instalar existe siempre.** La fila «Instalar en tu teléfono» está en la pestaña «Tu marca» aunque el aviso del inicio no haya aparecido, y **desaparece** cuando la app ya está instalada (abrirla desde el ícono y comprobarlo).
- [ ] **La guía se adapta.** En Android/escritorio sin diálogo nativo muestra los pasos del menú ⋮; en iPhone, los de Safari; en el archivo portable dice que esa copia no se instala. Ningún caso deja el botón sin hacer nada.
- [ ] El aviso «si no ves la opción, abriste el link dentro de otra app» aparece en la guía de Android — es el motivo más frecuente de que no se pueda instalar.
- [ ] Modo avión: la app sigue cargando desde el caché.
- [ ] Publicar una entrega nueva (subir `BUILD` en `sw.js`), abrir la app instalada: aparece el banner "Hay una nueva versión disponible — Recargar". Hacer click recarga y la app pasa a la versión nueva sin loop infinito.
- [ ] **Con la app ya cacheada, subir solo `BUILD`** (sin tocar `VERSION`) y comprobar en DevTools → Application → Cache Storage que el caché viejo desaparece y queda solo el nuevo, con los archivos actualizados dentro. Es el escenario que falló al añadir el asistente de valor hora.
- [ ] **El icono instalado se ve nítido y sin recortes** en el cajón de apps de Android (el sistema aplica su máscara sobre el icono *maskable*), y la pantalla de bienvenida al abrir no sale borrosa.
- [ ] **Modo avión con la app instalada:** la tipografía de marca se ve **igual que en línea** (Fraunces y Nunito, no la fuente del sistema).
- [ ] **Sin caché y sin red:** en DevTools → Application → Storage → *Clear site data*, activar Offline y recargar: aparece la pantalla "Sin conexión", no el error del navegador.
- [ ] **El servidor no congela la app.** Comprobar en Network que `sw.js`, `index.html` y `manifest.webmanifest` se sirven con `Cache-Control: no-cache`. Sin eso, una corrección publicada no llega a quien ya tenía la app abierta.

## Botón Atrás (Android / navegador)

- [ ] Con un **modal abierto** (eliminar, selector de icono, guía de instalación): Atrás lo cierra/cancela, sin salir.
- [ ] Con la **bienvenida** abierta: Atrás la cierra y la app sigue.
- [ ] En la **calculadora**: paso 3 → paso 2 → paso 1 → Inicio, un paso por pulsación.
- [ ] En resultados → calculadora · detalle → Productos · respaldo y guía → su origen · asistentes → su origen · selector del Estudio → Publicar.
- [ ] En el **editor del Estudio** con una pieza sin descargar: Atrás pregunta («Seguir editando» conserva todo; «Salir igual» va a Publicar).
- [ ] En una pestaña ≠ Inicio: Atrás va a Inicio. En Inicio, **el segundo Atrás sale de la app** (el primero puede consumir la entrada guardián sin efecto visible).
- [ ] Tras salir a Inicio con Atrás y abrir otra pantalla, Atrás la cierra (no sale de la app).

## Seguridad

- [ ] Crear un producto con nombre `<script>alert(1)</script>`: se muestra como texto, no ejecuta JS.
- [ ] Importar un JSON donde `name` sea `<img src=x onerror=alert(1)>`: tampoco ejecuta.
- [ ] Importar un JSON donde `emoji` sea `<s`: se muestra como texto en la lista y en el detalle.
- [ ] **La CSP no contiene ningún `unsafe-inline`** (`script-src 'self'` y `style-src 'self'`) y en DevTools → Console no aparece ningún `Refused to execute`/`Refused to apply` durante el recorrido completo (calcular, guardar, editar, eliminar, importar, asistentes, marca, Estudio, tips, acordeón, modales).
- [ ] `grep` de `onclick=`/`oninput=`/`onchange=`/`style="` en `index.html` y `js/`: **cero resultados** (eventos por `data-action`/`data-input`/`data-change`; estilos por clases o CSSOM).
- [ ] Los 8 swatches de color de «Tu marca» y del editor se ven pintados (los pinta JS por CSSOM), y las barras del desglose de resultados tienen su degradado.
- [ ] **Cero tráfico a terceros.** En la pestaña Network, tras un uso completo (calcular, guardar, publicar), **ninguna petición sale del propio dominio**. Ya no hay Google Fonts.
- [ ] En la pestaña Network filtrando por `Font`: las tres tipografías se sirven desde `/assets/fonts/`.

## Accesibilidad

- [ ] **Pellizcar para ampliar funciona** en el teléfono, en todas las pantallas.
- [ ] Con el tamaño de letra del sistema al máximo (Android: Ajustes → Pantalla → Tamaño de fuente), las pantallas siguen usables y los botones no se solapan.
- [ ] En el aviso de eliminar, pulsar **Enter no borra nada**. Escape cancela. Tabular hasta "Eliminar" y pulsar Enter sí elimina.

## Layout

- [ ] iPhone SE (375px): la lista de productos no se desborda, los botones del detalle entran en pantalla.
- [ ] Android promedio (412px): igual.
- [ ] **320px** (el más estrecho realista): las cuatro etiquetas de la barra de pestañas entran sin cortarse, los cuatro botones de margen caben en una fila y la nota del precio mínimo no pisa el número.
- [ ] Tablet (768px): la app sigue centrada, no se estira en exceso, y la barra de pestañas queda centrada con la app (no pegada a los bordes de la ventana).
- [ ] En ninguna pantalla hay **desplazamiento horizontal** (`document.documentElement.scrollWidth === innerWidth`). Los carruseles de estilos desplazan dentro de su propia caja.

## Continuidad con la 1.6.0

- [ ] **Los precios no cambiaron.** Calcular un producto con datos conocidos (materiales 2.170 · 2,5 h × $8.000 · creatividad moderada · $80.000 / 30 unidades) da mínimo **$28.162** y ideal al 50% **$42.243** — igual que en la 1.6.0.
- [ ] Un respaldo `.json` exportado con la 1.6.0 se importa sin pérdidas: productos, marca y logo.
- [ ] Las imágenes que genera el Estudio son **idénticas** a las de la 1.6.0 (mismo estilo, mismo color, mismos 1080×1920): el motor de Canvas no se tocó.
