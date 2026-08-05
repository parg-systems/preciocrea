// ===================================================
// STUDIO — PUBLICACIONES
// ===================================================
// Genera imágenes para Instagram (historias y carruseles) a partir de los
// productos ya calculados en PrecioCrea.
//
// Principios de diseño de este módulo:
//   1. MARCA BLANCA. La publicación es de la creadora, no de PrecioCrea:
//      ella pone su nombre, su @ y su color. Todo el material gráfico se
//      DIBUJA POR CÓDIGO (gradientes y formas en Canvas 2D); no hay ni un
//      solo asset binario nuevo.
//   2. Sin módulos ES: este archivo se carga con <script src> clásico y todo
//      queda en el scope global, igual que app.js, para compartir los
//      registros de delegación (ACCIONES/ENTRADAS/CAMBIOS) declarados allá.
//      Prefijo obligatorio studio*/STUDIO_* para no colisionar con app.js.
//   3. Se carga DESPUÉS de app.js y reutiliza sus helpers:
//      toast, confirmDialog, esc, fmt, getEmoji, isIos, IVA, S.products.

// ===================================================
// STUDIO — MARCA DE LA CREADORA
// ===================================================

const KEY_BRAND = 'pc_brand_v1';

// Modos de precio en la publicación:
//   iva      → el precio, SIEMPRE con IVA incluido
//   consulta → "Consulta por precio" (muchas creadoras no publican precios)
//   oculto   → sin precio; el slot se omite del render
//
// Antes existía un cuarto modo, 'ideal', que publicaba el precio sin IVA.
// Se quitó: un precio publicado es un precio de venta al público, y ahí el
// IVA siempre va incluido. Publicar el neto llevaba a cobrar de menos.
// STUDIO_PRICE_MIGRATE traduce las marcas ya guardadas con el modo viejo.
const STUDIO_PRICE_MODES = ['iva', 'consulta', 'oculto'];

const STUDIO_PRICE_MIGRATE = { ideal: 'iva' };

const STUDIO_PRICE_LABELS = {
  iva:      'Precio',
  consulta: 'Consultar',
  oculto:   'Sin precio'
};

// Acentos sugeridos. El primero es --coral, el color de la app.
const STUDIO_ACCENTS = [
  '#FF6B6B', '#E86A92', '#C77DFF', '#4D96FF',
  '#2BC4B4', '#6BCB77', '#FFB03D', '#1E1E2E'
];

const STUDIO_BRAND_DEFAULT = {
  name: '',
  handle: '',
  accent: '#FF6B6B',
  credit: true,        // pie discreto "hecho con PrecioCrea"
  priceMode: 'iva',
  logo: ''             // data URL PNG, ver STUDIO_LOGO_MAX
};

const MAX_BRAND_NAME   = 40;
const MAX_BRAND_HANDLE = 30;

// El logo SÍ se guarda, a diferencia de las fotos de producto: es un dato de
// marca que se configura una vez y tiene que sobrevivir a cerrar la app.
// Para que quepa sin comerse la cuota de localStorage se reduce a 360 px de
// lado y se guarda en PNG (hace falta transparencia). Eso deja un archivo de
// ~40-90 KB, frente a los 300-600 KB de una foto de producto.
const STUDIO_LOGO_MAX = 360;
const STUDIO_LOGO_MAX_BYTES = 10 * 1024 * 1024;   // límite del archivo de entrada
const STUDIO_LOGO_MAX_STORED = 300 * 1024;        // límite del data URL resultante

// Estado vivo del módulo. `brand` es lo único que se persiste.
const STUDIO = {
  brand: null,
  piece: null,    // pieza en edición: { format, templateId, priceMode, active, slides[] }
  _after: null,   // destino pendiente cuando desviamos a configurar la marca
  _raf: 0,        // id del repintado pendiente (coalescing del preview)
  _thumbs: 0,     // temporizador de refresco de las miniaturas de estilo
  _brandSaved: '', // huella de la marca tal como está guardada, para detectar cambios sin guardar
  _pick: [],      // ids elegidos en la pantalla de selección
  _pickMode: '',  // 'historia' (uno) | 'catalogo' (varios, ordenados)
  _share: null,   // blob pre-renderizado para que navigator.share sea síncrono
  _prime: 0,      // temporizador del pre-render de compartir
  _saved: false,  // ¿ya descargó o compartió algo de esta pieza?
  _exp: null,     // canvas offscreen reusado para exportar
  _busy: false,   // evita renders concurrentes por doble toque
  _framing: false // modo encuadre: mientras dura, el canvas se queda los gestos táctiles
};

// Saneo el perfil de marca igual que sanitizeImportedProduct: reconstruyo el
// objeto desde cero y nunca confío en lo que venga de localStorage o de un
// respaldo importado.
function studioSanitizeBrand(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const name = typeof raw.name === 'string'
    ? raw.name.trim().slice(0, MAX_BRAND_NAME)
    : '';

  const handle = typeof raw.handle === 'string'
    ? raw.handle.replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, MAX_BRAND_HANDLE)
    : '';

  const accent = (typeof raw.accent === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw.accent))
    ? raw.accent.toUpperCase()
    : STUDIO_BRAND_DEFAULT.accent;

  // Una marca guardada antes de quitar el modo 'ideal' pasa a 'iva'
  const rawMode = STUDIO_PRICE_MIGRATE[raw.priceMode] || raw.priceMode;
  const priceMode = STUDIO_PRICE_MODES.includes(rawMode)
    ? rawMode
    : STUDIO_BRAND_DEFAULT.priceMode;

  // Solo se acepta un data URL de imagen y con un tamaño razonable. Cualquier
  // otra cosa (una URL remota, un javascript:, un archivo enorme) se descarta:
  // esto puede venir de un respaldo que la creadora recibió por WhatsApp.
  const logoRaw = typeof raw.logo === 'string' ? raw.logo : '';
  const logo = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logoRaw)
            && logoRaw.length <= STUDIO_LOGO_MAX_STORED
    ? logoRaw : '';

  return { name, handle, accent, credit: raw.credit !== false, priceMode, logo };
}

function studioLoadBrand() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(KEY_BRAND) || 'null'); } catch(e) {}
  STUDIO.brand = studioSanitizeBrand(stored) || { ...STUDIO_BRAND_DEFAULT };
  STUDIO._brandSaved = JSON.stringify(STUDIO.brand);
  return STUDIO.brand;
}

// ¿Hay algo escrito o elegido en el formulario que no se haya guardado?
// El color, el modo de precio y el logo mutan STUDIO.brand en el acto (para
// que la vista previa reaccione), así que no basta con mirar los inputs: se
// compara el estado completo contra la última versión persistida. La
// comparación se hace sobre una COPIA: una función de consulta no puede tener
// el efecto secundario de aplicar los cambios que está evaluando.
function studioBrandDirty() {
  if (!STUDIO._brandSaved) return false;
  const n = document.getElementById('brand-name');
  const h = document.getElementById('brand-handle');
  const c = document.getElementById('brand-credit');
  const candidato = { ...STUDIO.brand };
  if (n) candidato.name   = n.value.trim().slice(0, MAX_BRAND_NAME);
  if (h) candidato.handle = h.value.replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, MAX_BRAND_HANDLE);
  if (c) candidato.credit = c.checked;
  return JSON.stringify(candidato) !== STUDIO._brandSaved;
}

// Nunca devuelve null: si aún no se configuró, entrega los valores por defecto.
// OJO: esto es el BORRADOR (incluye lo tecleado sin guardar, para que el
// formulario y su vista previa reaccionen). Todo lo que publica, exporta o
// decide debe usar studioBrandPersisted().
function studioBrandOrDefault() {
  return STUDIO.brand || studioLoadBrand();
}

// La marca tal como está GUARDADA. Las publicaciones, los respaldos y las
// guardas ("¿ya configuró su marca?") salen de aquí: lo tecleado sin pulsar
// "Guardar mi marca" es un borrador que no debe filtrarse a ninguna imagen ni
// archivo. Con caché, porque el canvas la consulta en cada repintado y el
// logo en base64 puede pesar bastante para re-parsearlo por slot.
let _brandPersistedCache = null;
function studioBrandPersisted() {
  studioBrandOrDefault();           // garantiza que _brandSaved esté cargado
  if (_brandPersistedCache && _brandPersistedCache.json === STUDIO._brandSaved) {
    return _brandPersistedCache.value;
  }
  let value = null;
  try { value = studioSanitizeBrand(JSON.parse(STUDIO._brandSaved)); } catch(e) {}
  if (!value) value = { ...STUDIO_BRAND_DEFAULT };
  _brandPersistedCache = { json: STUDIO._brandSaved, value };
  return value;
}

// ¿La creadora ya configuró su marca? Basta con el nombre — el GUARDADO:
// un nombre a medio escribir en el formulario no habilita el Estudio.
function studioHasBrand() {
  return !!studioBrandPersisted().name;
}

// Persiste el perfil. Mismo patrón defensivo que persistProducts().
function studioSaveBrand() {
  try {
    localStorage.setItem(KEY_BRAND, JSON.stringify(STUDIO.brand));
    STUDIO._brandSaved = JSON.stringify(STUDIO.brand);
    return true;
  } catch(e) {
    toast('⚠️ No se pudo guardar. Libera espacio en tu navegador.');
    return false;
  }
}

// ===================================================
// STUDIO — VISTA "TU MARCA"
// ===================================================

function openBrand() {
  showView('view-brand');   // showView ya llama a renderBrandForm()
}

// ===================================================
// STUDIO — PESTAÑA "PUBLICAR"
// ===================================================
// Producto de muestra para las miniaturas del hub cuando todavía no hay nada
// guardado. Tiene la misma forma que un producto real porque studioProductSlide
// le pide `idealP` para armar el precio.
const STUDIO_DEMO_PRODUCT = {
  id: 0,
  name: 'Jabón de lavanda',
  desc: 'Hecho a mano con lavanda de Colchagua',
  emoji: '🧼',
  idealP: 7200
};

function renderStudioHub() {
  // Volver al hub descarta cualquier estilo elegido en una visita anterior al
  // selector: si quedara vivo, un 📸 desde la lista de productos abriría el
  // editor con un estilo que la creadora no pidió.
  STUDIO._pickTpl = null;
  renderHubBrandCard();
  renderHubStyles();
  // Las métricas de measureText cambian cuando termina de cargar la tipografía
  // real, así que hay que repintar: si no, las miniaturas quedan con el
  // autoescalado calculado sobre la fuente de respaldo.
  studioFontsReady().then(renderHubStyles);
}

function renderHubBrandCard() {
  const title = document.getElementById('hub-brand-title');
  const sub   = document.getElementById('hub-brand-sub');
  if (!title || !sub) return;

  const b = studioBrandPersisted();
  if (b.name) {
    title.textContent = 'Tu marca está configurada';
    sub.textContent   = b.handle ? `${b.name} · @${b.handle}` : b.name;
  } else {
    title.textContent = 'Configura tu marca';
    sub.textContent   = 'Nombre, Instagram, logo y color';
  }
}

// Las cuatro miniaturas se dibujan con studioRenderSlide, el mismo motor que
// exporta la imagen final: cada estilo se ve como es de verdad —dónde va la
// foto, dónde el precio, si el fondo es pleno o partido— y con el color de la
// marca de la creadora. Dibujarlas a mano en CSS las dejaba a las cuatro
// iguales y prometía algo que la publicación no cumplía.
function renderHubStyles() {
  const strip = document.getElementById('hub-style-strip');
  if (!strip) return;

  const f     = STUDIO_FORMATS.historia;
  const tpls  = studioTemplatesFor('historia');
  const b     = studioBrandPersisted();
  const pal   = studioPalette(b.accent);
  // Con productos guardados se muestra el primero: la creadora reconoce lo suyo.
  const slide = studioProductSlide(S.products[0] || STUDIO_DEMO_PRODUCT, b.priceMode);

  strip.innerHTML = tpls.map(t => `
    <button type="button" class="style-thumb" data-action="openStudioPicker" data-tpl="${t.id}" title="${esc(t.desc)}">
      <canvas class="stt-canvas" data-tpl="${t.id}" aria-label="Estilo ${esc(t.name)}"></canvas>
      <span class="stt-name">${esc(t.name)}</span>
    </button>`).join('');

  const TW = 118, dpr = Math.min(2, window.devicePixelRatio || 1);
  strip.querySelectorAll('.stt-canvas').forEach(c => {
    c.width  = Math.round(TW * dpr);
    c.height = Math.round(TW * dpr * f.h / f.w);
    const ctx = c.getContext('2d');
    const k = c.width / f.w;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const t = studioTemplate(c.dataset.tpl);
    studioRenderSlide(ctx, slide, t, pal, f.w, f.h);
  });
}

function renderBrandForm() {
  const b = studioBrandOrDefault();

  const swatches = STUDIO_ACCENTS.map(hex => `
    <button type="button" class="brand-swatch${b.accent === hex ? ' sel' : ''}"
            data-hex="${hex}"
            data-action="setBrandAccent"
            aria-label="Color ${hex}"></button>`).join('');

  const priceChips = STUDIO_PRICE_MODES.map(m => `
    <button type="button" class="m-btn brand-price-chip${b.priceMode === m ? ' active' : ''}"
            data-mode="${m}" data-action="setBrandPriceMode">
      ${esc(STUDIO_PRICE_LABELS[m])}
    </button>`).join('');

  document.getElementById('brand-body').innerHTML = `
    <label class="field-label" for="brand-name">Nombre de tu marca</label>
    <input class="field-input" type="text" id="brand-name" maxlength="${MAX_BRAND_NAME}"
           placeholder="Ej: Telar de Luna" value="${esc(b.name)}" data-input="previewBrand">

    <label class="field-label u-mt16" for="brand-handle">Tu Instagram</label>
    <div class="brand-handle-wrap">
      <span class="brand-handle-at">@</span>
      <input class="field-input brand-handle-input" type="text" id="brand-handle"
             maxlength="${MAX_BRAND_HANDLE}" placeholder="telardeluna"
             value="${esc(b.handle)}" data-input="previewBrand">
    </div>

    <div class="field-label u-mt18">Tu logo <span class="field-optional">opcional</span></div>
    ${b.logo
      ? `<div class="logo-box">
           <div class="logo-preview"><img src="${esc(b.logo)}" alt="Tu logo"></div>
           <div class="logo-actions">
             <button type="button" class="studio-photo-btn" data-action="clickTarget" data-target="brand-logo-file">🔄 Cambiar</button>
             <button type="button" class="studio-photo-btn danger" data-action="removeBrandLogo">🗑️ Quitar</button>
           </div>
         </div>`
      : `<button type="button" class="studio-photo-btn primary"
                 data-action="clickTarget" data-target="brand-logo-file">🖼️ Subir mi logo</button>`}
    <input type="file" id="brand-logo-file" class="u-oculto" accept="image/*"
           data-change="studioPickLogo">
    <div class="field-hint">Si subes un logo, reemplaza a tu nombre escrito en las publicaciones. Un PNG con fondo transparente y de color claro funciona en todos los estilos, incluidos los de fondo oscuro.</div>

    <div class="field-label u-mt18">Tu color</div>
    <div class="brand-swatches" id="brand-swatches">${swatches}</div>
    <label class="brand-custom-color">
      <input type="color" id="brand-color" value="${esc(b.accent)}" data-input="brandAccentLibre">
      <span>Elegir otro color</span>
    </label>

    <div class="field-label u-mt18">Cómo mostrar el precio</div>
    <div class="margin-btns brand-price-chips">${priceChips}</div>
    <div class="field-hint">«Precio» publica tu precio ideal con el IVA ya incluido: es lo que paga quien te compra.</div>

    <label class="brand-toggle">
      <input type="checkbox" id="brand-credit" ${b.credit ? 'checked' : ''} data-change="previewBrand">
      <span>Mostrar «hecho con PrecioCrea» en la publicación</span>
    </label>

    <button class="btn-save" data-action="saveBrandForm">Guardar mi marca</button>`;

  studioPintarSwatches(document.getElementById('brand-swatches'));
  previewBrand();
}

// Pinta el color de cada swatch por CSSOM. Con la CSP estricta el marcado no
// puede llevar atributos de estilo — ni siquiera el generado por innerHTML —
// pero asignar por la propiedad .style desde JS sí está permitido.
function studioPintarSwatches(contenedor) {
  (contenedor || document).querySelectorAll('.brand-swatch[data-hex]').forEach(s => {
    s.style.background = s.dataset.hex;
  });
}

// Cambia el acento desde un swatch o desde el <input type="color">.
function setBrandAccent(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
  hex = hex.toUpperCase();
  STUDIO.brand.accent = hex;
  document.querySelectorAll('.brand-swatch').forEach(s => {
    s.classList.toggle('sel', (s.dataset.hex || '').toUpperCase() === hex);
  });
  const picker = document.getElementById('brand-color');
  if (picker) picker.value = hex;
  previewBrand();
}

function setBrandPriceMode(mode) {
  if (!STUDIO_PRICE_MODES.includes(mode)) return;
  STUDIO.brand.priceMode = mode;
  document.querySelectorAll('.brand-price-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.mode === mode);
  });
  previewBrand();
}

// Vista previa en vivo: por ahora una tarjeta HTML teñida con el acento.
// En la fase 1 se reemplaza por un canvas con la plantilla real.

// El texto de la tarjeta es blanco fijo, así que el bloque de color se
// oscurece lo necesario para que se lea — igual que hace el motor del canvas
// con sus fondos. Con el mostaza o el verde del propio catálogo, el nombre
// desaparecía (1,9:1). El acento elegido no se toca: solo el fondo derivado.
function studioBgParaBlanco(hex, min = 4.5) {
  let { h, s, l } = studioHexToHsl(hex);
  let out = hex;
  for (let i = 0; i < 30 && studioContrast(out, '#FFFFFF') < min; i++) {
    l = Math.max(0, l - 0.03);
    out = studioHslToHex(h, s, l);
    if (l <= 0) break;
  }
  return out;
}

function previewBrand() {
  const prev = document.getElementById('brand-preview');
  if (!prev) return;
  const name   = (document.getElementById('brand-name')?.value || '').trim();
  const handle = (document.getElementById('brand-handle')?.value || '')
                   .replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '');
  const accent = STUDIO.brand.accent;
  const fondo  = studioBgParaBlanco(accent);

  prev.style.background = `linear-gradient(160deg, ${accent}22 0%, ${fondo} 65%, ${fondo} 100%)`;
  prev.querySelector('.brand-prev-name').textContent   = name || 'Tu marca';
  prev.querySelector('.brand-prev-handle').textContent = handle ? '@' + handle : '@tu_instagram';
}

function saveBrandForm() {
  const name = (document.getElementById('brand-name').value || '').trim();
  if (!name) {
    toast('⚠️ Escribe el nombre de tu marca');
    document.getElementById('brand-name').focus();
    return;
  }

  STUDIO.brand = studioSanitizeBrand({
    name,
    handle: document.getElementById('brand-handle').value,
    accent: STUDIO.brand.accent,
    credit: document.getElementById('brand-credit').checked,
    priceMode: STUDIO.brand.priceMode,
    logo: STUDIO.brand.logo          // ya se guardó al subirlo; no perderlo aquí
  });

  if (!studioSaveBrand()) return;
  toast('✨ ¡Marca guardada!');

  // Si llegamos aquí desviados desde otra intención, la retomamos.
  const next = STUDIO._after;
  STUDIO._after = null;
  if (next && typeof next === 'function') { next(); return; }
  // Sin intención pendiente, el paso natural después de configurar la marca es
  // el Estudio: es para lo que sirve todo lo que acaba de rellenar.
  showView('view-studio-hub');
}

// Vuelca al estado lo que hay escrito ahora mismo en el formulario. Hay que
// llamarlo ANTES de repintarlo (al subir o quitar el logo): si no, el repintado
// rellena los campos desde el estado viejo y se pierde lo tecleado.
function captureBrandForm() {
  const n = document.getElementById('brand-name');
  const h = document.getElementById('brand-handle');
  const c = document.getElementById('brand-credit');
  if (n) STUDIO.brand.name   = n.value.trim().slice(0, MAX_BRAND_NAME);
  if (h) STUDIO.brand.handle = h.value.replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, MAX_BRAND_HANDLE);
  if (c) STUDIO.brand.credit = c.checked;
}

// ---- Logo de la marca ----

async function studioPickLogo(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  if (!/^image\//.test(file.type)) { toast('⚠️ Eso no es una imagen'); return; }
  if (file.size > STUDIO_LOGO_MAX_BYTES) { toast('⚠️ El logo es muy pesado (máx. 10 MB)'); return; }

  try {
    const canvas = await studioLoadPhoto(file, STUDIO_LOGO_MAX);
    // PNG y no JPEG: un logo casi siempre lleva fondo transparente, y en JPEG
    // ese fondo se volvería un rectángulo negro.
    const url = canvas.toDataURL('image/png');
    canvas.width = canvas.height = 0;

    if (url.length > STUDIO_LOGO_MAX_STORED) {
      toast('⚠️ El logo quedó muy pesado. Prueba con una imagen más simple.');
      return;
    }
    captureBrandForm();          // no perder el nombre y el @ ya escritos
    STUDIO.brand.logo = url;
    if (!studioSaveBrand()) { STUDIO.brand.logo = ''; return; }
    renderBrandForm();
    toast('🖼️ ¡Logo guardado!');
  } catch(e) {
    toast('❌ No se pudo leer ese archivo. Prueba con un PNG o JPG.');
  }
}

function removeBrandLogo() {
  captureBrandForm();
  STUDIO.brand.logo = '';
  studioSaveBrand();
  renderBrandForm();
  toast('🗑️ Logo quitado');
}

// Cache del logo ya decodificado: sin esto habría que crear un Image nuevo en
// cada repintado del preview, que ocurre en cada pulsación de tecla.
let _logoImg = null, _logoSrc = '';
function studioLogoImage() {
  const src = studioBrandOrDefault().logo;
  if (!src) { _logoImg = null; _logoSrc = ''; return null; }
  if (src !== _logoSrc) {
    _logoSrc = src;
    _logoImg = new Image();
    _logoImg.onload = () => studioRequestPreview();
    _logoImg.src = src;      // data URL: la CSP permite data: en img-src
  }
  return (_logoImg && _logoImg.complete && _logoImg.naturalWidth) ? _logoImg : null;
}

// Aplica una marca que viene de un respaldo importado. Si ya hay una marca
// distinta configurada, pregunta antes de sobrescribir.
function studioApplyImportedBrand(incoming) {
  const current = studioBrandOrDefault();
  const same = current.name === incoming.name
            && current.handle === incoming.handle
            && current.accent === incoming.accent
            && current.logo === incoming.logo;
  if (same) return;

  if (!current.name) {
    STUDIO.brand = incoming;
    studioSaveBrand();
    return;
  }

  confirmDialog({
    icon: '🎨',
    title: '¿Reemplazar los datos de tu marca?',
    message: `El respaldo trae la marca "${incoming.name}". Tu configuración actual se sobrescribirá.`,
    confirmText: 'Reemplazar',
    cancelText: 'Conservar la mía',
    dangerous: false
  }).then(ok => {
    if (!ok) return;
    STUDIO.brand = incoming;
    if (studioSaveBrand()) toast('🎨 Marca restaurada del respaldo');
  });
}

// ===================================================
// STUDIO — FORMATOS Y PLANTILLAS
// ===================================================
// Las plantillas son DATOS PUROS. Todo se dibuja por código: no hay ni una
// imagen de fondo. Un fondo es un gradiente + formas; el resto son slots.
//
// Convención de coordenadas: TODO normalizado a [0,1].
//   x, w  → fracción del ancho del lienzo (W)
//   y, h  → fracción del alto del lienzo (H)
//   size, radius, tracking → fracción de W (ambos formatos miden 1080 de ancho)
// Gracias a esto la misma plantilla sirve para el preview de 320 px y para el
// export de 1080 px sin tocar un solo número.
//
// Los slots NUNCA llevan un color hexadecimal: llevan el nombre de un token
// que studioPalette() deriva del acento de la creadora. Así cualquier color
// funciona sin dejar texto ilegible.

const STUDIO_FORMATS = {
  historia: { id:'historia', label:'Historia',  emoji:'📱', w:1080, h:1920, multi:false,
              desc:'Vertical, para stories de Instagram y estados de WhatsApp' },
  catalogo: { id:'catalogo', label:'Catálogo',  emoji:'🗂️', w:1080, h:1350, multi:true,
              desc:'Carrusel: portada + una lámina por producto' }
};

const STUDIO_TEMPLATES = [
  {
    id: 'historia-tarjeta',
    format: 'historia',
    name: 'Tarjeta',
    desc: 'Foto arriba, tarjeta blanca con el precio',
    bg: { type:'linear', angle:160, stops:[
      { at:0,    color:'accentSoft' },
      { at:0.55, color:'accent'     },
      { at:1,    color:'accentDark' }
    ]},
    decor: [
      { shape:'circle', x:0.72, y:0.02, w:0.46, h:0.26, color:'white', opacity:0.12 },
      { shape:'circle', x:-0.18, y:0.88, w:0.52, h:0.30, color:'white', opacity:0.10 }
    ],
    slots: [
      { kind:'photo', role:'photo',
        x:0.083, y:0.100, w:0.834, h:0.445, shape:'rect', radius:0.055 },

      { kind:'shape', role:'panel',
        x:0.083, y:0.600, w:0.834, h:0.272, shape:'rect', radius:0.055, color:'card' },

      // Círculo con el emoji, montado sobre el borde superior de la tarjeta.
      // Si la creadora quitó el icono, el círculo desaparece con él.
      { kind:'shape', role:'emojibg', hideWith:'emoji',
        x:0.417, y:0.552, w:0.166, h:0.0935, shape:'circle', color:'accent' },
      { kind:'text', role:'emoji',
        x:0.417, y:0.552, w:0.166, h:0.0935,
        size:0.080, minSize:0.080, weight:400, family:'body',
        align:'center', valign:'middle', color:'onAccent', maxLines:1 },

      { kind:'text', role:'name',
        x:0.139, y:0.652, w:0.722, h:0.076,
        size:0.062, minSize:0.036, weight:900, family:'display',
        align:'center', valign:'middle', color:'ink', lineHeight:1.14, maxLines:2,
        absorb:['desc','price'] },   // se queda con el espacio de lo que falte

      { kind:'text', role:'desc',
        x:0.111, y:0.735, w:0.778, h:0.050,
        size:0.031, minSize:0.024, weight:600, family:'body',
        align:'center', valign:'middle', color:'muted', lineHeight:1.35, maxLines:2 },

      // El precio va sobre la tarjeta blanca: accentInk, no accent crudo.
      { kind:'text', role:'price',
        x:0.139, y:0.794, w:0.722, h:0.066,
        size:0.072, minSize:0.038, weight:900, family:'display',
        align:'center', valign:'middle', color:'accentInk', maxLines:1 },

      // El pie cae sobre el tramo final del gradiente, que es accentDark:
      // el token tiene que ser el del fondo REAL de esa zona, no el del acento.
      // Con logo cargado se dibuja el logo; si no, el nombre escrito.
      { kind:'logo', role:'logo',
        x:0.2900, y:0.8809, w:0.4200, h:0.0483 },
      { kind:'text', role:'brand', hideWhen:'logo',
        x:0.111, y:0.884, w:0.778, h:0.042,
        size:0.044, minSize:0.028, weight:700, family:'display',
        align:'center', valign:'middle', color:'onAccentDark', maxLines:1, shadow:true },

      { kind:'text', role:'handle',
        x:0.111, y:0.929, w:0.778, h:0.030,
        size:0.030, minSize:0.022, weight:700, family:'body',
        align:'center', valign:'middle', color:'onAccentDark', maxLines:1,
        tracking:0.004, shadow:true },

      { kind:'text', role:'credit',
        x:0.111, y:0.964, w:0.778, h:0.022,
        size:0.019, minSize:0.019, weight:600, family:'body',
        align:'center', valign:'middle', color:'onAccentDark', maxLines:1, opacity:0.6 }
    ]
  },

  {
    id: 'historia-bloque',
    format: 'historia',
    name: 'Bloque',
    desc: 'Foto a sangre y bloque de color con el precio',
    bg: { type:'bands', bands:[
      { from:0,    to:0.58, color:'accentSoft' },
      { from:0.58, to:1,    color:'accentDark' }
    ]},
    slots: [
      { kind:'photo', role:'photo', x:0, y:0, w:1, h:0.60, shape:'rect', radius:0 },

      { kind:'text', role:'name',
        x:0.083, y:0.622, w:0.834, h:0.078,
        size:0.066, minSize:0.034, weight:900, family:'display',
        align:'center', valign:'middle', color:'onAccentDark', lineHeight:1.14, maxLines:2,
        absorb:['desc','price'] },

      { kind:'text', role:'desc',
        x:0.100, y:0.708, w:0.800, h:0.048,
        size:0.030, minSize:0.023, weight:600, family:'body',
        align:'center', valign:'middle', color:'onAccentDark', lineHeight:1.35, maxLines:2,
        opacity:0.88 },

      // El precio va dentro de una píldora blanca: destaca y garantiza contraste.
      { kind:'shape', role:'pricepill', hideWith:'price',
        x:0.24, y:0.770, w:0.52, h:0.074, shape:'rect', radius:0.037, color:'card' },
      { kind:'text', role:'price',
        x:0.26, y:0.777, w:0.48, h:0.060,
        size:0.055, minSize:0.030, weight:900, family:'display',
        align:'center', valign:'middle', color:'accentInk', maxLines:1 },

      // Con logo cargado se dibuja el logo; si no, el nombre escrito.
      { kind:'logo', role:'logo',
        x:0.2900, y:0.8750, w:0.4200, h:0.0460 },
      { kind:'text', role:'brand', hideWhen:'logo',
        x:0.111, y:0.878, w:0.778, h:0.040,
        size:0.042, minSize:0.026, weight:700, family:'display',
        align:'center', valign:'middle', color:'onAccentDark', maxLines:1 },
      { kind:'text', role:'handle',
        x:0.111, y:0.930, w:0.778, h:0.028,
        size:0.029, minSize:0.022, weight:700, family:'body',
        align:'center', valign:'middle', color:'onAccentDark', maxLines:1, tracking:0.004 },
      { kind:'text', role:'credit',
        x:0.111, y:0.964, w:0.778, h:0.022,
        size:0.019, minSize:0.019, weight:600, family:'body',
        align:'center', valign:'middle', color:'onAccentDark', maxLines:1, opacity:0.6 }
    ]
  },

  {
    id: 'historia-circulo',
    format: 'historia',
    name: 'Círculo',
    desc: 'Foto redonda sobre fondo suave, estilo delicado',
    bg: { type:'linear', angle:135, stops:[
      { at:0,   color:'accentSoft' },
      { at:0.5, color:'card'       },
      { at:1,   color:'accentSoft' }
    ]},
    decor: [
      { shape:'circle', x:0.60, y:0.045, w:0.62, h:0.35, color:'accent', opacity:0.16 },
      { shape:'circle', x:-0.22, y:0.72, w:0.55, h:0.31, color:'accent', opacity:0.13 }
    ],
    slots: [
      // Diámetro 0.70·W = 756 px, que en alto es 756/1920 = 0.394·H.
      { kind:'photo', role:'photo', x:0.15, y:0.145, w:0.70, h:0.394, shape:'circle' },

      { kind:'text', role:'name',
        x:0.111, y:0.578, w:0.778, h:0.082,
        size:0.070, minSize:0.036, weight:900, family:'display',
        align:'center', valign:'middle', color:'ink', lineHeight:1.14, maxLines:2,
        absorb:['desc','price'] },

      { kind:'text', role:'desc',
        x:0.111, y:0.668, w:0.778, h:0.048,
        size:0.031, minSize:0.024, weight:600, family:'body',
        align:'center', valign:'middle', color:'muted', lineHeight:1.35, maxLines:2 },

      { kind:'shape', role:'rule', hideWith:'price',
        x:0.44, y:0.734, w:0.12, h:0.0035, shape:'rect', radius:0.002, color:'accent' },

      { kind:'text', role:'price',
        x:0.139, y:0.760, w:0.722, h:0.066,
        size:0.070, minSize:0.036, weight:900, family:'display',
        align:'center', valign:'middle', color:'accentInk', maxLines:1 },

      // Con logo cargado se dibuja el logo; si no, el nombre escrito.
      { kind:'logo', role:'logo',
        x:0.2900, y:0.8709, w:0.4200, h:0.0483 },
      { kind:'text', role:'brand', hideWhen:'logo',
        x:0.111, y:0.874, w:0.778, h:0.042,
        size:0.043, minSize:0.026, weight:700, family:'display',
        align:'center', valign:'middle', color:'onAccentSoft', maxLines:1 },
      { kind:'text', role:'handle',
        x:0.111, y:0.918, w:0.778, h:0.028,
        size:0.029, minSize:0.022, weight:700, family:'body',
        align:'center', valign:'middle', color:'accentInkSoft', maxLines:1, tracking:0.004 },
      { kind:'text', role:'credit',
        x:0.111, y:0.955, w:0.778, h:0.022,
        size:0.019, minSize:0.019, weight:600, family:'body',
        align:'center', valign:'middle', color:'onAccentSoft', maxLines:1, opacity:0.5 }
    ]
  },

  {
    id: 'historia-completa',
    format: 'historia',
    name: 'Pantalla completa',
    desc: 'La foto ocupa todo, con el texto sobre un velo',
    bg: { type:'linear', angle:160, stops:[
      { at:0, color:'accent' }, { at:1, color:'accentDark' }
    ]},
    slots: [
      { kind:'photo', role:'photo', x:0, y:0, w:1, h:1, shape:'rect', radius:0 },

      // Velo degradado: sin él, el texto blanco es ilegible sobre fotos claras.
      { kind:'shape', role:'scrim', x:0, y:0.46, w:1, h:0.54, shape:'rect', radius:0,
        gradient:[
          { at:0,    color:'rgba(20,16,26,0)'    },
          { at:0.45, color:'rgba(20,16,26,0.55)' },
          { at:1,    color:'rgba(20,16,26,0.90)' }
        ]},

      { kind:'text', role:'name',
        x:0.083, y:0.668, w:0.834, h:0.084,
        size:0.072, minSize:0.036, weight:900, family:'display',
        align:'center', valign:'middle', color:'white', lineHeight:1.14, maxLines:2,
        shadow:true, absorb:['desc','price'] },

      { kind:'text', role:'desc',
        x:0.100, y:0.760, w:0.800, h:0.046,
        size:0.030, minSize:0.023, weight:600, family:'body',
        align:'center', valign:'middle', color:'white', lineHeight:1.35, maxLines:2,
        shadow:true, opacity:0.92 },

      { kind:'text', role:'price',
        x:0.139, y:0.818, w:0.722, h:0.066,
        size:0.074, minSize:0.038, weight:900, family:'display',
        align:'center', valign:'middle', color:'white', maxLines:1, shadow:true },

      // Con logo cargado se dibuja el logo; si no, el nombre escrito.
      { kind:'logo', role:'logo',
        x:0.2900, y:0.8920, w:0.4200, h:0.0460 },
      { kind:'text', role:'brand', hideWhen:'logo',
        x:0.111, y:0.895, w:0.778, h:0.040,
        size:0.041, minSize:0.026, weight:700, family:'display',
        align:'center', valign:'middle', color:'white', maxLines:1, shadow:true },
      { kind:'text', role:'handle',
        x:0.111, y:0.936, w:0.778, h:0.028,
        size:0.029, minSize:0.022, weight:700, family:'body',
        align:'center', valign:'middle', color:'white', maxLines:1, tracking:0.004, opacity:0.9 },
      { kind:'text', role:'credit',
        x:0.111, y:0.969, w:0.778, h:0.020,
        size:0.018, minSize:0.018, weight:600, family:'body',
        align:'center', valign:'middle', color:'white', maxLines:1, opacity:0.5 }
    ]
  },

  // ---- Catálogo (carrusel 1080x1350) ----
  // Las plantillas de catálogo van en PAREJAS: una portada y una lámina de
  // producto que comparten estética. `pairId` las une y `role` dice cuál es
  // cuál; el selector solo muestra las portadas.

  {
    id: 'catalogo-suave-portada', format:'catalogo', pairId:'catalogo-suave', role:'cover',
    name: 'Suave', desc: 'Portada clara con tu nombre en grande',
    bg: { type:'linear', angle:150, stops:[
      { at:0, color:'accentSoft' }, { at:0.6, color:'accent' }, { at:1, color:'accentDark' }
    ]},
    decor: [
      { shape:'circle', x:0.66, y:0.03, w:0.58, h:0.37, color:'white', opacity:0.14 },
      { shape:'circle', x:-0.20, y:0.74, w:0.55, h:0.35, color:'white', opacity:0.11 }
    ],
    slots: [
      { kind:'text', role:'eyebrow',
        x:0.111, y:0.235, w:0.778, h:0.040,
        size:0.030, minSize:0.024, weight:800, family:'body',
        align:'center', valign:'middle', color:'onAccent', maxLines:1,
        tracking:0.010, transform:'upper' },

      { kind:'text', role:'headline',
        x:0.083, y:0.305, w:0.834, h:0.190,
        size:0.105, minSize:0.050, weight:900, family:'display',
        align:'center', valign:'middle', color:'onAccent', lineHeight:1.10, maxLines:3,
        shadow:true },

      { kind:'shape', role:'rule', x:0.42, y:0.535, w:0.16, h:0.004, shape:'rect', radius:0.002,
        color:'onAccent', opacity:0.7 },

      { kind:'text', role:'subhead',
        x:0.111, y:0.570, w:0.778, h:0.100,
        size:0.042, minSize:0.028, weight:600, family:'body',
        align:'center', valign:'middle', color:'onAccent', lineHeight:1.35, maxLines:3 },

      // Con logo cargado se dibuja el logo; si no, el nombre escrito.
      { kind:'logo', role:'logo',
        x:0.2900, y:0.8409, w:0.4200, h:0.0633 },
      { kind:'text', role:'brand', hideWhen:'logo',
        x:0.111, y:0.845, w:0.778, h:0.055,
        size:0.052, minSize:0.030, weight:700, family:'display',
        align:'center', valign:'middle', color:'onAccentDark', maxLines:1, shadow:true },
      { kind:'text', role:'handle',
        x:0.111, y:0.903, w:0.778, h:0.038,
        size:0.034, minSize:0.024, weight:700, family:'body',
        align:'center', valign:'middle', color:'onAccentDark', maxLines:1, tracking:0.005 },
      { kind:'text', role:'credit',
        x:0.111, y:0.952, w:0.778, h:0.028,
        size:0.024, minSize:0.024, weight:600, family:'body',
        align:'center', valign:'middle', color:'onAccentDark', maxLines:1, opacity:0.6 }
    ]
  },

  {
    id: 'catalogo-suave-item', format:'catalogo', pairId:'catalogo-suave', role:'item',
    name: 'Suave', desc: 'Lámina de producto',
    bg: { type:'bands', bands:[
      { from:0, to:0.655, color:'accentSoft' },
      { from:0.655, to:1, color:'accentDark' }
    ]},
    slots: [
      { kind:'photo', role:'photo', x:0, y:0, w:1, h:0.670, shape:'rect', radius:0 },

      { kind:'text', role:'name',
        x:0.070, y:0.692, w:0.860, h:0.076,
        size:0.068, minSize:0.032, weight:900, family:'display',
        align:'center', valign:'middle', color:'onAccentDark', lineHeight:1.14, maxLines:2,
        absorb:['desc','price'] },

      { kind:'text', role:'desc',
        x:0.090, y:0.775, w:0.820, h:0.044,
        size:0.029, minSize:0.022, weight:600, family:'body',
        align:'center', valign:'middle', color:'onAccentDark', lineHeight:1.35, maxLines:2,
        opacity:0.88 },

      { kind:'shape', role:'pricepill', hideWith:'price',
        x:0.28, y:0.828, w:0.44, h:0.072, shape:'rect', radius:0.036, color:'card' },
      { kind:'text', role:'price',
        x:0.30, y:0.835, w:0.40, h:0.058,
        size:0.050, minSize:0.028, weight:900, family:'display',
        align:'center', valign:'middle', color:'accentInk', maxLines:1 },

      { kind:'text', role:'handle',
        x:0.111, y:0.930, w:0.778, h:0.030,
        size:0.026, minSize:0.020, weight:700, family:'body',
        align:'center', valign:'middle', color:'onAccentDark', maxLines:1,
        tracking:0.004, opacity:0.85 }
    ]
  },

  {
    id: 'catalogo-nitido-portada', format:'catalogo', pairId:'catalogo-nitido', role:'cover',
    name: 'Nítido', desc: 'Portada de color pleno, tipografía grande',
    bg: { type:'solid', color:'accentDark' },
    decor: [
      { shape:'circle', x:0.58, y:-0.12, w:0.80, h:0.64, color:'accent', opacity:0.55 },
      { shape:'circle', x:-0.30, y:0.66, w:0.72, h:0.58, color:'accent', opacity:0.40 }
    ],
    slots: [
      { kind:'text', role:'eyebrow',
        x:0.100, y:0.180, w:0.800, h:0.040,
        size:0.030, minSize:0.024, weight:800, family:'body',
        align:'left', valign:'middle', color:'onAccentDark', maxLines:1,
        tracking:0.012, transform:'upper' },

      { kind:'text', role:'headline',
        x:0.100, y:0.245, w:0.800, h:0.235,
        size:0.125, minSize:0.052, weight:900, family:'display',
        align:'left', valign:'middle', color:'onAccentDark', lineHeight:1.05, maxLines:3 },

      { kind:'shape', role:'rule', x:0.100, y:0.510, w:0.22, h:0.008, shape:'rect', radius:0.004,
        color:'card' },

      { kind:'text', role:'subhead',
        x:0.100, y:0.552, w:0.800, h:0.110,
        size:0.044, minSize:0.028, weight:600, family:'body',
        align:'left', valign:'middle', color:'onAccentDark', lineHeight:1.35, maxLines:3 },

      // Con logo cargado se dibuja el logo; si no, el nombre escrito.
      { kind:'logo', role:'logo',
        x:0.1000, y:0.8439, w:0.4000, h:0.0633 },
      { kind:'text', role:'brand', hideWhen:'logo',
        x:0.100, y:0.848, w:0.800, h:0.055,
        size:0.054, minSize:0.030, weight:900, family:'display',
        align:'left', valign:'middle', color:'onAccentDark', maxLines:1 },
      { kind:'text', role:'handle',
        x:0.100, y:0.906, w:0.800, h:0.038,
        size:0.034, minSize:0.024, weight:700, family:'body',
        align:'left', valign:'middle', color:'onAccentDark', maxLines:1, tracking:0.005 },
      { kind:'text', role:'credit',
        x:0.100, y:0.952, w:0.800, h:0.028,
        size:0.024, minSize:0.024, weight:600, family:'body',
        align:'left', valign:'middle', color:'onAccentDark', maxLines:1, opacity:0.55 }
    ]
  },

  {
    id: 'catalogo-nitido-item', format:'catalogo', pairId:'catalogo-nitido', role:'item',
    name: 'Nítido', desc: 'Lámina de producto',
    bg: { type:'solid', color:'accentDark' },
    slots: [
      { kind:'photo', role:'photo', x:0.055, y:0.042, w:0.890, h:0.610, shape:'rect', radius:0.030 },

      { kind:'text', role:'name',
        x:0.100, y:0.686, w:0.800, h:0.078,
        size:0.070, minSize:0.032, weight:900, family:'display',
        align:'left', valign:'middle', color:'onAccentDark', lineHeight:1.12, maxLines:2,
        absorb:['desc','price'] },

      { kind:'text', role:'desc',
        x:0.100, y:0.772, w:0.800, h:0.044,
        size:0.029, minSize:0.022, weight:600, family:'body',
        align:'left', valign:'middle', color:'onAccentDark', lineHeight:1.35, maxLines:2,
        opacity:0.85 },

      { kind:'text', role:'price',
        x:0.100, y:0.828, w:0.800, h:0.066,
        size:0.060, minSize:0.030, weight:900, family:'display',
        align:'left', valign:'middle', color:'card', maxLines:1 },

      { kind:'text', role:'handle',
        x:0.100, y:0.925, w:0.800, h:0.032,
        size:0.026, minSize:0.020, weight:700, family:'body',
        align:'left', valign:'middle', color:'onAccentDark', maxLines:1,
        tracking:0.004, opacity:0.8 }
    ]
  }
];

function studioTemplate(id) {
  return STUDIO_TEMPLATES.find(t => t.id === id) || STUDIO_TEMPLATES[0];
}

// Las que puede elegir la creadora. En catálogo solo se ofrecen las portadas:
// la lámina de producto viene emparejada y no se elige por separado.
function studioTemplatesFor(format) {
  return STUDIO_TEMPLATES.filter(t => t.format === format && t.role !== 'item');
}

// Qué plantilla le toca a esta diapositiva concreta. En un carrusel la
// portada y las láminas son distintas pero comparten pairId, así que la
// estética se mantiene sin que la creadora tenga que elegir dos veces.
function studioSlideTemplate(piece, slide) {
  const base = studioTemplate(piece.templateId);
  if (!base.pairId) return base;
  const quiero = (slide && slide.kind === 'cover') ? 'cover' : 'item';
  if (base.role === quiero) return base;
  return STUDIO_TEMPLATES.find(t => t.pairId === base.pairId && t.role === quiero) || base;
}

// ===================================================
// STUDIO — COLOR
// ===================================================
// Toda la paleta de una publicación se deriva de UN color elegido por la
// creadora. Así cualquier acento produce una pieza coherente y legible.

function studioHexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}

function studioRgbToHex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return ('#' + c(r) + c(g) + c(b)).toUpperCase();
}

function studioHexToHsl(hex) {
  let { r, g, b } = studioHexToRgb(hex);
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = ((b - r) / d + 2);
    else                h = ((r - g) / d + 4);
    h /= 6;
  }
  return { h: h * 360, s, l };
}

function studioHslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  if (s === 0) { const v = l * 255; return studioRgbToHex(v, v, v); }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return studioRgbToHex(hue2rgb(p,q,h+1/3) * 255, hue2rgb(p,q,h) * 255, hue2rgb(p,q,h-1/3) * 255);
}

// Luminancia relativa (WCAG 2.1) para decidir si encima va texto blanco o tinta.
function studioLuminance(hex) {
  const { r, g, b } = studioHexToRgb(hex);
  const ch = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  return 0.2126*ch(r) + 0.7152*ch(g) + 0.0722*ch(b);
}

const STUDIO_INK = '#1E1E2E';   // --text

// Contraste WCAG 2.1 entre dos colores (1:1 a 21:1).
function studioContrast(a, b) {
  const la = studioLuminance(a), lb = studioLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Color de texto legible sobre un fondo dado.
// Se elige por CONTRASTE MEDIDO, no por un umbral de luminancia a ojo: con un
// umbral fijo los acentos de tono medio (coral, rosa, morado, azul) se
// llevaban texto blanco a 2,8:1, muy por debajo del mínimo de 4,5:1. La tinta
// oscura sobre esos mismos colores da más del doble de contraste.
function studioOnColor(hex) {
  return studioContrast(hex, '#FFFFFF') >= studioContrast(hex, STUDIO_INK)
    ? '#FFFFFF'
    : STUDIO_INK;
}

// Mejor contraste alcanzable sobre un fondo, con blanco o con tinta.
function studioBestContrast(hex) {
  return Math.max(studioContrast(hex, '#FFFFFF'), studioContrast(hex, STUDIO_INK));
}

// Hay una franja de luminancia media (~0.18) donde NINGÚN texto plano llega a
// 4,5:1: ni el blanco ni la tinta. Los fondos que derivamos nosotros no tienen
// por qué quedarse ahí, así que los empujamos en la dirección indicada hasta
// que admitan texto legible. El acento de la creadora no se toca nunca: ese
// color es suyo.
function studioReadableBg(hex, dir, min = 4.5) {
  let { h, s, l } = studioHexToHsl(hex);
  let out = hex;
  for (let i = 0; i < 24 && studioBestContrast(out) < min; i++) {
    l = Math.max(0, Math.min(1, l + dir * 0.03));
    out = studioHslToHex(h, s, l);
    if (l <= 0 || l >= 1) break;
  }
  return out;
}

// El acento como color de TEXTO sobre un fondo claro. Conserva el tono de la
// creadora y solo lo oscurece lo justo para que se lea: un acento amarillo o
// lima puesto tal cual sobre la tarjeta blanca es invisible.
function studioReadableInk(hex, bg, min = 4.5) {
  let { h, s, l } = studioHexToHsl(hex);
  let out = hex;
  for (let i = 0; i < 30 && studioContrast(out, bg) < min; i++) {
    l -= 0.025;
    if (l <= 0) return STUDIO_INK;
    out = studioHslToHex(h, s, l);
  }
  return out;
}

// Deriva todos los tokens de color a partir del acento.
function studioPalette(accentHex) {
  const accent = /^#[0-9A-Fa-f]{6}$/.test(accentHex || '') ? accentHex : STUDIO_BRAND_DEFAULT.accent;
  const { h, s, l } = studioHexToHsl(accent);
  // accentDark y accentSoft son fondos nuestros y llevan texto encima: los
  // garantizamos legibles empujándolos fuera de la franja de contraste muerto.
  const accentDark = studioReadableBg(studioHslToHex(h, s, l - 0.18), -1);
  const accentSoft = studioReadableBg(studioHslToHex(h, s * 0.45, 0.93), +1);
  return {
    accent, accentDark, accentSoft,
    accentDeep: studioHslToHex(h, s, l - 0.34),
    // El acento usable como TEXTO sobre la tarjeta blanca (precio, titulares).
    accentInk:     studioReadableInk(accent, '#FFFFFF'),
    accentInkSoft: studioReadableInk(accent, accentSoft),
    ink:   STUDIO_INK,
    // Más oscuro que el --muted del CSS a propósito. En la app ese gris lila
    // claro es parte del aire de la marca y se lee en pantalla; aquí acaba
    // dentro de un JPG que se mira en el feed de Instagram, en miniatura y
    // con el brillo del teléfono a la baja, y ahí la descripción se perdía.
    muted: '#736787',
    card:  '#FFFFFF',
    white: '#FFFFFF',
    // Un token "on*" por cada fondo sobre el que puede caer texto. Usar
    // siempre el que corresponde al fondo REAL de esa zona de la plantilla.
    onAccent:     studioOnColor(accent),
    onAccentDark: studioOnColor(accentDark),
    onAccentSoft: studioOnColor(accentSoft)
  };
}

// Resuelve el nombre de un token a su valor. Un color literal (#hex, rgb(),
// rgba()) pasa tal cual: los velos degradados necesitan alfa, y eso no puede
// expresarse con un token de la paleta.
function studioColor(token, pal) {
  if (typeof token !== 'string') return pal.ink;
  if (token.charAt(0) === '#' || /^rgba?\(/i.test(token)) return token;
  return pal[token] || pal.ink;
}

// ===================================================
// STUDIO — TIPOGRAFÍA
// ===================================================
// Fraunces y Nunito se sirven locales desde assets/fonts/ y van precacheadas
// por el Service Worker, pero aun así pueden no estar (portable sin conexión,
// caché desalojada). El canvas es más frágil que el DOM porque ctx.font no
// dispara la carga y hace fallback silencioso. La defensa es doble:
//   1. preview y export usan SIEMPRE la misma cadena de fuentes completa, así
//      que si cae al respaldo lo hacen los dos igual y siguen coincidiendo;
//   2. avisamos a la creadora en vez de sorprenderla con otra tipografía.
// Solo se pueden usar los pesos que declara el <link> de index.html
// (Fraunces 700/900, Nunito 400/600/700/800/900): cualquier otro lo sintetiza
// el navegador y el canvas puede diferir del preview.

const STUDIO_FONTS = {
  display: { name:'Fraunces', stack:"'Fraunces', Georgia, 'Times New Roman', serif" },
  body:    { name:'Nunito',   stack:"'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif" }
};

let STUDIO_FONTS_OK = true;
let _studioFontsPromise = null;

function studioFontsReady() {
  if (_studioFontsPromise) return _studioFontsPromise;
  _studioFontsPromise = (async () => {
    try {
      if (!document.fonts) { STUDIO_FONTS_OK = false; return; }
      await Promise.race([
        Promise.all([
          document.fonts.load('900 100px Fraunces', 'Aa$0'),
          document.fonts.load('700 100px Fraunces', 'Aa$0'),
          document.fonts.load('800 100px Nunito',   'Aa$0'),
          document.fonts.ready
        ]),
        // Nunca colgar: en file:// sin conexión fonts.ready puede no resolver.
        new Promise(r => setTimeout(r, 1500))
      ]);
      STUDIO_FONTS_OK = document.fonts.check('900 100px Fraunces')
                     && document.fonts.check('800 100px Nunito');
    } catch(e) {
      STUDIO_FONTS_OK = false;
    }
  })();
  return _studioFontsPromise;
}

function studioFontStr(slot, sizePx) {
  const fam = STUDIO_FONTS[slot.family === 'body' ? 'body' : 'display'].stack;
  return `${slot.weight || 700} ${sizePx}px ${fam}`;
}

// ===================================================
// STUDIO — MOTOR DE RENDER (Canvas 2D)
// ===================================================
// Una sola función dibuja tanto el preview como el archivo exportado; lo
// único que cambia es la transformación del contexto. Así el WYSIWYG está
// garantizado por construcción, no por mantener dos rutas en sincronía.

// roundRect no existe en Safari antiguo: trazamos el camino a mano.
function studioRoundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function studioShapePath(ctx, slot, W, H) {
  const x = slot.x * W, y = slot.y * H, w = slot.w * W, h = slot.h * H;
  if (slot.shape === 'circle') {
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI * 2);
    ctx.closePath();
  } else {
    studioRoundRectPath(ctx, x, y, w, h, (slot.radius || 0) * W);
  }
}

function studioDrawShape(ctx, slot, pal, W, H) {
  ctx.save();
  ctx.globalAlpha = slot.opacity == null ? 1 : slot.opacity;

  if (slot.gradient) {
    // Gradiente vertical dentro de la propia forma. Sirve para los velos que
    // oscurecen el pie de una foto a sangre y hacen legible el texto encima.
    const g = ctx.createLinearGradient(0, slot.y * H, 0, (slot.y + slot.h) * H);
    slot.gradient.forEach(s => g.addColorStop(s.at, studioColor(s.color, pal)));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = studioColor(slot.color, pal);
  }

  studioShapePath(ctx, slot, W, H);
  ctx.fill();
  ctx.restore();
}

function studioDrawBackground(ctx, tpl, pal, W, H) {
  const bg = tpl.bg || { type:'solid', color:'accent' };

  if (bg.type === 'bands') {
    bg.bands.forEach(b => {
      ctx.fillStyle = studioColor(b.color, pal);
      ctx.fillRect(0, b.from * H, W, (b.to - b.from) * H);
    });
  } else {
    let fill;
    if (bg.type === 'linear') {
      const a = (bg.angle == null ? 90 : bg.angle) * Math.PI / 180;
      const r = Math.max(W, H);
      const cx = W/2, cy = H/2;
      fill = ctx.createLinearGradient(
        cx - Math.cos(a) * r/2, cy - Math.sin(a) * r/2,
        cx + Math.cos(a) * r/2, cy + Math.sin(a) * r/2
      );
      bg.stops.forEach(s => fill.addColorStop(s.at, studioColor(s.color, pal)));
    } else if (bg.type === 'radial') {
      fill = ctx.createRadialGradient(bg.cx*W, bg.cy*H, 0, bg.cx*W, bg.cy*H, bg.r*W);
      bg.stops.forEach(s => fill.addColorStop(s.at, studioColor(s.color, pal)));
    } else {
      fill = studioColor(bg.color, pal);
    }
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, W, H);
  }

  // Adornos geométricos: el mismo lenguaje visual que los blobs del fondo de
  // la app, pero sin ctx.filter='blur()', que es correcto y carísimo en móvil.
  (tpl.decor || []).forEach(d => studioDrawShape(ctx, d, pal, W, H));
}

// ---- Texto: wrap + autoescalado ----

// Parte el texto en líneas que quepan en maxW. Si una palabra sola no cabe,
// la corta por caracteres (un nombre de 60 letras no puede romper el diseño).
// NO limita el número de líneas: quien llama decide si reducir la fuente o
// truncar. Si esta función truncara, el autoescalado nunca se activaría —
// siempre vería un bloque que "cabe" y jamás bajaría el tamaño.
function studioWrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';

  const pushChunked = (word) => {
    let chunk = '';
    for (const ch of word) {
      if (ctx.measureText(chunk + ch).width > maxW && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    cur = chunk;
  };

  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width <= maxW) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      if (ctx.measureText(w).width > maxW) pushChunked(w);
      else cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (!lines.length) lines.push('');
  return lines;
}

// Último recurso: recorta el bloque a maxLines y marca el corte con "…".
function studioTruncateLines(ctx, lines, maxW, maxLines) {
  if (lines.length <= maxLines) return lines;
  let last = lines[maxLines - 1];
  while (last.length > 1 && ctx.measureText(last + '…').width > maxW) {
    last = last.slice(0, -1);
  }
  const out = lines.slice(0, maxLines);
  out[maxLines - 1] = last.replace(/\s+$/, '') + '…';
  return out;
}

// Busca el mayor tamaño de fuente con el que el texto entero cabe en su caja:
// ancho, alto y número de líneas. Baja de a 6% (converge en 12 pasos o menos)
// y solo trunca si al llegar a minSize sigue sin caber.
function studioFitText(ctx, text, slot, W, H) {
  const maxW  = slot.w * W;
  const maxH  = slot.h * H;
  const lh    = slot.lineHeight || 1.15;
  const min   = (slot.minSize || slot.size * 0.6) * W;
  const maxLn = slot.maxLines || 3;
  let size    = slot.size * W;
  let lines;

  for (;;) {
    ctx.font = studioFontStr(slot, size);
    lines = studioWrapLines(ctx, text, maxW);
    const blockH = lines.length * size * lh;
    const widest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
    const cabe = lines.length <= maxLn && blockH <= maxH && widest <= maxW;
    if (cabe || size <= min) break;
    size = Math.max(min, size * 0.94);
  }

  // Con la fuente ya fijada, recortamos lo que aún no quepa.
  ctx.font = studioFontStr(slot, size);
  const porAltura = Math.max(1, Math.floor(maxH / (size * lh)));
  return { lines: studioTruncateLines(ctx, lines, maxW, Math.min(maxLn, porAltura)), size };
}

// Dibuja una línea carácter a carácter para aplicar letter-spacing.
// No usamos ctx.letterSpacing: no existe en Safari anterior a 17.
function studioDrawTracked(ctx, line, cx, y, tracking, align, maxW) {
  const chars = [...line];
  const total = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0)
              + tracking * Math.max(0, chars.length - 1);
  let x = align === 'left'  ? cx
        : align === 'right' ? cx + maxW - total
        : cx + (maxW - total) / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + tracking;
  }
  ctx.textAlign = prev;
}

function studioDrawText(ctx, slot, text, pal, W, H) {
  if (text == null || text === '') return;
  const str = slot.transform === 'upper' ? String(text).toUpperCase() : String(text);

  ctx.save();
  ctx.globalAlpha  = slot.opacity == null ? 1 : slot.opacity;
  ctx.fillStyle    = studioColor(slot.color, pal);
  ctx.textBaseline = 'top';

  const { lines, size } = studioFitText(ctx, str, slot, W, H);
  ctx.font = studioFontStr(slot, size);

  const lh = slot.lineHeight || 1.15;
  const boxX = slot.x * W, boxY = slot.y * H, boxW = slot.w * W, boxH = slot.h * H;
  const blockH = lines.length * size * lh;

  let y = slot.valign === 'top'    ? boxY
        : slot.valign === 'bottom' ? boxY + boxH - blockH
        : boxY + (boxH - blockH) / 2;

  // Sombra suave para el texto que va sobre foto o gradiente.
  if (slot.shadow) {
    ctx.shadowColor   = 'rgba(30,30,46,0.35)';
    ctx.shadowBlur    = size * 0.14;
    ctx.shadowOffsetY = size * 0.03;
  }

  const align = slot.align || 'center';
  const tracking = (slot.tracking || 0) * W;

  ctx.textAlign = align;
  const anchorX = align === 'left' ? boxX : align === 'right' ? boxX + boxW : boxX + boxW/2;

  for (const line of lines) {
    // El interlineado deja un poco de aire arriba de cada línea.
    const ly = y + (size * lh - size) / 2;
    if (tracking) studioDrawTracked(ctx, line, boxX, ly, tracking, align, boxW);
    else          ctx.fillText(line, anchorX, ly);
    y += size * lh;
  }

  ctx.restore();
}

// ---- Render de una diapositiva completa ----
// Dibuja SIEMPRE en coordenadas nativas (1080 × H). Quien llama decide la
// escala con ctx.setTransform antes de invocarla.
function studioRenderSlide(ctx, slide, tpl, pal, W, H) {
  studioDrawBackground(ctx, tpl, pal, W, H);

  for (const slot of tpl.slots) {
    // hideWith: un adorno atado a un contenido (la píldora del precio, un
    // filete) desaparece cuando ese contenido falta; si no, queda una forma
    // suelta sin nada dentro.
    if (slot.hideWith && !studioSlotText(slot.hideWith, slide)) continue;
    // hideWhen: lo contrario — este slot cede su sitio cuando otro SÍ tiene
    // contenido. Lo usa el nombre escrito de la marca, que se retira cuando
    // hay un logo para no mostrar la marca dos veces.
    if (slot.hideWhen && studioSlotText(slot.hideWhen, slide)) continue;

    if (slot.kind === 'shape') {
      studioDrawShape(ctx, slot, pal, W, H);
    } else if (slot.kind === 'photo') {
      studioDrawPhoto(ctx, slot, slide, pal, W, H);
    } else if (slot.kind === 'logo') {
      studioDrawLogo(ctx, slot, W, H);
    } else if (slot.kind === 'text') {
      studioDrawText(ctx, studioResolveSlot(slot, tpl, slide), studioSlotText(slot.role, slide), pal, W, H);
    }
  }
}

// Un slot puede declarar `absorb: [roles]`: si esos roles quedan vacíos (por
// ejemplo el precio cuando la creadora elige no publicarlo), este slot se
// queda con su espacio. Sin esto la tarjeta quedaría con un hueco muerto.
//
// El hueco solo se absorbe si es CONTIGUO. En las plantillas el orden es
// nombre → descripción → precio, así que al publicar sin precio el nombre
// tenía dos huecos declarados y se estiraba hasta el final del precio,
// pasando por encima de la descripción, que sí tenía texto. Como el nombre
// va centrado en su caja, terminaba dibujado justo sobre ella. Por eso la
// expansión avanza hacia cada lado y se detiene en el primer slot que se va
// a dibujar con contenido.
function studioResolveSlot(slot, tpl, slide) {
  if (!slot.absorb) return slot;

  const texto = (s) => studioSlotText(s.role, slide);
  // Mismas reglas que usa studioRenderSlide para decidir si un slot sale.
  const seDibuja = (s) => {
    if (s.hideWith && !studioSlotText(s.hideWith, slide)) return false;
    if (s.hideWhen && studioSlotText(s.hideWhen, slide)) return false;
    return true;
  };
  const absorbible = (s) => s.kind === 'text' && slot.absorb.includes(s.role) && !texto(s);
  const estorba    = (s) => s.kind === 'text' && seDibuja(s) && texto(s);

  const otros = tpl.slots.filter(s => s !== slot);
  let top = slot.y;
  let bot = slot.y + slot.h;

  // Hacia abajo, de más cercano a más lejano.
  for (const s of otros.filter(s => s.y >= bot).sort((a, b) => a.y - b.y)) {
    if (estorba(s)) break;
    if (absorbible(s)) bot = Math.max(bot, s.y + s.h);
  }
  // Y hacia arriba, por si alguna plantilla futura pone el hueco antes.
  for (const s of otros.filter(s => s.y + s.h <= top).sort((a, b) => b.y - a.y)) {
    if (estorba(s)) break;
    if (absorbible(s)) top = Math.min(top, s.y);
  }

  if (top === slot.y && bot === slot.y + slot.h) return slot;
  return { ...slot, y: top, h: bot - top };
}

function studioDrawPhoto(ctx, slot, slide, pal, W, H) {
  const photo = studioGetPhoto(slide);

  ctx.save();
  studioShapePath(ctx, slot, W, H);
  ctx.fillStyle = pal.accentSoft;
  ctx.fill();
  ctx.clip();

  const dx = slot.x*W, dy = slot.y*H, dw = slot.w*W, dh = slot.h*H;

  if (photo) {
    const f = slide.frame || { zoom:1, ox:0, oy:0 };
    const { sx, sy, sw, sh } = studioCoverRect(photo.width, photo.height, dw, dh, f.zoom, f.ox, f.oy);
    ctx.drawImage(photo, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
    return;
  }

  // Sin foto: marcador que deja ver la composición completa igualmente.
  const cx = dx + dw/2, cy = dy + dh/2;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = pal.accentDeep;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = studioFontStr({ weight:400, family:'body' }, W * 0.13);
  // Aquí sí hay respaldo: es solo el marcador de "falta la foto", no el icono
  // del producto, así que un hueco vacío se vería como un error.
  ctx.fillText(slide.emoji || '📷', cx, cy - W * 0.03);
  ctx.font = studioFontStr({ weight:700, family:'body' }, W * 0.030);
  ctx.fillText('Agrega tu foto', cx, cy + W * 0.075);
  ctx.restore();
}

// ===================================================
// STUDIO — FOTOS
// ===================================================
// Las fotos GRANDES viven SOLO en memoria, a propósito. Una foto de 1080x1350
// en base64 pesa entre 330 y 600 KB, sobre un presupuesto de localStorage de
// ~5 MB que ya comparte con pc_v1: con cinco fotos, persistProducts()
// empezaría a fallar y la creadora perdería la capacidad de guardar
// productos, que es el corazón de la app. IndexedDB queda descartado por
// ahora porque en file:// es errático y el archivo portable es un requisito
// duro. Todo pasa por studioGetPhoto/studioSetPhoto, así que añadir una capa
// persistente más adelante es cambiar dos funciones.
//
// Lo que SÍ se persiste es una miniatura de 200px (~10-20 KB en JPEG) por
// producto, generada aquí al subir la foto y guardada en pc_thumbs_v1 vía
// setThumb() (app.js → MINIATURAS DE PRODUCTO). Queda fuera del respaldo
// JSON a propósito: es un recuerdo visual para la lista, no un dato.
const STUDIO_PHOTO_MAX = 1800;    // px del lado mayor
const STUDIO_PHOTO_MAX_BYTES = 20 * 1024 * 1024;
const STUDIO_ZOOM_MAX = 2.5;
const STUDIO_THUMB_SIZE = 200;    // lado de la miniatura persistida

function studioGetPhoto(slide) {
  return (slide && slide.photo) || null;
}

function studioSetPhoto(slide, canvas) {
  if (slide.photo && slide.photo !== canvas) {
    slide.photo.width = slide.photo.height = 0;   // iOS no libera solo
  }
  slide.photo = canvas;
  slide.frame = { zoom: 1, ox: 0, oy: 0 };
}

function studioFileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen ilegible')); };
    img.src = url;
  });
}

function studioFitWithin(w, h, max) {
  const k = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

// Carga robusta de una foto del dispositivo:
//   - corrige la orientación EXIF (las fotos de iPhone salen giradas si no),
//   - reduce a STUDIO_PHOTO_MAX para cuidar la memoria del teléfono,
//   - devuelve un <canvas> propio, que nunca contamina el canvas de export
//     (un canvas "teñido" hace que toBlob lance SecurityError).
async function studioLoadPhoto(file, maxDim = STUDIO_PHOTO_MAX) {
  const toCanvas = (src, sw, sh) => {
    const { width, height } = studioFitWithin(sw, sh, maxDim);
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    c.getContext('2d').drawImage(src, 0, 0, width, height);
    return c;
  };
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const c = toCanvas(bmp, bmp.width, bmp.height);
    if (bmp.close) bmp.close();
    return c;
  } catch(e) {
    // Fallback para navegadores sin imageOrientation en createImageBitmap.
    const img = await studioFileToImage(file);
    return toCanvas(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
  }
}

// Recorte tipo object-fit:cover con zoom y desplazamiento.
//   zoom 1 = la foto llena el hueco; ox/oy en [-1,1], 0 = centrado.
// El recorte se limita dentro del propio cálculo, así que NUNCA puede
// quedar un borde vacío por más que se arrastre.
function studioCoverRect(sw0, sh0, dw, dh, zoom, ox, oy) {
  const z = Math.max(1, Math.min(STUDIO_ZOOM_MAX, zoom || 1));
  const scale = Math.max(dw / sw0, dh / sh0) * z;
  const sw = Math.min(sw0, dw / scale);
  const sh = Math.min(sh0, dh / scale);
  const maxX = sw0 - sw, maxY = sh0 - sh;
  const clamp01 = v => Math.max(0, Math.min(1, 0.5 + (v || 0) / 2));
  return { sx: maxX * clamp01(ox), sy: maxY * clamp01(oy), sw, sh };
}

// Miniatura cuadrada para la lista de productos: center-crop (el frame recién
// reseteado equivale a cover centrado) sobre fondo blanco — JPEG no tiene alfa
// y un PNG transparente saldría negro, mismo gotcha que el logo. Devuelve un
// data URL, o null si ni bajando la calidad cabe en el tope.
function studioMakeThumb(photo) {
  const size = STUDIO_THUMB_SIZE;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  const r = studioCoverRect(photo.width, photo.height, size, size, 1, 0, 0);
  ctx.drawImage(photo, r.sx, r.sy, r.sw, r.sh, 0, 0, size, size);
  let url = c.toDataURL('image/jpeg', 0.72);
  if (url.length > THUMB_MAX_STORED) url = c.toDataURL('image/jpeg', 0.5);
  c.width = c.height = 0;   // iOS no libera solo
  return url.length <= THUMB_MAX_STORED ? url : null;
}

async function studioPickPhoto(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;

  if (!/^image\//.test(file.type)) { toast('⚠️ Eso no es una imagen'); return; }
  if (file.size > STUDIO_PHOTO_MAX_BYTES) { toast('⚠️ La foto es muy pesada (máx. 20 MB)'); return; }

  try {
    const canvas = await studioLoadPhoto(file);
    const slide  = studioActiveSlide();
    studioSetPhoto(slide, canvas);
    // La portada del catálogo no tiene productId: ahí no hay a quién colgarle
    // la miniatura. El fallo silencioso es deliberado: la miniatura es un
    // extra, la foto del Estudio no depende de ella.
    if (slide && slide.productId) {
      try {
        const t = studioMakeThumb(canvas);
        if (t) setThumb(slide.productId, t);
      } catch(e) {}
    }
    studioRequestPreview();
    // Foto nueva, encuadre nuevo: el modo arranca apagado para que la pantalla
    // se pueda seguir deslizando mientras la mira.
    STUDIO._framing = false;
    renderStudioPhotoBar();
    toast('📷 ¡Foto lista! Toca "Mover la foto" para elegir qué parte se ve');
  } catch(e) {
    // Caso típico: un HEIC de iPhone abierto en Android o escritorio.
    toast('❌ No se pudo leer esa foto. Prueba con una JPG o PNG.');
  }
}

function studioCenterPhoto() {
  const slide = studioActiveSlide();
  if (!slide || !slide.photo) return;
  slide.frame = { zoom: 1, ox: 0, oy: 0 };
  const z = document.getElementById('studio-zoom');
  if (z) z.value = '1';
  studioRequestPreview();
}

// La vista previa ocupa casi toda la pantalla del teléfono. Si se quedara con
// los gestos táctiles de forma permanente no habría por dónde bajar por el
// editor con el dedo, así que el bloqueo se enciende a mano y solo mientras
// dura el encuadre. Sin foto no hay nada que mover: el modo no puede activarse.
function toggleStudioFraming(on) {
  const slide = studioActiveSlide();
  const quiere = on == null ? !STUDIO._framing : !!on;
  STUDIO._framing = quiere && !!(slide && slide.photo);
  applyStudioFraming();
}

// Refleja el flag en el DOM SIN volver a pintar la barra de foto: un innerHTML
// se llevaría por delante el botón que la creadora acaba de tocar y el foco se
// perdería a mitad de la interacción. Tampoco repinta el canvas: el modo no
// cambia un solo píxel de la publicación.
function applyStudioFraming() {
  const on = !!STUDIO._framing;

  const stage = document.querySelector('.studio-stage');
  if (stage) stage.classList.toggle('encuadrando', on);

  const btn = document.getElementById('studio-frame-btn');
  if (btn) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.textContent = on ? '✓ Listo' : '✥ Mover la foto';
  }

  const hint = document.getElementById('studio-frame-hint');
  if (hint) hint.textContent = studioFrameHint(on);
}

function studioFrameHint(on) {
  return on
    ? 'Arrastra la foto sobre la vista previa para elegir qué parte se ve, y pellizca para acercarla. Cuando termines toca "Listo" y vuelves a deslizar la pantalla.'
    : '¿Quieres cambiar la parte de la foto que se ve? Toca "Mover la foto".';
}

function setStudioZoom(value) {
  const slide = studioActiveSlide();
  if (!slide || !slide.frame) return;
  slide.frame.zoom = Math.max(1, Math.min(STUDIO_ZOOM_MAX, parseFloat(value) || 1));
  studioRequestPreview();
}

// Arrastre y pellizco sobre el canvas para encuadrar la foto. El viewport NO
// bloquea el zoom del navegador (a propósito: pellizcar para ampliar es
// accesibilidad básica); con el modo encuadre apagado el pellizco amplía la
// página, y con el modo encendido el canvas declara touch-action:none en el
// CSS y se queda con el gesto para acercar la foto.
function studioAttachGestures(canvasEl) {
  const pts = new Map();
  let start = null;

  const slotRect = (slide) => {
    const tpl = studioSlideTemplate(STUDIO.piece, slide);
    const slot = tpl.slots.find(s => s.kind === 'photo');
    const f = STUDIO_FORMATS[STUDIO.piece.format];
    return slot ? { w: slot.w * f.w, h: slot.h * f.h } : null;
  };

  const begin = () => {
    const slide = studioActiveSlide();
    if (!slide || !slide.photo) return null;
    const r = slotRect(slide);
    if (!r) return null;
    const { sw, sh } = studioCoverRect(slide.photo.width, slide.photo.height, r.w, r.h,
                                       slide.frame.zoom, slide.frame.ox, slide.frame.oy);
    // Para que la foto siga al dedo 1:1 hay que encadenar tres escalas:
    // pantalla → lienzo (scale) y lienzo → píxeles de la foto (sw/r.w). Sin
    // la segunda, con zoom la foto se desplazaría al doble de velocidad que
    // el dedo.
    const scale = canvasEl.getBoundingClientRect().width / STUDIO_FORMATS[STUDIO.piece.format].w;
    return {
      ox: slide.frame.ox, oy: slide.frame.oy, zoom: slide.frame.zoom,
      // Margen sobrante desplazable, en píxeles de la foto original.
      freeX: Math.max(1, slide.photo.width  - sw),
      freeY: Math.max(1, slide.photo.height - sh),
      pxX: 1 / (scale || 1) * (sw / r.w),
      pxY: 1 / (scale || 1) * (sh / r.h),
      dist: pts.size === 2 ? spread() : 0
    };
  };

  const spread = () => {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };
  const center = () => {
    const v = [...pts.values()];
    return { x: v.reduce((s,p) => s+p.x, 0)/v.length, y: v.reduce((s,p) => s+p.y, 0)/v.length };
  };

  canvasEl.addEventListener('pointerdown', e => {
    const slide = studioActiveSlide();
    if (!slide || !slide.photo) return;
    // Con el dedo, arrastrar solo encuadra dentro del modo encuadre: fuera de
    // él el gesto le pertenece a la página. El mouse y el lápiz no compiten
    // nunca con el desplazamiento, así que siguen arrastrando siempre y en el
    // escritorio no cambia nada. El CSS ya lo impide, pero la regla vive
    // también aquí para que un cambio futuro no reabra el problema en silencio.
    if (e.pointerType === 'touch' && !STUDIO._framing) return;
    canvasEl.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = begin();
    if (start) start.from = center();
  });

  canvasEl.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const slide = studioActiveSlide();
    if (!slide || !slide.photo) return;

    if (pts.size >= 2 && start.dist) {
      slide.frame.zoom = Math.max(1, Math.min(STUDIO_ZOOM_MAX, start.zoom * (spread() / start.dist)));
      const z = document.getElementById('studio-zoom');
      if (z) z.value = String(slide.frame.zoom);
    } else {
      const now = center();
      // Arrastrar a la derecha mueve la imagen a la derecha: el recorte va al revés.
      const dx = (now.x - start.from.x) * start.pxX;
      const dy = (now.y - start.from.y) * start.pxY;
      slide.frame.ox = Math.max(-1, Math.min(1, start.ox - 2 * dx / start.freeX));
      slide.frame.oy = Math.max(-1, Math.min(1, start.oy - 2 * dy / start.freeY));
    }
    studioRequestPreview();
  });

  const end = e => {
    pts.delete(e.pointerId);
    if (!pts.size) start = null;
    else start = Object.assign(begin() || {}, { from: center() });
  };
  canvasEl.addEventListener('pointerup', end);
  canvasEl.addEventListener('pointercancel', end);
}

// El logo se encaja DENTRO de su caja conservando la proporción (contain, no
// cover): recortar el logotipo de alguien sería inaceptable.
function studioDrawLogo(ctx, slot, W, H) {
  const img = studioLogoImage();
  if (!img) return;
  const bw = slot.w * W, bh = slot.h * H;
  const k = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
  const w = img.naturalWidth * k, h = img.naturalHeight * k;
  ctx.save();
  ctx.globalAlpha = slot.opacity == null ? 1 : slot.opacity;
  ctx.drawImage(img, slot.x * W + (bw - w) / 2, slot.y * H + (bh - h) / 2, w, h);
  ctx.restore();
}

// Traduce el rol de un slot al texto que le corresponde. La marca sale de la
// versión GUARDADA: lo tecleado sin guardar no debe aparecer en una imagen.
function studioSlotText(role, slide) {
  const b = studioBrandPersisted();
  switch (role) {
    // No es texto, pero permite que otros slots se oculten con hideWith:'logo'
    case 'logo': return b.logo || '';
    case 'name':     return slide.name || '';
    case 'desc':     return slide.desc || '';
    case 'price':    return slide.priceText || '';
    // Vacío de verdad si la creadora quitó el icono: los slots que dependen de
    // él (el círculo de fondo) desaparecen con hideWith.
    case 'emoji':    return slide.emoji || '';
    case 'brand':    return b.name || '';
    case 'handle':   return b.handle ? '@' + b.handle : '';
    case 'credit':   return b.credit ? 'hecho con PrecioCrea' : '';
    case 'headline': return slide.headline || '';
    case 'subhead':  return slide.subhead || '';
    default:         return '';
  }
}

// Texto del precio según el modo elegido. Vacío → el slot no se dibuja.
// El modo por defecto publica con IVA: es el precio que paga quien compra.
function studioPriceText(product, mode) {
  if (!product) return '';
  switch (mode) {
    case 'consulta': return 'Consulta por precio';
    case 'oculto':   return '';
    default:         return fmt(product.idealP * (1 + IVA));
  }
}

// ===================================================
// STUDIO — EDITOR
// ===================================================

// Abre el studio para un producto. Si la marca no está configurada, desvía
// primero al formulario y retoma la intención al guardar.
function openStudio(format, productId) {
  if (!studioHasBrand()) {
    STUDIO._after = () => openStudio(format, productId);
    openBrand();
    toast('🎨 Primero configura tu marca');
    return;
  }

  const product = S.products.find(p => p.id === productId);
  if (!product) { toast('⚠️ No se encontró el producto'); return; }

  const b = studioBrandPersisted();
  STUDIO.piece = studioNewPiece(format, [studioProductSlide(product, b.priceMode)]);
  studioOpenEditor();
}

function studioProductSlide(product, priceMode) {
  return {
    kind: 'product',
    productId: product.id,
    name: product.name,
    desc: product.desc || '',
    emoji: product.emoji || '',      // puede estar vacío: "sin icono"
    priceText: studioPriceText(product, priceMode),
    photo: null,
    frame: { zoom: 1, ox: 0, oy: 0 }
  };
}

function studioNewPiece(format, slides) {
  const tpls = studioTemplatesFor(format);
  // Si la creadora entró tocando una miniatura de estilo, se respeta esa
  // elección; si no, la primera plantilla. El valor se consume aquí para que
  // no contamine la siguiente publicación.
  const elegido = STUDIO._pickTpl && tpls.some(t => t.id === STUDIO._pickTpl)
    ? STUDIO._pickTpl
    : tpls[0].id;
  STUDIO._pickTpl = null;
  return {
    format,
    templateId: elegido,
    priceMode: studioBrandPersisted().priceMode,
    accent: studioBrandPersisted().accent,   // punto de partida, editable aquí
    active: 0,
    slides
  };
}

// ===================================================
// STUDIO — CATÁLOGO (carrusel)
// ===================================================
// Instagram admite hasta 20 imágenes, pero 20 láminas de 1080x1350 son más de
// 100 MB de píxeles y 20 descargas seguidas en el teléfono es una experiencia
// mala. Nueve productos (diez láminas con la portada) es el punto donde la
// función sigue siendo cómoda.
const STUDIO_MAX_PRODUCTS = 9;

// Guardia común de los puntos de entrada: sin marca no hay publicación, y sin
// productos no hay nada que publicar. Devuelve false si desvió a otro sitio.
function studioReady(retry) {
  if (!studioHasBrand()) {
    STUDIO._after = retry;
    openBrand();
    toast('🎨 Primero configura tu marca');
    return false;
  }
  if (!S.products.length) {
    // Sin productos, el Estudio es un callejón sin salida: en vez de dejar a la
    // creadora frente a un aviso, se la lleva a donde puede resolverlo.
    toast('🌱 Primero calcula y guarda un producto: aquí lo publicas después');
    showView('view-home');
    return false;
  }
  return true;
}

// Historia: se elige UN producto y se entra directo al editor. `tplId` llega
// desde las miniaturas de estilo del hub: la que se tocó es la que se abre.
function openStudioPicker(tplId) {
  if (!studioReady(() => openStudioPicker(tplId))) return;
  STUDIO._pickTpl  = tplId || null;
  STUDIO._pickMode = 'historia';
  STUDIO._pick = [];
  renderStudioPick();
  showView('view-studio-pick');
}

// Catálogo: se eligen VARIOS y su orden.
function openCatalogo() {
  if (!studioReady(openCatalogo)) return;
  STUDIO._pickTpl  = null;
  STUDIO._pickMode = 'catalogo';
  STUDIO._pick = [];
  renderStudioPick();
  showView('view-studio-pick');
}

function renderStudioPick() {
  const multi = STUDIO._pickMode === 'catalogo';
  const sel = STUDIO._pick;
  const b = studioBrandPersisted();

  document.getElementById('studio-pick-title').textContent =
    multi ? 'Tu catálogo' : 'Elige un producto';

  const cards = S.products.map(p => {
    const i = sel.indexOf(p.id);
    return `
      <div class="pick-card${i >= 0 ? ' sel' : ''}" data-action="toggleStudioPick" data-id="${p.id}"
           role="button" tabindex="0" aria-pressed="${i >= 0}" aria-label="${multi ? 'Elegir' : 'Publicar'} ${esc(p.name)}">
        ${multi ? `<div class="pick-check">${i >= 0 ? (i + 1) : ''}</div>` : ''}
        <div class="pc-emoji">${p.emoji ? esc(p.emoji) : '🎨'}</div>
        <div class="pc-info">
          <div class="pc-name">${esc(p.name)}</div>
          <div class="pc-prices">
            <span class="pc-price-val">${fmt(p.idealP * (1 + IVA))}</span>
            <span class="pc-price-tag">c/IVA</span>
          </div>
        </div>
        ${multi ? '' : '<div class="pick-arrow">→</div>'}
      </div>`;
  }).join('');

  document.getElementById('studio-pick-body').innerHTML = multi
    ? `<p class="brand-intro">
         Elige los productos que quieres mostrar. El <strong>orden en que los toques</strong>
         será el orden de las láminas. 🗂️
       </p>

       <div class="pick-toolbar">
         <span class="pick-count">${sel.length} de ${STUDIO_MAX_PRODUCTS}</span>
         <button type="button" class="pick-all" data-action="selectAllStudioPick">Seleccionar varias</button>
       </div>

       <div class="pick-list">${cards}</div>

       <div class="field-label u-mt22">📣 Título de la portada</div>
       <input class="field-input" type="text" id="pick-headline" maxlength="60"
              placeholder="Mi catálogo" value="Mi catálogo">

       <div class="field-label u-mt16">💬 Bajada de la portada</div>
       <input class="field-input" type="text" id="pick-subhead" maxlength="90"
              placeholder="Hecho a mano" value="${esc(b.name)} · hecho a mano">

       <div class="studio-actions u-sin-pad-x">
         <button class="btn-violet" data-action="startCatalogo">Continuar →</button>
         <button class="btn-new-calc" data-action="showView" data-view="view-studio-hub">← Volver al Estudio</button>
       </div>`
    : `<p class="brand-intro">¿De cuál producto quieres hacer una historia? 📱</p>
       <div class="pick-list">${cards}</div>
       <div class="studio-actions u-sin-pad-x">
         <button class="btn-new-calc" data-action="showView" data-view="view-studio-hub">← Volver al Estudio</button>
       </div>`;
}

// Repintar la lista destruye los inputs de la portada: hay que conservar lo
// que la creadora ya escribió.
function studioPickRepaint(mutate) {
  const head = document.getElementById('pick-headline');
  const sub  = document.getElementById('pick-subhead');
  const vh = head ? head.value : null;
  const vs = sub  ? sub.value  : null;
  mutate();
  renderStudioPick();
  if (vh !== null) document.getElementById('pick-headline').value = vh;
  if (vs !== null) document.getElementById('pick-subhead').value  = vs;
}

function toggleStudioPick(id) {
  // En modo historia la selección es inmediata: un toque y al editor.
  if (STUDIO._pickMode !== 'catalogo') { openStudio('historia', id); return; }

  const sel = STUDIO._pick;
  const i = sel.indexOf(id);
  if (i < 0 && sel.length >= STUDIO_MAX_PRODUCTS) {
    toast(`🗂️ Máximo ${STUDIO_MAX_PRODUCTS} productos por catálogo`);
    return;
  }
  studioPickRepaint(() => { if (i >= 0) sel.splice(i, 1); else sel.push(id); });
}

function selectAllStudioPick() {
  studioPickRepaint(() => {
    STUDIO._pick = S.products.slice(0, STUDIO_MAX_PRODUCTS).map(p => p.id);
  });
  if (S.products.length > STUDIO_MAX_PRODUCTS) {
    toast(`🗂️ Se eligieron los primeros ${STUDIO_MAX_PRODUCTS}`);
  }
}

function startCatalogo() {
  const sel = STUDIO._pick;
  if (!sel.length) { toast('⚠️ Elige al menos un producto'); return; }

  const b = studioBrandPersisted();
  const cover = {
    kind: 'cover',
    eyebrow: 'Catálogo',
    headline: (document.getElementById('pick-headline').value || 'Mi catálogo').slice(0, 60),
    subhead:  (document.getElementById('pick-subhead').value  || '').slice(0, 90),
    photo: null,
    frame: { zoom: 1, ox: 0, oy: 0 }
  };

  const items = sel
    .map(id => S.products.find(p => p.id === id))
    .filter(Boolean)
    .map(p => studioProductSlide(p, b.priceMode));

  STUDIO.piece = studioNewPiece('catalogo', [cover, ...items]);
  studioOpenEditor();
}

// Tira de diapositivas del carrusel.
function renderStudioSlides() {
  const strip = document.getElementById('studio-slide-strip');
  if (!strip) return;
  const p = STUDIO.piece;

  if (!STUDIO_FORMATS[p.format].multi) { strip.innerHTML = ''; strip.hidden = true; return; }
  strip.hidden = false;

  strip.innerHTML = `
    <div class="slide-strip-lbl">Lámina ${p.active + 1} de ${p.slides.length}</div>
    <div class="slide-strip-row">
      ${p.slides.map((s, i) => `
        <button type="button" class="slide-chip${i === p.active ? ' sel' : ''}"
                data-action="setStudioSlide" data-i="${i}">
          <span class="slide-chip-n">${i + 1}</span>
          <span class="slide-chip-t">${s.kind === 'cover' ? '📣 Portada' : esc(s.name)}</span>
        </button>`).join('')}
    </div>`;
}

function setStudioSlide(i) {
  const p = STUDIO.piece;
  if (i < 0 || i >= p.slides.length) return;
  p.active = i;
  // Otra lámina, otra foto (o ninguna): dejar el bloqueo puesto sería una trampa.
  STUDIO._framing = false;
  renderStudioSlides();
  renderStudioPhotoBar();
  renderStudioFields();
  studioRequestPreview();
}

function studioOpenEditor() {
  STUDIO._saved = false;
  STUDIO._framing = false;
  renderStudioEdit();
  renderStudioSlides();
  renderStudioPhotoBar();
  renderStudioAccent();
  renderStudioTemplates();
  showView('view-studio-edit');
  // El canvas mide 0 px mientras la vista está oculta: hay que esperar al
  // frame siguiente para que el layout ya tenga ancho real.
  requestAnimationFrame(() => {
    studioPreview();
    studioAttachGestures(document.getElementById('studio-canvas'));
  });
  studioFontsReady().then(() => {
    // Las métricas de measureText cambian con la fuente real, así que el
    // autoescalado hay que recalcularlo cuando termina de cargar.
    studioRequestPreview();
    renderStudioFontNote();
  });
}

// Salir sin haber descargado nada pierde el trabajo: la foto y el encuadre no
// se guardan en ningún sitio. Vale la pena una pregunta.
async function closeStudio() {
  if (STUDIO.piece && !STUDIO._saved) {
    const ok = await confirmDialog({
      icon: '📸',
      title: '¿Salir sin guardar tu publicación?',
      message: 'Todavía no la has descargado ni compartido. Si sales ahora, se pierde la foto y el encuadre.',
      confirmText: 'Salir igual',
      cancelText: 'Seguir editando',
      dangerous: true
    });
    if (!ok) return;
  }
  studioDispose();
}

// Libera la memoria del canvas y de las fotos. En iOS un canvas grande no se
// libera con el recolector: hay que ponerlo a 0x0 explícitamente.
function studioDispose() {
  if (STUDIO._raf) { cancelAnimationFrame(STUDIO._raf); STUDIO._raf = 0; }
  clearTimeout(STUDIO._thumbs);
  clearTimeout(STUDIO._prime);
  STUDIO._share = null;
  STUDIO._saved = false;
  STUDIO._framing = false;
  if (STUDIO._exp) { STUDIO._exp.width = STUDIO._exp.height = 0; STUDIO._exp = null; }
  const c = document.getElementById('studio-canvas');
  if (c) { c.width = c.height = 0; }
  // Las fotos son lo que más memoria ocupa: soltarlas explícitamente.
  if (STUDIO.piece) {
    STUDIO.piece.slides.forEach(s => {
      if (s.photo) { s.photo.width = s.photo.height = 0; s.photo = null; }
    });
  }
  STUDIO.piece = null;
  // Vaciar el marcado del editor: si quedara vivo, sus chips e inputs seguirían
  // siendo alcanzables por los querySelectorAll globales de otras pantallas.
  const body = document.getElementById('studio-edit-body');
  if (body) body.innerHTML = '';
  showView('view-studio-hub');
}

function studioActiveSlide() {
  const p = STUDIO.piece;
  return p ? p.slides[p.active] : null;
}

function renderStudioEdit() {
  const p = STUDIO.piece;
  const f = STUDIO_FORMATS[p.format];
  const multi = f.multi;

  document.getElementById('studio-edit-body').innerHTML = `
    <div class="studio-slide-strip" id="studio-slide-strip" hidden></div>

    <div class="studio-stage">
      <canvas id="studio-canvas" width="${f.w}" height="${f.h}"
              aria-label="Vista previa de tu publicación"></canvas>
    </div>

    <div class="studio-font-note" id="studio-font-note" hidden></div>

    <div class="studio-photo-bar" id="studio-photo-bar"></div>
    <input type="file" id="studio-file" class="u-oculto" accept="image/*"
           data-change="studioPickPhoto">

    <div class="studio-controls">
      <div class="field-label">Estilo</div>
      <div class="studio-tpl-strip" id="studio-tpl-strip"></div>
    </div>

    <div class="studio-controls" id="studio-accent"></div>

    <div class="studio-controls" id="studio-fields"></div>

    <div class="studio-actions">
      ${studioActionButtons(p, multi)}
      <div class="studio-hint">La foto no se guarda: vive solo mientras editas esta publicación.</div>
      <button class="btn-new-calc" data-action="closeStudio">← Volver al Estudio</button>
    </div>`;

  renderStudioFields();
}

// La acción principal cambia según el dispositivo. En el teléfono compartir
// es lo que la creadora quiere de verdad (va directo a Instagram); en iOS es
// además la única forma de que la imagen llegue a Fotos y no a Archivos.
function studioActionButtons(p, multi) {
  const share = studioCanShareFiles();
  const n = p.slides.length;
  const prog = '<div class="studio-progress" id="studio-progress" hidden></div>';

  // La acción principal del Estudio va en violeta, no en el verde de "guardar":
  // aquí no se guarda nada, se saca la pieza hacia afuera.
  if (!multi) {
    return share
      ? `<button class="btn-violet" data-action="studioShareActive">📤 Compartir</button>
         <button class="btn-new-calc" data-action="studioDownloadActive">⬇️ Descargar imagen</button>`
      : `<button class="btn-violet" data-action="studioDownloadActive">⬇️ Descargar imagen</button>`;
  }

  // En iOS <a download> solo baja un archivo por gesto, así que la acción
  // masiva tiene que ser compartir; la lista lámina a lámina siempre está.
  if (share && isIos()) {
    return `<button class="btn-violet" data-action="studioShareAll">📤 Compartir las ${n} láminas</button>
            ${prog}
            <button class="btn-new-calc" data-action="studioShareActive">📤 Solo esta lámina</button>`;
  }
  return `<button class="btn-violet" data-action="studioDownloadAll">⬇️ Descargar las ${n} láminas</button>
          ${prog}
          <div class="studio-hint studio-hint-pegado">Tu navegador puede pedirte permiso para descargar varios archivos: toca Permitir.</div>
          <button class="btn-new-calc"
                  data-action="${share ? 'studioShareActive' : 'studioDownloadActive'}">
            ${share ? '📤 Compartir' : '⬇️ Descargar'} solo esta lámina
          </button>`;
}

// Los campos editables dependen del tipo de diapositiva: la portada de un
// catálogo tiene título y bajada; una lámina de producto, nombre y precio.
function renderStudioFields() {
  const box = document.getElementById('studio-fields');
  if (!box) return;
  const p = STUDIO.piece;
  const slide = studioActiveSlide();
  if (!slide) return;

  if (slide.kind === 'cover') {
    box.innerHTML = `
      <label class="field-label" for="studio-headline">Título de la portada</label>
      <input class="field-input" type="text" id="studio-headline" maxlength="60"
             value="${esc(slide.headline || '')}" data-input="setStudioField" data-field="headline" data-max="60">

      <label class="field-label u-mt16" for="studio-subhead">Bajada</label>
      <input class="field-input" type="text" id="studio-subhead" maxlength="90"
             value="${esc(slide.subhead || '')}" data-input="setStudioField" data-field="subhead" data-max="90">`;
    return;
  }

  const priceChips = STUDIO_PRICE_MODES.map(m => `
    <button type="button" class="m-btn studio-price-chip${p.priceMode === m ? ' active' : ''}"
            data-mode="${m}" data-action="setStudioPriceMode">
      ${esc(STUDIO_PRICE_LABELS[m])}
    </button>`).join('');

  box.innerHTML = `
    <label class="field-label" for="studio-name">Nombre en la publicación</label>
    <input class="field-input" type="text" id="studio-name" maxlength="${MAX_NAME_LEN}"
           value="${esc(slide.name || '')}" data-input="setStudioName">

    <label class="field-label u-mt16" for="studio-desc">Descripción</label>
    <textarea class="field-input field-textarea" id="studio-desc" rows="2" maxlength="${MAX_DESC_LEN}"
              placeholder="Una frase corta sobre tu producto"
              data-input="setStudioField" data-field="desc" data-max="${MAX_DESC_LEN}">${esc(slide.desc || '')}</textarea>
    <div class="field-hint">Solo cambia esta publicación; no toca el producto guardado.</div>

    <div class="field-label u-mt16">Precio${p.slides.length > 1 ? ' (en todas las láminas)' : ''}</div>
    <div class="margin-btns studio-price-chips">${priceChips}</div>`;
}

// El color de esta publicación. Arranca en el de la marca pero se puede
// cambiar aquí sin tocar el perfil: una promo de invierno puede pedir otro
// tono sin que la creadora tenga que reconfigurar su marca y devolverla luego.
function renderStudioAccent() {
  const box = document.getElementById('studio-accent');
  if (!box) return;
  const actual = studioAccent();
  const deMarca = studioBrandPersisted().accent;

  const swatches = STUDIO_ACCENTS.map(hex => `
    <button type="button" class="brand-swatch${actual === hex ? ' sel' : ''}"
            data-hex="${hex}"
            data-action="setStudioAccent" aria-label="Color ${hex}"></button>`).join('');

  box.innerHTML = `
    <div class="field-label">Color de esta publicación</div>
    <div class="brand-swatches">${swatches}</div>
    <div class="studio-accent-row">
      <label class="brand-custom-color">
        <input type="color" id="studio-color" value="${esc(actual)}" data-input="studioAccentLibre">
        <span>Otro color</span>
      </label>
      ${actual.toUpperCase() !== deMarca.toUpperCase()
        ? `<button type="button" class="studio-accent-reset" data-action="setStudioAccent" data-hex="${deMarca}">
             ↺ Volver al de mi marca
           </button>`
        : ''}
    </div>`;

  studioPintarSwatches(box);
}

// Acento efectivo: el de la pieza si se cambió, si no el de la marca guardada.
function studioAccent() {
  return (STUDIO.piece && STUDIO.piece.accent) || studioBrandPersisted().accent;
}

function setStudioAccent(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex) || !STUDIO.piece) return;
  STUDIO.piece.accent = hex.toUpperCase();
  renderStudioAccent();
  studioRequestPreview();
}

function setStudioField(key, value, max) {
  const slide = studioActiveSlide();
  if (!slide) return;
  slide[key] = String(value).slice(0, max);
  studioRequestPreview();
}

// Tira de estilos. Cada miniatura es un <canvas> que dibuja la plantilla real
// con los datos reales: lo que se ve en el chip es lo que se va a descargar.
// Son canvas y no <img>, así nunca dependemos de img-src en la CSP.
function renderStudioTemplates() {
  const strip = document.getElementById('studio-tpl-strip');
  if (!strip) return;
  const p = STUDIO.piece;
  const tpls = studioTemplatesFor(p.format);

  strip.innerHTML = tpls.map(t => `
    <button type="button" class="studio-tpl${t.id === p.templateId ? ' sel' : ''}"
            data-action="setStudioTemplate" data-tpl="${t.id}" title="${esc(t.desc)}">
      <canvas class="studio-tpl-canvas" data-tpl="${t.id}"></canvas>
      <span class="studio-tpl-name">${esc(t.name)}</span>
    </button>`).join('');

  const f = STUDIO_FORMATS[p.format];
  const pal = studioPalette(studioAccent());
  const slide = studioActiveSlide();
  const TW = 96, dpr = Math.min(2, window.devicePixelRatio || 1);

  strip.querySelectorAll('.studio-tpl-canvas').forEach(c => {
    c.width  = Math.round(TW * dpr);
    c.height = Math.round(TW * dpr * f.h / f.w);
    const ctx = c.getContext('2d');
    const k = c.width / f.w;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    // La miniatura muestra la portada en catálogo y la pieza en historia:
    // en ambos casos, lo que la creadora está mirando ahora mismo.
    const t = studioTemplate(c.dataset.tpl);
    studioRenderSlide(ctx, slide, studioSlideTemplate({ ...p, templateId: t.id }, slide), pal, f.w, f.h);
  });
}

function setStudioTemplate(id) {
  const tpl = studioTemplate(id);
  if (!tpl || tpl.format !== STUDIO.piece.format) return;
  STUDIO.piece.templateId = id;
  document.querySelectorAll('.studio-tpl').forEach(b => {
    b.classList.toggle('sel', b.querySelector('.studio-tpl-canvas').dataset.tpl === id);
  });
  studioRequestPreview();
}

function renderStudioPhotoBar() {
  const bar = document.getElementById('studio-photo-bar');
  if (!bar) return;
  const slide = studioActiveSlide();
  const tiene = !!(slide && slide.photo);

  if (!tiene) {
    bar.innerHTML = `
      <button class="studio-photo-btn primary" data-action="clickTarget" data-target="studio-file">
        📷 Agregar foto del producto
      </button>`;
    // Sin foto no hay botón que poner al día, pero SÍ hay que limpiar la clase
    // que bloquea los gestos: si se llega aquí desde una lámina que estaba en
    // modo encuadre, el bloqueo sobreviviría a la foto que lo justificaba.
    applyStudioFraming();
    return;
  }

  bar.innerHTML = `
    <div class="studio-photo-row">
      <button class="studio-photo-btn" data-action="clickTarget" data-target="studio-file">📷 Cambiar</button>
      <button class="studio-photo-btn" data-action="studioCenterPhoto">↺ Centrar</button>
    </div>
    <button type="button" class="studio-photo-btn studio-frame-btn" id="studio-frame-btn"
            data-action="toggleStudioFraming"
            aria-pressed="false" aria-describedby="studio-frame-hint">✥ Mover la foto</button>
    <div class="studio-zoom-row">
      <span class="studio-zoom-lbl">🔍</span>
      <input type="range" id="studio-zoom" min="1" max="${STUDIO_ZOOM_MAX}" step="0.01"
             value="${slide.frame.zoom}" data-input="setStudioZoom"
             aria-label="Acercar la foto">
    </div>
    <div class="studio-hint" id="studio-frame-hint" aria-live="polite"></div>`;

  // Una sola fuente de verdad para el texto y el estado del botón: la barra
  // nace neutra y applyStudioFraming la pone al día.
  applyStudioFraming();
}

function renderStudioFontNote() {
  const note = document.getElementById('studio-font-note');
  if (!note) return;
  note.hidden = STUDIO_FONTS_OK;
  if (!STUDIO_FONTS_OK) {
    note.textContent = '📶 Sin conexión: tu publicación usará una tipografía de respaldo.';
  }
}

function setStudioName(value) {
  const slide = studioActiveSlide();
  if (!slide) return;
  slide.name = String(value).slice(0, MAX_NAME_LEN);
  studioRequestPreview();
}

function setStudioPriceMode(mode) {
  if (!STUDIO_PRICE_MODES.includes(mode)) return;
  STUDIO.piece.priceMode = mode;
  STUDIO.piece.slides.forEach(s => {
    const product = S.products.find(p => p.id === s.productId);
    s.priceText = studioPriceText(product, mode);
  });
  document.querySelectorAll('.studio-price-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.mode === mode);
  });
  studioRequestPreview();
}

// ---- Preview ----

// Coalesce de repintados: al escribir en un input llegan muchos eventos
// seguidos y no tiene sentido redibujar más de una vez por frame.
function studioRequestPreview() {
  if (STUDIO._raf) return;
  STUDIO._raf = requestAnimationFrame(() => {
    STUDIO._raf = 0;
    studioPreview();
  });
  studioRequestThumbs();
  studioPrimeShare();
}

// Las miniaturas también reflejan los datos reales, pero redibujar las cuatro
// en cada pulsación de tecla es caro: basta con ponerlas al día cuando la
// creadora deja de escribir.
function studioRequestThumbs() {
  clearTimeout(STUDIO._thumbs);
  STUDIO._thumbs = setTimeout(() => renderStudioTemplates(), 400);
}

function studioPreview() {
  const c = document.getElementById('studio-canvas');
  if (!c || !STUDIO.piece) return;
  const f = STUDIO_FORMATS[STUDIO.piece.format];
  const cssW = c.getBoundingClientRect().width || 320;
  const dpr  = Math.min(2, window.devicePixelRatio || 1);

  c.width  = Math.round(cssW * dpr);
  c.height = Math.round(cssW * dpr * f.h / f.w);

  const ctx = c.getContext('2d');
  const k = c.width / f.w;
  ctx.setTransform(k, 0, 0, k, 0, 0);   // a partir de aquí, todo en espacio 1080
  const slide = studioActiveSlide();
  studioRenderSlide(ctx, slide, studioSlideTemplate(STUDIO.piece, slide),
                    studioPalette(studioAccent()), f.w, f.h);
}

// ---- Export ----

// Renderiza una diapositiva a resolución nativa en un canvas fuera de pantalla.
function studioRenderToCanvas(index) {
  const p = STUDIO.piece;
  const f = STUDIO_FORMATS[p.format];
  const c = STUDIO._exp || (STUDIO._exp = document.createElement('canvas'));
  c.width = f.w; c.height = f.h;
  const ctx = c.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, f.w, f.h);
  studioRenderSlide(ctx, p.slides[index], studioSlideTemplate(p, p.slides[index]),
                    studioPalette(studioAccent()), f.w, f.h);
  return c;
}

// JPEG y no PNG: los fondos son opacos (no hay transparencia que preservar),
// pesa ~7 veces menos e Instagram recomprime igual. toBlob y no toDataURL:
// un PNG 1080x1920 como data URL es una cadena de varios MB y en teléfonos
// de gama baja es la vía directa al cierre de la pestaña.
function studioCanvasToBlob(canvas, type = 'image/jpeg', q = 0.92) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob vacío')), type, q);
      return;
    }
    try {
      const parts = canvas.toDataURL(type, q).split(',');
      const bin = atob(parts[1]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      resolve(new Blob([arr], { type }));
    } catch(e) { reject(e); }
  });
}

function studioSlug(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'publicacion';
}

function studioDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revocar de inmediato aborta la descarga en algunos WebView de Android.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Nombre de archivo de una lámina. En un carrusel va numerado, porque el
// orden en que se suben a Instagram es el orden en que se ven.
function studioFileName(index) {
  const p = STUDIO.piece;
  const marca = studioSlug(studioBrandPersisted().name);
  const slide = p.slides[index];
  if (!STUDIO_FORMATS[p.format].multi) return `${marca}-${studioSlug(slide.name)}.jpg`;
  return `${marca}-catalogo-${String(index + 1).padStart(2, '0')}.jpg`;
}

async function studioDownloadActive() {
  if (STUDIO._busy) return;
  STUDIO._busy = true;
  try {
    await studioFontsReady();
    const idx = STUDIO.piece.active;
    const blob = await studioCanvasToBlob(studioRenderToCanvas(idx));
    studioDownload(blob, studioFileName(idx));
    STUDIO._saved = true;
    // En iOS <a download> deja el archivo en Archivos, no en Fotos: decirlo
    // tal cual evita que la creadora lo busque donde no está.
    toast(isIos() ? '⬇️ Guardada en Archivos' : '⬇️ Imagen descargada');
  } catch(e) {
    toast('❌ No se pudo generar la imagen');
  } finally {
    STUDIO._busy = false;
  }
}

const studioSleep = ms => new Promise(r => setTimeout(r, ms));

// ---- Compartir ----
// navigator.share con archivos es la vía buena en el teléfono: abre la hoja
// nativa y la creadora va derecho a Instagram. En iOS además es la ÚNICA
// forma de que la imagen llegue a Fotos: <a download> la deja en Archivos.

function studioCanShareFiles() {
  try {
    if (!navigator.canShare || !navigator.share) return false;
    return navigator.canShare({ files: [new File([new Blob(['x'])], 'x.jpg', { type: 'image/jpeg' })] });
  } catch(e) { return false; }
}

// Safari exige que navigator.share se invoque DENTRO del gesto del usuario.
// Si primero esperamos un render de medio segundo, rechaza con NotAllowedError.
// Por eso el blob de la lámina activa se prepara en segundo plano cada vez que
// la pieza deja de cambiar, y al tocar "Compartir" ya está listo.
function studioPrimeShare() {
  clearTimeout(STUDIO._prime);
  STUDIO._share = null;
  if (!studioCanShareFiles()) return;
  STUDIO._prime = setTimeout(async () => {
    try {
      const idx = STUDIO.piece && STUDIO.piece.active;
      if (idx == null) return;
      const blob = await studioCanvasToBlob(studioRenderToCanvas(idx));
      STUDIO._share = { index: idx, blob };
    } catch(e) { STUDIO._share = null; }
  }, 500);
}

function studioShareText() {
  const b = studioBrandPersisted();
  const slide = studioActiveSlide();
  const partes = [];
  if (slide && slide.kind !== 'cover' && slide.name) partes.push(slide.name);
  if (slide && slide.priceText) partes.push(slide.priceText);
  if (b.handle) partes.push('@' + b.handle);
  return partes.join(' · ');
}

async function studioShareActive() {
  if (STUDIO._busy) return;
  const idx = STUDIO.piece.active;
  const listo = STUDIO._share && STUDIO._share.index === idx ? STUDIO._share.blob : null;

  // Sin blob listo no arriesgamos el gesto: descargamos, que siempre funciona.
  if (!listo) { studioDownloadActive(); return; }

  try {
    const file = new File([listo], studioFileName(idx), { type: 'image/jpeg' });
    await navigator.share({ files: [file], text: studioShareText() });
    STUDIO._saved = true;
  } catch(e) {
    if (e && e.name === 'AbortError') return;   // la creadora cerró la hoja
    studioDownloadActive();
  }
}

// Compartir todas las láminas de una vez. En iOS es el camino recomendado:
// Safari solo baja un archivo por gesto, pero comparte varios sin problema.
async function studioShareAll() {
  if (STUDIO._busy) return;
  const p = STUDIO.piece;
  const prog = document.getElementById('studio-progress');
  STUDIO._busy = true;
  if (prog) { prog.hidden = false; prog.textContent = `Preparando ${p.slides.length} láminas…`; }

  try {
    await studioFontsReady();
    const files = [];
    for (let i = 0; i < p.slides.length; i++) {
      if (prog) prog.textContent = `Generando ${i + 1} de ${p.slides.length}…`;
      const blob = await studioCanvasToBlob(studioRenderToCanvas(i));
      files.push(new File([blob], studioFileName(i), { type: 'image/jpeg' }));
    }
    if (prog) prog.textContent = '📤 Elige dónde compartirlas';

    if (navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files, text: studioShareText() });
      STUDIO._saved = true;
      if (prog) prog.textContent = `✅ Listas las ${p.slides.length} láminas`;
    } else {
      // Algunos navegadores comparten uno pero no varios: descargamos.
      STUDIO._busy = false;
      await studioDownloadAll();
      return;
    }
  } catch(e) {
    if (e && e.name === 'AbortError') { if (prog) prog.hidden = true; }
    else { if (prog) prog.textContent = '❌ No se pudieron preparar'; }
  } finally {
    STUDIO._busy = false;
  }
}

// Descarga todas las láminas del carrusel, una a una. La pausa entre archivos
// no es cosmética: Android encola mucho mejor las descargas separadas, y
// además da tiempo a que el navegador muestre su permiso de "descargar
// varios archivos".
async function studioDownloadAll() {
  if (STUDIO._busy) return;
  const p = STUDIO.piece;
  const n = p.slides.length;
  const prog = document.getElementById('studio-progress');

  STUDIO._busy = true;
  if (prog) { prog.hidden = false; prog.textContent = `Preparando ${n} láminas…`; }

  try {
    await studioFontsReady();
    for (let i = 0; i < n; i++) {
      if (prog) prog.textContent = `Generando ${i + 1} de ${n}…`;
      const blob = await studioCanvasToBlob(studioRenderToCanvas(i));
      studioDownload(blob, studioFileName(i));
      await studioSleep(400);
    }
    STUDIO._saved = true;
    if (prog) prog.textContent = `✅ Listas las ${n} láminas`;
    toast('📥 Abre Instagram y súbelas en orden');
  } catch(e) {
    if (prog) prog.textContent = '❌ Algo falló al generar las imágenes';
    toast('❌ No se pudieron generar todas');
  } finally {
    STUDIO._busy = false;
  }
}

// ===================================================
// STUDIO — REGISTRO DE ACCIONES
// ===================================================
// Se agregan a los registros de delegación declarados en app.js (mismo ámbito
// global de scripts clásicos). Ver la sección DELEGACIÓN DE EVENTOS allá.
Object.assign(ACCIONES, {
  // Hub y selector
  openStudioPicker:    el => openStudioPicker(el.dataset.tpl || undefined),
  openCatalogo:        () => openCatalogo(),
  toggleStudioPick:    el => toggleStudioPick(Number(el.dataset.id)),
  selectAllStudioPick: () => selectAllStudioPick(),
  startCatalogo:       () => startCatalogo(),

  // Tu marca
  setBrandAccent:    el => setBrandAccent(el.dataset.hex),
  setBrandPriceMode: el => setBrandPriceMode(el.dataset.mode),
  removeBrandLogo:   () => removeBrandLogo(),
  saveBrandForm:     () => saveBrandForm(),

  // Editor
  setStudioSlide:       el => setStudioSlide(Number(el.dataset.i)),
  closeStudio:          () => closeStudio(),
  setStudioPriceMode:   el => setStudioPriceMode(el.dataset.mode),
  setStudioAccent:      el => setStudioAccent(el.dataset.hex),
  setStudioTemplate:    el => setStudioTemplate(el.dataset.tpl),
  studioCenterPhoto:    () => studioCenterPhoto(),
  toggleStudioFraming:  () => toggleStudioFraming(),
  studioShareActive:    () => studioShareActive(),
  studioDownloadActive: () => studioDownloadActive(),
  studioShareAll:       () => studioShareAll(),
  studioDownloadAll:    () => studioDownloadAll()
});

Object.assign(ENTRADAS, {
  previewBrand:      () => previewBrand(),
  // El <input type="color"> entrega el valor en .value, no en un data-attr.
  brandAccentLibre:  el => setBrandAccent(el.value),
  studioAccentLibre: el => setStudioAccent(el.value),
  setStudioField:    el => setStudioField(el.dataset.field, el.value, Number(el.dataset.max)),
  setStudioName:     el => setStudioName(el.value),
  setStudioZoom:     el => setStudioZoom(el.value)
});

Object.assign(CAMBIOS, {
  previewBrand:    () => previewBrand(),
  studioPickLogo:  el => studioPickLogo(el),
  studioPickPhoto: el => studioPickPhoto(el)
});

// ===================================================
// STUDIO — INIT
// ===================================================
(function studioInit() {
  studioLoadBrand();
})();
