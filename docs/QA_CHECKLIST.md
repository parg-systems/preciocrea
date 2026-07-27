# Checklist de QA manual — PrecioCrea

Pasar todos los escenarios antes de publicar una versión nueva.
Cada release debe bumpear `VERSION` en `sw.js` para invalidar el caché viejo.

## Smoke test (5 min)

- [ ] Abrir `index.html` directo en navegador local — la app renderiza sin errores en la consola.
- [ ] Crear un producto desde cero: ingresar nombre, agregar 2 materiales, llenar tiempo, elegir nivel creativo, costos fijos. El resultado muestra precios mínimo e ideal.
- [ ] El producto aparece en el home y al recargar sigue ahí.
- [ ] Abrir el producto, editar el valor de materiales, guardar. Se actualizan los precios.
- [ ] Eliminar el producto — el modal de confirmación aparece y muestra el nombre. Confirmar borra; cancelar lo conserva.

## Onboarding y primer uso

- [ ] En una pestaña incógnita (sin localStorage previo): aparece el banner "Antes de empezar".
- [ ] Hacer click en "Probar con ejemplo" prellena nombre y un material, y descarta el banner.
- [ ] "Entendido" descarta el banner sin abrir la calculadora.
- [ ] Recargar la página: el banner ya no vuelve a aparecer.

## Backup y restore

- [ ] Con productos guardados, "Descargar respaldo" genera un archivo `preciocrea-respaldo-YYYY-MM-DD.json` válido (abrirlo en un editor, debe ser JSON con `app: "PrecioCrea"`, `version: 2`, `products: [...]` y `brand: {...}`).
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

## Validaciones de entrada

- [ ] Nombre del producto vacío: no permite avanzar (toast "Ponle nombre").
- [ ] Materiales sin costo positivo: no permite avanzar.
- [ ] Horas o valor hora en 0: no permite avanzar.
- [ ] Escribir un valor enorme (ej. 999999999999999): el cálculo se capea, no muestra `NaN` ni infinitos.
- [ ] Pegar caracteres no numéricos en un input numérico: el navegador los descarta o `sanitizeNum` los normaliza a 0.

## Compartir y duplicar

- [ ] Botón WhatsApp abre wa.me en pestaña nueva con el mensaje pre-armado, incluyendo nombre, precio y línea c/IVA.
- [ ] Botón "Duplicar" crea una copia con sufijo "(copia)" en el nombre y fecha de hoy. La copia es independiente de la original.

## Legibilidad (revisar con el teléfono al sol, no solo en el escritorio)

- [ ] Home: saludo, título y descripción del hero se leen con claridad, **en blanco sobre el degradado coral**; el logotipo "preciocrea" en coral y morado.
- [ ] La tarjeta "Comparte tus productos" se distingue del fondo: borde visible y filete de color arriba.
- [ ] Ningún botón de letra blanca se pierde en su fondo. Recorrer: "Guardar producto", "Guardar cambios", los cuatro "siguiente" del cálculo, "Compartir" y "Descargar" de las publicaciones, "Salir igual" de los avisos, "Configurar mi marca", "Seleccionar archivo", "¡Empezar a calcular!" de la guía.
- [ ] Tarjeta "Precio Ideal": se leen la etiqueta, el valor, el `c/IVA` y la nota de abajo.
- [ ] Enlaces "Sitio web" e "Instagram" (guía y respaldo): los dos igual de legibles.
- [ ] **Regla al tocar colores:** si el color va de **letras**, se usa el tono de marca (`--coral`, `--purple`, `--muted`) — son la identidad de la app y no se oscurecen. Si el problema es que unas letras blancas se pierden, lo que se oscurece es el **fondo**: `--coral-deep`, `--orange-deep`, `--purple-deep`, `--blue-deep`, `--green-deep`. Nunca al revés.

## Producto — descripción e icono

- [ ] Al escribir el nombre, el icono se sugiere solo (ej. "Aros" → 💎).
- [ ] Tocar el icono abre la parrilla; al elegir otro, **escribir un nombre distinto ya no lo pisa**.
- [ ] "Sin icono" lo deja vacío: la lista del home no muestra hueco y el mensaje de WhatsApp no queda con espacios sueltos.
- [ ] La descripción se guarda, se ve en la lista del home y se puede editar desde el detalle.
- [ ] Producto con descripción larga (160 caracteres): en la publicación se reparte en dos líneas y reduce el tamaño; no desborda ni pisa el precio.

## Publicaciones — logo y color

- [ ] Subir un logo desde *Tu marca* **después de escribir el nombre y el @**: al volver, los campos siguen con lo escrito.
- [ ] El logo aparece en la publicación **en lugar** del nombre escrito, sin invadir la línea del `@`.
- [ ] Probar los cuatro estilos con un logo oscuro: en "Pantalla completa" y "Bloque" el fondo es oscuro, así que conviene un logo claro (la app lo advierte).
- [ ] "Quitar" el logo lo borra y vuelve el nombre escrito.
- [ ] Cambiar el color dentro del editor afecta solo a esa publicación; el perfil de marca no cambia y aparece "↺ Volver al de mi marca".
- [ ] Importar un respaldo cuyo `logo` sea una URL remota, un `javascript:` o un SVG: se descarta sin aplicarse.

## Publicaciones — perfil de marca

- [ ] Sin marca configurada, tocar "📸 Publicar" en un producto lleva a *Tu marca*, y al guardar **continúa al editor** (no vuelve al home: la intención no se pierde).
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
- [ ] Salir con "←" sin haber descargado: pregunta. "Seguir editando" conserva la foto; "Salir igual" vuelve al home.
- [ ] Tras descargar, salir ya no pregunta.

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
- [ ] Buscar `function fmt(n)` en el portable: la línea siguiente debe ser `return '$' + Math.round(n)…`, sin HTML incrustado.
- [ ] Abrir el portable con doble clic y descargar una historia con foto.

## Marca viviLoaiza

- [ ] Tarjeta de viviLoaiza en el home: muestra avatar "vL", enlaces a sitio (viviloaiza.cl) y a Instagram (@viviloaiza.cl). Ambos abren en pestaña nueva.
- [ ] Vista de Respaldo: el bloque "Sobre viviLoaiza" muestra los dos enlaces (sitio + Instagram) y reemplaza por completo el antiguo toggle de IVA.
- [ ] Vista de Ayuda: al final aparece el bloque "Sobre la creadora" con los dos enlaces antes del botón "Empezar a calcular".
- [ ] IVA siempre activado: en home, detalle, resultados y WhatsApp se ve la línea c/IVA sin opción de ocultarla.

## PWA

- [ ] Servir la app por HTTPS (ej. Netlify, GitHub Pages) e instalar como PWA en Android Chrome: aparece el ícono en el cajón de apps.
- [ ] Instalar en iOS Safari ("Compartir → Agregar a inicio"): se abre en modo standalone.
- [ ] Modo avión: la app sigue cargando desde el caché.
- [ ] Publicar una nueva versión (bump `VERSION` en `sw.js`), abrir la app instalada: aparece el banner "Hay una nueva versión disponible — Recargar". Hacer click recarga y la app pasa a la versión nueva sin loop infinito.
- [ ] **El icono instalado se ve nítido y sin recortes** en el cajón de apps de Android (el sistema aplica su máscara sobre el icono *maskable*), y la pantalla de bienvenida al abrir no sale borrosa.
- [ ] **Modo avión con la app instalada:** la tipografía de marca se ve **igual que en línea** (Fraunces y Nunito, no la fuente del sistema).
- [ ] **Sin caché y sin red:** en DevTools → Application → Storage → *Clear site data*, activar Offline y recargar: aparece la pantalla "Sin conexión", no el error del navegador.
- [ ] **El servidor no congela la app.** Comprobar en Network que `sw.js`, `index.html` y `manifest.webmanifest` se sirven con `Cache-Control: no-cache`. Sin eso, una corrección publicada no llega a quien ya tenía la app abierta.

## Seguridad

- [ ] Crear un producto con nombre `<script>alert(1)</script>`: se muestra como texto, no ejecuta JS.
- [ ] Importar un JSON donde `name` sea `<img src=x onerror=alert(1)>`: tampoco ejecuta.
- [ ] Importar un JSON donde `emoji` sea `<s`: se muestra como texto en la lista y en el detalle.
- [ ] DevTools → Console: el CSP no reporta violaciones críticas durante uso normal.
- [ ] **Cero tráfico a terceros.** En la pestaña Network, tras un uso completo (calcular, guardar, publicar), **ninguna petición sale del propio dominio**. Ya no hay Google Fonts.
- [ ] En la pestaña Network filtrando por `Font`: las tres tipografías se sirven desde `/assets/fonts/`.

## Accesibilidad

- [ ] **Pellizcar para ampliar funciona** en el teléfono, en todas las pantallas.
- [ ] Con el tamaño de letra del sistema al máximo (Android: Ajustes → Pantalla → Tamaño de fuente), las pantallas siguen usables y los botones no se solapan.
- [ ] En el aviso de eliminar, pulsar **Enter no borra nada**. Escape cancela. Tabular hasta "Eliminar" y pulsar Enter sí elimina.

## Layout

- [ ] iPhone SE (375px): la lista de productos no se desborda, los botones del detalle entran en pantalla.
- [ ] Android promedio (412px): igual.
- [ ] Tablet (768px): la app sigue centrada, no se estira en exceso.
