// STATE
// ===================================================
const S = {
  step: 1,
  p: {
    name:'', desc:'', emoji:'', emojiManual:false,
    matTotal:0, hours:0, rate:0,
    cr:'facil', fixed:0, units:20, margin:50
  },
  products: []
};

// Texto del buscador de la pestaña Productos. Vive aquí arriba a propósito:
// renderProducts() se llama desde el init, que corre antes de que el motor
// llegue a la sección de la pestaña. Declararlo allá abajo con `let` lo dejaba
// en zona muerta temporal y el arranque reventaba en silencio.
let _search = '';

const CR_MULT = { facil:0.05, moderado:0.15, intenso:0.25, obra:0.40 };
const IVA     = 0.19;          // Impuesto al Valor Agregado (Chile)
const MARGINS = [30, 50, 80, 120]; // Opciones de margen de ganancia (%)

// Límites de seguridad para entrada del usuario
const MAX_IMPORT_SIZE = 1024 * 1024;   // 1 MB
const MAX_NAME_LEN    = 100;
const MAX_DESC_LEN    = 160;
const MAX_DATE_LEN    = 30;
const MAX_INPUT_NUM   = 99_999_999;    // 100 millones — tope razonable
const VALID_CR_LVLS   = Object.keys(CR_MULT);
const WISDOMS = [
  p => `El precio mínimo de <strong>${fmt(p.minP)}</strong> es tu suelo: <strong>nunca vendas bajo ese valor</strong>, ni en liquidaciones ni a familiares. El precio ideal (<strong>${fmt(p.idealP)}</strong>) es lo que te permite reinvertir y crecer de verdad.`,
  () => `Recuerda: el cliente que valora tu arte pagará el precio justo. <strong>Quienes solo buscan "lo más barato" no son tus clientes ideales.</strong> Cobrar bien atrae a quienes atesorarán tu trabajo.`,
  () => `<strong>¡Tu sueldo es un costo, no un regalo!</strong> Si no te pagaste a ti misma, el negocio no es rentable aunque la cuenta bancaria tenga plata. Págate primero.`,
  () => `Fijar tu precio mirando solo a la competencia es una <strong>trampa</strong>. Tu vecina puede tener costos distintos, o estar perdiendo dinero sin saberlo. Confía en tus propios números. 🔢`
];

// Claves de preferencias en localStorage
const KEY_PRODUCTS  = 'pc_v1';
const KEY_BACKUP    = 'pc_last_backup';
// La bienvenida de la 2.0 estrena clave propia. La vieja (pc_onboarding_done)
// se queda huérfana a propósito: quien ya usaba la 1.6 merece ver una vez la
// pantalla de aniversario y el resumen de lo que cambió.
const KEY_WELCOME   = 'pc_welcome_20';
const KEY_RATE      = 'pc_rate_v1';    // asistente de valor hora
const KEY_FIXED     = 'pc_fixed_v1';   // asistente de costos fijos

// ===================================================
// VALOR HORA — referencias
// ===================================================
// Montos de referencia para un hogar de Santiago, revisados en julio de 2026.
// NO son un dato de la creadora: son un punto de partida para que la pantalla
// no empiece en blanco, y todos se editan. Si cambian, se cambian aquí.
const RATE_REF_FECHA = 'julio de 2026';

const RATE_GASTOS = [
  { id: 'arriendo',  lbl: 'Arriendo o dividendo',            ref: 450000 },
  { id: 'cuentas',   lbl: 'Cuentas (luz, agua, gas, internet)', ref: 120000 },
  { id: 'comida',    lbl: 'Supermercado y comida',           ref: 350000 },
  { id: 'transporte',lbl: 'Transporte',                      ref: 70000  },
  { id: 'salud',     lbl: 'Salud y previsión',               ref: 80000  },
  { id: 'otros',     lbl: 'Otros (educación, deudas, imprevistos)', ref: 100000 }
];

// Piso legal por hora. Ingreso mínimo mensual $500.000 y jornada de 42 horas
// semanales (Ley 21.561, vigente desde abril de 2026): 42 × 4,33 ≈ 182 h al mes.
const RATE_MIN_MENSUAL = 500000;
const RATE_MIN_JORNADA = 42;
const SEMANAS_MES      = 52 / 12;   // 4,333
const RATE_MIN_HORA    = Math.round(RATE_MIN_MENSUAL / (RATE_MIN_JORNADA * SEMANAS_MES));

// ===================================================
// COSTOS FIJOS — referencias
// ===================================================
// El gasto de la casa que se prorratea al negocio. Se siembra con lo que la
// creadora ya contestó en el asistente de valor hora, si lo usó: ahí dijo
// cuánto paga de arriendo, no tiene por qué repetirlo.
const FIXED_HOGAR = [
  { id: 'arriendo', lbl: 'Arriendo o dividendo',        ref: 450000, desdeRate: 'arriendo' },
  { id: 'cuentas',  lbl: 'Luz, agua, gas e internet',   ref: 120000, desdeRate: 'cuentas'  }
];

// Gastos que existen solo porque existe el emprendimiento.
const FIXED_NEGOCIO = [
  { id: 'taller',        lbl: 'Arriendo de taller aparte',        ref: 0     },
  { id: 'publicidad',    lbl: 'Publicidad en redes',              ref: 15000 },
  { id: 'web',           lbl: 'Página web o dominio',             ref: 2500  },
  { id: 'plataformas',   lbl: 'Plataformas de venta y comisiones', ref: 5000 },
  { id: 'suscripciones', lbl: 'Suscripciones (diseño, apps)',     ref: 5000  },
  { id: 'otros',         lbl: 'Otros (transporte, envíos, patente)', ref: 5000 }
];

const FIXED_DEFAULTS = {
  share: 15,          // % de la casa que ocupa el negocio
  hogar: FIXED_HOGAR.reduce((o, g) => (o[g.id] = g.ref, o), {}),
  negocio: FIXED_NEGOCIO.reduce((o, g) => (o[g.id] = g.ref, o), {}),
  toolsValue: 250000, // valor de todas las herramientas juntas
  toolsYears: 3,      // años que se espera que duren
  units: 30           // unidades producidas al mes
};

// Respuestas por defecto del asistente.
const RATE_DEFAULTS = {
  mode: 'gastos',     // 'gastos' | 'directo'
  gastos: RATE_GASTOS.reduce((o, g) => (o[g.id] = g.ref, o), {}),
  metaDirecta: 0,
  share: 50,          // % del gasto del hogar que debe cubrir el emprendimiento
  days: 5,
  hoursDay: 6,
  focus: 65,          // % de las horas que son producción cobrable
  taxOn: true,
  tax: 20
};

// Las cuatro pestañas de la barra inferior. El resto de las vistas son
// "sheets": ocupan la pantalla completa y esconden el encabezado y la barra.
const TAB_VIEWS = ['view-home', 'view-products', 'view-studio-hub', 'view-brand'];

// SVG inline de marcas (uso referencial, ver disclaimer en el footer)
const ICONS = {
  whatsapp: '<svg viewBox="0 0 24 24" class="brand-svg brand-wa" fill="currentColor" aria-hidden="true"><path d="M19.05 4.91A9.816 9.816 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01zm-7.01 15.24c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.264 8.264 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.183 8.183 0 0 1 2.41 5.83c.02 4.54-3.68 8.23-8.22 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.07-.11-.22-.16-.47-.28z"/></svg>',
  android:  '<svg viewBox="0 0 24 24" class="brand-svg brand-android" fill="currentColor" aria-hidden="true"><path d="M17.523 15.341c-.551 0-.999-.448-.999-1s.448-.999.999-.999c.551 0 .999.448.999.999 0 .552-.448 1-.999 1m-11.046 0c-.551 0-.999-.448-.999-1s.448-.999.999-.999c.551 0 .999.448.999.999 0 .552-.448 1-.999 1m11.405-6.02l1.997-3.459a.416.416 0 00-.152-.568.416.416 0 00-.568.152l-2.022 3.503C15.59 8.244 13.853 7.851 12 7.851s-3.59.393-5.137 1.099L4.841 5.447a.416.416 0 00-.568-.152.416.416 0 00-.152.568l1.997 3.459C2.689 11.187.343 14.659 0 18.761h24c-.343-4.102-2.689-7.574-6.118-9.44"/></svg>',
  apple:    '<svg viewBox="0 0 24 24" class="brand-svg brand-apple" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25"/></svg>'
};

// ===================================================
// DELEGACIÓN DE EVENTOS (CSP sin 'unsafe-inline')
// ===================================================
// Ningún control usa manejadores en línea: llevan data-action (click),
// data-input (input) o data-change (change) y estos tres listeners los
// despachan contra los registros. Así la CSP puede declarar script-src 'self'
// a secas. studio.js agrega sus entradas a los mismos objetos al cargarse
// (los const de nivel superior de un script clásico son visibles para los
// scripts que cargan después).
//
// Cada evento despacha UNA sola acción: la del [data-*] más cercano al
// target. Por eso el 📸 dentro de una tarjeta de producto ya no necesita
// stopPropagation — la acción de la tarjeta ni se consulta.
const ACCIONES = {};   // data-action  → (el, ev) => …
const ENTRADAS = {};   // data-input   → (el, ev) => …
const CAMBIOS  = {};   // data-change  → (el, ev) => …

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const fn = ACCIONES[el.dataset.action];
  if (fn) fn(el, ev);
});
document.addEventListener('input', ev => {
  const el = ev.target.closest('[data-input]');
  if (!el) return;
  const fn = ENTRADAS[el.dataset.input];
  if (fn) fn(el, ev);
});
document.addEventListener('change', ev => {
  const el = ev.target.closest('[data-change]');
  if (!el) return;
  const fn = CAMBIOS[el.dataset.change];
  if (fn) fn(el, ev);
});

// ===================================================
// INIT
// ===================================================
// El arranque vive al FINAL del archivo. Corría aquí y en iPhone reventaba:
// setupInstallPrompt() → renderInstallButton() leía `deferredInstallPrompt`,
// declarada con `let` más abajo — zona muerta temporal, ReferenceError, y todo
// lo que venía después del error quedaba sin evaluar (mismo problema ya
// documentado con `_search`). Al final del archivo ninguna declaración puede
// quedar pendiente.

// Lo que sale de localStorage se trata con la misma desconfianza que un archivo
// importado: puede venir de una versión antigua, de una escritura a medias
// cuando se agotó la cuota, o estar corrupto sin más. Si entrara en crudo, un
// dato con forma inesperada reventaría renderHome() y dejaría la app en blanco
// — y desde el teléfono no hay forma de limpiar el almacenamiento para volver.
function loadProducts() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY_PRODUCTS) || 'null');
  } catch(e) {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const out  = [];
  const usados = new Set();
  for (const item of raw) {
    const p = sanitizeImportedProduct(item);
    if (!p) continue;
    // Un respaldo viejo puede traer ids repetidos: se reparan al entrar.
    if (usados.has(p.id)) p.id = nextProductId(usados);
    usados.add(p.id);
    out.push(p);
  }
  return out;
}

// Los ids nacen de Date.now(), pero eso solo no basta: duplicar un producto y
// guardar otro poco después podían caer en el mismo número, y con ids repetidos
// find() y filter() editan o borran el producto equivocado. Aquí se garantiza
// que el id nuevo no choque con ninguno vivo.
function nextProductId(usados) {
  const tomados = usados || new Set(S.products.map(p => Number(p.id)));
  let id = Date.now();
  while (tomados.has(id)) id++;
  return id;
}

// ===================================================
// INSTALACIÓN COMO APP (PWA)
// ===================================================
// En Android/desktop Chrome capturamos el evento beforeinstallprompt para
// poder disparar el diálogo nativo desde nuestro propio botón. En iOS,
// donde Apple no expone esta API, mostramos una guía visual con los pasos
// de Safari (Compartir → Agregar a inicio).
let deferredInstallPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent || '');
}

// El archivo portable no puede instalarse: el build le quita el service worker
// y el manifest a propósito. Decirlo es mejor que dar unos pasos que no van a
// funcionar y dejar a la creadora pensando que hizo algo mal.
function esPortable() {
  return !document.querySelector('link[rel="manifest"]');
}

function setupInstallPrompt() {
  // Si la app ya está instalada (modo standalone), no hace falta ofrecerlo.
  if (isStandalone()) return;

  // Si es iOS, mostrar el aviso del inicio: ahí la instalación es manual y el
  // navegador nunca avisa de nada.
  if (isIos()) renderInstallButton();

  // Android / escritorio Chrome: esperar el evento del navegador.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    renderInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById('btn-install');
    if (btn) btn.classList.remove('show');
    renderInstallRow();
    toast('🎉 ¡App instalada!');
  });

  renderInstallRow();
}

function renderInstallButton() {
  const btn = document.getElementById('btn-install');
  if (!btn || isStandalone()) return;
  if (deferredInstallPrompt || isIos()) btn.classList.add('show');
}

// Fila de "Tu marca". El aviso del inicio depende de que el navegador avise, y
// eso no siempre pasa: en escritorio tarda, en Firefox no llega nunca y en
// Android desaparece si ya se rechazó una vez. Esta fila está siempre.
function renderInstallRow() {
  const row = document.getElementById('install-row');
  if (!row) return;
  row.hidden = isStandalone();
}

function handleInstallClick() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(({ outcome }) => {
      if (outcome === 'accepted') {
        deferredInstallPrompt = null;
        const btn = document.getElementById('btn-install');
        if (btn) btn.classList.remove('show');
      }
    }).catch(() => {/* la creadora cerró el diálogo */});
    return;
  }
  // Sin diálogo nativo disponible, se explica cómo hacerlo a mano. Antes esto
  // solo existía para iOS y en el resto de los casos el botón no hacía nada.
  showInstallGuide();
}

const PASOS_IOS = [
  'Toca el botón <strong>Compartir</strong> <span class="ios-share-icon">⬆️</span> abajo de Safari.',
  'Desliza y toca <strong>"Agregar a inicio"</strong> ➕',
  'Toca <strong>"Agregar"</strong> arriba a la derecha.'
];

const PASOS_ANDROID = [
  'Abre el menú del navegador: los <strong>tres puntos ⋮</strong> de arriba a la derecha.',
  'Toca <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla de inicio"</strong>.',
  'Confirma y listo: queda con las demás apps.'
];

function showInstallGuide() {
  const overlay = document.getElementById('install-overlay');
  const icono   = document.getElementById('install-icon');
  const titulo  = document.getElementById('install-title');
  const pasos   = document.getElementById('install-steps');
  const tip     = document.getElementById('install-tip');
  if (!overlay) return;

  if (esPortable()) {
    icono.textContent = '📄';
    titulo.textContent = 'Esta copia no se instala';
    pasos.innerHTML = '';
    tip.innerHTML = 'Estás usando el <strong>archivo único</strong>, pensado para abrirse con doble clic sin internet. Funciona completo, pero no se puede instalar como app. Para eso pide el enlace de PrecioCrea y ábrelo en el navegador de tu teléfono.';
  } else {
    const ios = isIos();
    const lista = ios ? PASOS_IOS : PASOS_ANDROID;

    icono.textContent = ios ? '🍎' : '📲';
    titulo.textContent = ios ? 'Instalar en tu iPhone' : 'Instalar en tu teléfono';
    pasos.innerHTML = lista.map((p, i) => `
      <div class="ios-step">
        <span class="ios-step-n">${i + 1}</span>
        <div>${p}</div>
      </div>`).join('');
    tip.innerHTML = ios
      ? '💡 Si usas Chrome en iPhone, primero abre el link en <strong>Safari</strong> — Apple solo permite instalar desde ahí.'
      : '💡 Si no ves la opción, es porque abriste el link <strong>dentro de otra app</strong> (Instagram, WhatsApp, Facebook). Toca los tres puntos y elige "Abrir en Chrome".';
  }

  // Mismo contrato que los demás diálogos: Escape y el toque en el fondo
  // cierran, y el foco entra al botón. Antes el único cierre era "Entendido".
  const onKey = (ev) => { if (ev.key === 'Escape') hideInstallGuide(); };
  const onBg  = (ev) => { if (ev.target === overlay) hideInstallGuide(); };
  overlay.addEventListener('click', onBg);
  document.addEventListener('keydown', onKey);
  overlay._cerrarGuia = () => {
    overlay.removeEventListener('click', onBg);
    document.removeEventListener('keydown', onKey);
  };
  _modalAbierto = hideInstallGuide;
  armarGuardia();

  overlay.classList.add('show');
  const btn = overlay.querySelector('.modal-btn');
  if (btn) setTimeout(() => btn.focus(), 50);
}

function hideInstallGuide() {
  const overlay = document.getElementById('install-overlay');
  if (!overlay) return;
  overlay.classList.remove('show');
  if (overlay._cerrarGuia) { overlay._cerrarGuia(); overlay._cerrarGuia = null; }
  _modalAbierto = null;
}

// ===================================================
// VIEWS
// ===================================================
// Alterna la vista activa. Distingue dos tipos:
//   pestaña → conserva encabezado y barra inferior, y marca su botón
//   sheet   → pantalla completa; el <body> lleva .sheet-open y el CSS esconde
//             el encabezado, la píldora de aniversario y la barra
// Cada pestaña se repinta al entrar porque los datos pueden haber cambiado
// mientras la creadora estaba en otra (guardar un producto, editar la marca).
function showView(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const anterior = document.querySelector('.view.active');
  const previa = anterior ? anterior.id : '';

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  el.classList.add('active');

  const isTab = TAB_VIEWS.includes(id);
  document.body.classList.toggle('sheet-open', !isTab);
  document.querySelectorAll('.tab-btn').forEach(b => {
    const activo = b.dataset.view === id;
    b.classList.toggle('active', activo);
    if (activo) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });

  // Al salir de "Tu marca" se vuelca el formulario al estado. Sin esto,
  // cambiar de pestaña y volver repintaba los campos desde el estado viejo y
  // se perdía lo que la creadora llevaba escrito. Es un BORRADOR: lo que
  // publica y exporta la app sale de studioBrandPersisted(), no de aquí.
  if (previa === 'view-brand' && id !== 'view-brand' && typeof captureBrandForm === 'function') {
    captureBrandForm();
    // La intención pendiente ("guarda tu marca y seguimos publicando") solo
    // sobrevive mientras se está en el formulario: si la creadora se va sin
    // guardar, retomarla días después sería un salto inexplicable al Estudio.
    if (typeof STUDIO !== 'undefined' && STUDIO._after) STUDIO._after = null;
  }

  if (id === 'view-home')     renderHome();
  if (id === 'view-products') renderProducts();
  // Las dos vistas del Estudio las pinta studio.js, que se carga después.
  if (id === 'view-studio-hub' && typeof renderStudioHub === 'function') renderStudioHub();
  // renderBrandForm y no openBrand: openBrand llama a showView y entraría en bucle.
  if (id === 'view-brand' && typeof renderBrandForm === 'function') {
    renderBrandForm(); renderRateRow(); renderFixedRow(); renderInstallRow();
  }

  // Cualquier navegación re-arma la entrada guardián del botón Atrás: si la
  // creadora "gastó" el guardián en Inicio y luego abre una pantalla, Atrás
  // debe cerrarla, no sacarla de la app.
  armarGuardia();

  // 'instant', no 'auto': según la especificación, `auto` significa "usa el
  // scroll-behavior calculado", que aquí es el `smooth` de la hoja de estilos.
  // Cambiar de vista lanzaba entonces una animación de vuelta arriba con el
  // contenido ya sustituido, y esa animación seguía corriendo después, pisando
  // cualquier desplazamiento posterior.
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Respaldo y guía se abren desde varios sitios (encabezado, "Tu marca", los
// pilares del inicio): el ← debe volver a donde se estaba, no siempre al
// inicio. Mismo patrón que S.rateFrom / S.fixedFrom en los asistentes.
function vistaActiva() {
  const v = document.querySelector('.view.active');
  return v ? v.id : 'view-home';
}

function openBackup() {
  const previa = vistaActiva();
  if (previa !== 'view-backup') S.backupFrom = previa;
  showView('view-backup');
}

function closeBackup() {
  showView(S.backupFrom || 'view-home');
}

function closeHelp() {
  showView(S.helpFrom || 'view-home');
}

// Abre la guía en una sección concreta. Sin argumento deja abierta la primera,
// que es el estado natural al entrar por el botón "?".
function openHelp(sectionId) {
  const previa = vistaActiva();
  if (previa !== 'view-help') S.helpFrom = previa;
  showView('view-help');
  const secciones = document.querySelectorAll('.help-section');
  secciones.forEach(s => s.classList.remove('open'));

  const destino = sectionId ? document.getElementById(sectionId) : secciones[0];
  if (!destino) return;
  destino.classList.add('open');
  secciones.forEach(s => {
    const hd = s.querySelector('.help-section-hd');
    if (hd) hd.setAttribute('aria-expanded', String(s.classList.contains('open')));
  });
  if (!sectionId) return;

  // Nada de esperar a un fotograma: abrir la sección es solo añadir una clase,
  // y leer getBoundingClientRect() ya fuerza el recálculo del diseño, así que
  // la posición de aquí es la definitiva. Con requestAnimationFrame, una
  // pestaña en segundo plano o con el pintado limitado no ejecutaba el salto
  // y la guía se quedaba arriba, como si el enlace no hubiera hecho nada.
  //
  // `behavior:'instant'` también es deliberado: anula el
  // `scroll-behavior: smooth` de la hoja de estilos. Ojo, 'auto' NO sirve —
  // según la especificación significa "usa el scroll-behavior calculado", o
  // sea el suave. La creadora acaba de tocar una tarjeta y espera ver la
  // respuesta, no un planeo de 600 px.
  const y = destino.getBoundingClientRect().top + window.scrollY - 14;
  window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
}

// ===================================================
// VOLVER AL INICIO (logotipo)
// ===================================================
// El logotipo es el "botón de casa" y está en todas las pantallas. Como la
// calculadora, el resultado, el detalle, la marca y el Estudio no persisten
// nada hasta que se pulsa Guardar, salir de ahí de un toque perdería trabajo:
// por eso pregunta antes.
async function goHome() {
  const activa = document.querySelector('.view.active');
  const id = activa ? activa.id : '';

  if (id === 'view-studio-edit') {
    if (STUDIO.piece && !STUDIO._saved) {
      const ok = await confirmDialog({
        icon: '📸',
        title: '¿Salir sin guardar tu publicación?',
        message: 'Todavía no la has descargado ni compartido. Si sales ahora, se pierde la foto y el encuadre.',
        confirmText: 'Ir al inicio',
        cancelText: 'Seguir editando',
        dangerous: true
      });
      if (!ok) return;
    }
    studioDispose();   // libera el canvas y las fotos antes de irse
    showView('view-home');
    return;
  }

  const aviso = trabajoPendiente(id);
  if (aviso) {
    const ok = await confirmDialog({
      icon: '📝',
      title: aviso.title,
      message: aviso.message,
      confirmText: 'Ir al inicio',
      cancelText: 'Seguir aquí',
      dangerous: true
    });
    if (!ok) return;
  }
  showView('view-home');
}

// Devuelve {title, message} si hay trabajo sin guardar en esta vista, o null.
function trabajoPendiente(id) {
  if (id === 'view-calc') {
    // "inp-units" no cuenta: viene con 20 por defecto y nadie lo escribió.
    // Tampoco cuentan inp-rate/inp-fixed cuando traen exactamente el valor que
    // los perfiles guardados rellenan solos: avisar "lo escrito se pierde"
    // sobre un formulario que la creadora no tocó enseña a ignorar el aviso.
    const val = k => ((document.getElementById(k) || {}).value || '').trim();
    const prefRate  = (S.rate  && S.rate.remember)  ? String(S.rate.rate)   : '';
    const prefFixed = (S.fixed && S.fixed.remember) ? String(S.fixed.fixed) : '';
    const escritos = ['inp-name', 'inp-desc', 'inp-hours'].some(k => val(k))
      || (val('inp-rate')  !== '' && val('inp-rate')  !== prefRate)
      || (val('inp-fixed') !== '' && val('inp-fixed') !== prefFixed);
    const materiales = Array.from(document.querySelectorAll('.mat-name, .mat-cost'))
      .some(i => (i.value || '').trim());
    if (!escritos && !materiales) return null;
    return {
      title: '¿Salir del cálculo?',
      message: 'Lo que llevas escrito se pierde: este producto todavía no está guardado.'
    };
  }

  if (id === 'view-results') {
    // Si ya se guardó (botón Guardar o "Publícalo hoy mismo"), no hay nada que
    // perder y preguntar sería mentir.
    if (S.p._saved) return null;
    return {
      title: '¿Salir sin guardar el producto?',
      message: `"${S.p.name}" está calculado pero no guardado. Si sales ahora tendrás que calcularlo de nuevo.`
    };
  }

  if (id === 'view-detail' && detTieneCambios()) {
    return {
      title: '¿Salir sin guardar los cambios?',
      message: 'Editaste este producto y no pulsaste "Guardar cambios".'
    };
  }

  if (id === 'view-brand' && typeof studioBrandDirty === 'function' && studioBrandDirty()) {
    return {
      title: '¿Salir sin guardar tu marca?',
      message: 'Cambiaste algo y no pulsaste "Guardar mi marca". Tus publicaciones seguirán usando los datos anteriores.'
    };
  }

  return null;
}

// ¿El detalle abierto difiere del producto guardado? Se compara contra el
// producto real, no contra el borrador inicial: tocar y deshacer no cuenta.
function detTieneCambios() {
  const p = S.products.find(x => x.id === S._detId);
  if (!p || !S._detDraft) return false;

  const num = id => parseMonto(((document.getElementById(id) || {}).value));
  const descEl = document.getElementById('det-desc');

  return S._detDraft.crLvl !== p.crLvl
      || S._detDraft.margin !== p.margin
      || (S._detEmoji || '') !== (p.emoji || '')
      || num('det-mat')    !== p.mat
      || num('det-labor')  !== p.labor
      || num('det-struct') !== p.struct
      || (!!descEl && descEl.value.trim() !== (p.desc || ''));
}

// ===================================================
// PESTAÑA CALCULAR
// ===================================================
// Solo los bloques que dependen de los productos guardados: las estadísticas
// y el recordatorio de respaldo. La lista vive en su propia pestaña.
function renderHome() {
  const statsRow = document.getElementById('stats-row');
  if (!statsRow) return;

  if (S.products.length === 0) {
    statsRow.style.display = 'none';
    renderBackupReminder();
    return;
  }

  statsRow.style.display = 'grid';
  document.getElementById('stat-count').textContent = S.products.length;
  const avg = S.products.reduce((s,p) => s + p.idealP, 0) / S.products.length;
  document.getElementById('stat-avg').textContent = fmtShort(avg);

  renderBackupReminder();
}

// ===================================================
// PESTAÑA PRODUCTOS
// ===================================================
// Compara sin acentos ni mayúsculas: quien busca "jabon" espera encontrar
// "Jabón de lavanda".
function normalizar(str) {
  return String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function renderProducts() {
  const list  = document.getElementById('products-list');
  const box   = document.getElementById('search-box');
  const count = document.getElementById('products-count');
  if (!list) return;

  const total = S.products.length;

  if (count) {
    count.textContent = total === 0
      ? 'Aún no guardas ninguno'
      : `${total} guardado${total === 1 ? '' : 's'} en este teléfono`;
  }
  // El buscador solo aparece cuando hay lista que valga la pena filtrar. Al
  // bajar del umbral se limpia también el campo: si no, el texto viejo
  // reaparecería al guardar el cuarto producto y ocultaría media lista.
  if (box) box.style.display = total >= 4 ? 'flex' : 'none';
  if (total < 4) {
    _search = '';
    const inp = document.getElementById('inp-search');
    if (inp) inp.value = '';
  }

  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) clearBtn.hidden = !_search;

  if (total === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌱</div>
        <p>Aún no tienes productos guardados.<br>¡Calcula el precio de tu primera creación!</p>
      </div>`;
    return;
  }

  const q = normalizar(_search.trim());
  const visibles = q
    ? S.products.filter(p => normalizar(p.name).includes(q) || normalizar(p.desc).includes(q))
    : S.products;

  if (visibles.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>Ningún producto coincide con «${esc(_search.trim())}».</p>
      </div>`;
    return;
  }

  list.innerHTML = visibles.map(p => `
    <div class="product-card" data-action="showDetail" data-id="${p.id}" role="button" tabindex="0" aria-label="Abrir ${esc(p.name)}">
      <div class="pc-emoji">${p.emoji ? esc(p.emoji) : '🎨'}</div>
      <div class="pc-info">
        <div class="pc-name">${esc(p.name)}</div>
        ${p.desc ? `<div class="pc-desc">${esc(p.desc)}</div>` : ''}
        <div class="pc-prices">
          <span class="pc-price-val">${fmt(p.idealP * (1 + IVA))}</span>
          <span class="pc-price-tag">c/IVA</span>
        </div>
      </div>
      <div class="pc-actions">
        <button class="pc-studio" data-action="openStudio" data-id="${p.id}" title="Publicar" aria-label="Publicar ${esc(p.name)}">📸</button>
        <button class="pc-delete" data-action="delProduct" data-id="${p.id}" title="Eliminar" aria-label="Eliminar ${esc(p.name)}">🗑️</button>
      </div>
    </div>`).join('');
}

function filterProducts(value) {
  _search = value || '';
  renderProducts();
}

function clearSearch() {
  _search = '';
  const inp = document.getElementById('inp-search');
  if (inp) inp.value = '';
  renderProducts();
}

// ===================================================
// BIENVENIDA DE ANIVERSARIO
// ===================================================
// Respaldo en memoria para cuando localStorage está bloqueado (Safari privado,
// cookies deshabilitadas): sin él, la bienvenida reaparecía en cada arranque
// sin forma de silenciarla. Al menos dentro de la sesión se queda cerrada.
let _welcomeVista = false;

function initWelcome() {
  let visto = _welcomeVista;
  try { visto = visto || localStorage.getItem(KEY_WELCOME) === '1'; } catch(e) {}
  if (!visto) showWelcome();
}

function showWelcome() {
  const el = document.getElementById('welcome');
  if (!el) return;
  el.hidden = false;
  armarGuardia();   // Atrás debe cerrar la bienvenida, no salir de la app
  // Sin esto, el fondo sigue desplazándose bajo la bienvenida en iOS.
  document.body.style.overflow = 'hidden';
  el.scrollTop = 0;
  // Es un role="dialog": el foco tiene que entrar en él, o un lector de
  // pantalla se queda leyendo la app tapada de fondo.
  const btn = document.getElementById('welcome-cta') || el.querySelector('button');
  if (btn) setTimeout(() => btn.focus(), 50);
}

function dismissWelcome() {
  const el = document.getElementById('welcome');
  if (el) el.hidden = true;
  document.body.style.overflow = '';
  _welcomeVista = true;
  try { localStorage.setItem(KEY_WELCOME, '1'); } catch(e) {}
}

// "Probar con un ejemplo" desde la bienvenida
function welcomeExample() {
  dismissWelcome();
  startCalcWithExample();
}

// Empieza la calculadora con un ejemplo pre-rellenado (jabón de lavanda).
function startCalcWithExample() {
  dismissWelcome();
  startCalc();
  const name = 'Jabón de lavanda 100g';
  document.getElementById('inp-name').value = name;
  S.p.name = name;
  document.getElementById('inp-desc').value = 'Hecho a mano con lavanda de Colchagua';
  onNameInput();
  const matName = document.querySelector('.mat-name');
  const matCost = document.querySelector('.mat-cost');
  if (matName) matName.value = 'Aceite de coco';
  if (matCost) { matCost.value = '2170'; calcMatTotal(); }
}

// ===================================================
// DUPLICAR / COMPARTIR
// ===================================================
function duplicateProduct(id) {
  if (_guardando) return;
  const p = S.products.find(x => x.id === id);
  if (!p) return;
  const copy = {
    ...p,
    id: nextProductId(),
    addedAt: Date.now(),
    name: `${p.name} (copia)`.slice(0, MAX_NAME_LEN),
    date: new Date().toLocaleDateString('es-CL')
  };
  S.products.unshift(copy);
  if (!persistProducts()) {
    S.products = S.products.filter(x => x.id !== copy.id);
    return;
  }
  toast('📋 Producto duplicado');
  _guardando = true;
  setTimeout(() => { _guardando = false; renderHome(); showView('view-products'); }, 700);
}

function shareWhatsApp(id) {
  const p = S.products.find(x => x.id === id);
  if (!p) return;
  // El emoji puede estar vacío si la creadora quitó el icono: nada de espacios
  // sueltos ni líneas en blanco de más.
  const lines = [
    `Hola! Te paso la cotización de *${p.name}*${p.emoji ? ' ' + p.emoji : ''}`,
    ...(p.desc ? [``, p.desc] : []),
    ``,
    `💰 Precio: ${fmt(p.idealP)}`,
    `🧾 Con IVA: ${fmt(p.idealP * (1 + IVA))}`,
    ``,
    `¡Gracias por confiar en mi trabajo! 💛`
  ];
  const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ===================================================
// CALCULATOR
// ===================================================
function startCalc() {
  resetState();
  S.step = 1;
  showView('view-calc');
  document.querySelectorAll('.calc-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-1').classList.add('active');
  updateProg(1);
}

function resetState() {
  S.p = { name:'', desc:'', emoji:'', emojiManual:false,
          matTotal:0, hours:0, rate:0, cr:'facil', fixed:0, units:20, margin:50 };

  // Reset fields
  const q = id => document.getElementById(id);
  q('inp-name').value = '';
  q('inp-desc').value = '';
  paintIconBtn('inp-emoji', '');
  q('inp-hours').value = '';
  // El valor hora guardado se rellena solo si la creadora lo pidió. La fila de
  // aviso del paso 2 explica de dónde salió el número.
  if (S.rate && S.rate.remember) {
    q('inp-rate').value = S.rate.rate;
    S.p.rate = S.rate.rate;
  } else {
    q('inp-rate').value = '';
  }
  renderRateSaved();
  // Los costos fijos siguen la misma regla que el valor hora: solo se rellenan
  // si la creadora lo pidió, y la fila del paso 4 lo anuncia.
  if (S.fixed && S.fixed.remember) {
    q('inp-fixed').value = S.fixed.fixed;
    q('inp-units').value = S.fixed.units;
  } else {
    q('inp-fixed').value = '';
    q('inp-units').value = '20';
  }
  renderFixedSaved();
  q('labor-preview').style.display = 'none';
  q('mat-total').textContent = '$0';
  q('mat-list').innerHTML = `
    <div class="mat-row">
      <input class="field-input mat-name" type="text" placeholder="ej: Aceite de coco" maxlength="60" autocomplete="off" style="--step-accent:var(--coral-deep)">
      <input class="field-input mat-cost" type="text" inputmode="numeric" placeholder="$" maxlength="10" autocomplete="off" data-input="calcMatTotal" style="--step-accent:var(--coral-deep)" aria-label="Costo del material">
      <button class="btn-rem" data-action="remMat" aria-label="Quitar material">✕</button>
    </div>`;

  // Reset creativity
  document.querySelectorAll('.cr-option').forEach(o => {
    o.classList.remove('sel');
    o.setAttribute('aria-pressed', 'false');
  });
  const crFacil = document.querySelector('.cr-option[data-val="facil"]');
  if (crFacil) { crFacil.classList.add('sel'); crFacil.setAttribute('aria-pressed', 'true'); }

  // Reset margin buttons — SOLO los de la pantalla de resultados: la clase
  // .m-btn también la usan los chips de los asistentes y del Estudio, y un
  // querySelectorAll global les borraría la selección a todos.
  document.querySelectorAll('#view-results .m-btn').forEach(b => b.classList.remove('active'));
  const m50 = document.querySelector('#view-results [data-m="50"]');
  if (m50) m50.classList.add('active');
}

function navBack() {
  if (S.step === 1) showView('view-home');
  else goStep(S.step - 1);
}

function goStep(n) {
  if (n === 2) {
    const nm = document.getElementById('inp-name').value.trim();
    if (!nm) { toast('¡Ponle nombre a tu creación! 🏷️'); return; }
    S.p.name = nm;
    S.p.desc = document.getElementById('inp-desc').value.trim().slice(0, MAX_DESC_LEN);
    // Si nunca tocó el icono, se queda con el sugerido por el nombre.
    if (!S.p.emojiManual) S.p.emoji = getEmoji(nm);
    // Validate that at least one material has a positive cost
    const costs = Array.from(document.querySelectorAll('.mat-cost'));
    const hasValidMat = costs.some(i => parseMonto(i.value) > 0);
    if (!hasValidMat) { toast('Ingresa el costo de al menos un material 🧺'); return; }
    S.p.matTotal = getMatTotal();
  }
  if (n === 3) {
    const hBruto = parseHoras(document.getElementById('inp-hours').value);
    // Nadie le dedica 10.000 horas a una pieza: sobre ese tope es un dedazo
    // (240 en vez de 2.40) y produciría un precio absurdo sin aviso.
    const h = reflejarRecorte('inp-hours', hBruto, Math.min(hBruto, 9999));
    const r = parseMonto(document.getElementById('inp-rate').value);
    if (h <= 0) { toast('Las horas deben ser mayor a 0 ⏰'); return; }
    if (r <= 0) { toast('El valor hora debe ser mayor a 0 💙'); return; }
    S.p.hours = h; S.p.rate = r;
  }
  document.querySelectorAll('.calc-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${n}`).classList.add('active');
  S.step = n;
  updateProg(n);
  window.scrollTo(0,0);
}

const STEP_NAMES = ['Materiales', 'Tu tiempo', 'Creatividad', 'Costos fijos'];

function updateProg(n) {
  document.getElementById('prog-step').textContent  = STEP_NAMES[n - 1] || '';
  document.getElementById('prog-label').textContent = `${n} de 4`;
  for (let i = 1; i <= 4; i++) {
    const d = document.getElementById(`pd${i}`);
    d.className = 'pdot';
    if (i === n) d.classList.add('active');
    else if (i < n) d.classList.add('done');
  }
}

// ===================================================
// ASISTENTE DE VALOR HORA
// ===================================================
// El paso 2 pide un número que casi nadie sabe responder. Este asistente llega
// a él por partes: cuánto necesitas ganar, cuánto tiempo puedes dedicarle,
// cuánto de ese tiempo se cobra y cuánto se lleva la previsión.
//
// Mientras la pantalla está abierta el estado vive en memoria (S.rate.draft) y
// solo se persiste al pulsar "Usar este valor". Así salir de aquí no puede
// perder nada guardado y no hace falta preguntar nada al volver.

// Lo que sale de localStorage se reconstruye desde cero, igual que un producto
// importado: puede venir de un respaldo ajeno o de una escritura a medias.
function sanitizeRateProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const num = (v, max, def) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : def;
  };
  const deUnaLista = (v, lista, def) => lista.includes(Number(v)) ? Number(v) : def;

  const inRaw  = (raw.inputs && typeof raw.inputs === 'object') ? raw.inputs : {};
  const gaRaw  = (inRaw.gastos && typeof inRaw.gastos === 'object') ? inRaw.gastos : {};
  const gastos = {};
  for (const g of RATE_GASTOS) gastos[g.id] = num(gaRaw[g.id], MAX_INPUT_NUM, g.ref);

  const inputs = {
    mode:        inRaw.mode === 'directo' ? 'directo' : 'gastos',
    gastos,
    metaDirecta: num(inRaw.metaDirecta, MAX_INPUT_NUM, 0),
    share:       deUnaLista(inRaw.share, [100, 50, 30], RATE_DEFAULTS.share),
    days:        Math.min(7, Math.max(1, Math.round(num(inRaw.days, 7, RATE_DEFAULTS.days)))),
    hoursDay:    Math.min(16, Math.max(0.5, num(inRaw.hoursDay, 16, RATE_DEFAULTS.hoursDay))),
    focus:       deUnaLista(inRaw.focus, [50, 65, 80], RATE_DEFAULTS.focus),
    taxOn:       inRaw.taxOn !== false,
    tax:         num(inRaw.tax, 60, RATE_DEFAULTS.tax)
  };

  const rate = num(raw.rate, MAX_INPUT_NUM, 0);
  if (rate <= 0) return null;

  return {
    rate: Math.round(rate),
    remember: raw.remember !== false,
    savedAt: num(raw.savedAt, Number.MAX_SAFE_INTEGER, 0),
    inputs
  };
}

function loadRate() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY_RATE) || 'null'); } catch(e) {}
  return sanitizeRateProfile(raw);
}

function saveRate(perfil) {
  try {
    localStorage.setItem(KEY_RATE, JSON.stringify(perfil));
    return true;
  } catch(e) {
    return false;
  }
}

// Abre el asistente. `origen` es la vista a la que vuelve el ←: desde la guía o
// desde "Tu marca" no tiene sentido aterrizar en la calculadora.
function openRateWizard(origen) {
  S.rateFrom = origen || 'view-calc';
  // Se parte de lo que ya respondió, si respondió alguna vez.
  S.rateDraft = S.rate
    ? JSON.parse(JSON.stringify(S.rate.inputs))
    : JSON.parse(JSON.stringify(RATE_DEFAULTS));
  renderRateWizard();
  showView('view-rate');
}

function closeRateWizard() {
  showView(S.rateFrom || 'view-calc');
}

// Pinta las partes que dependen de los datos y vuelca el borrador a los campos.
function renderRateWizard() {
  const d = S.rateDraft;

  document.getElementById('rate-rows').innerHTML = RATE_GASTOS.map(g => `
    <div class="rate-row">
      <label class="rate-row-lbl" for="rg-${g.id}">${g.lbl}</label>
      <input class="rate-row-input" type="text" inputmode="numeric" id="rg-${g.id}" data-gasto="${g.id}"
             maxlength="10" autocomplete="off"
             value="${d.gastos[g.id]}" data-input="rateRecalc">
    </div>`).join('');

  document.getElementById('rate-days').innerHTML = [1,2,3,4,5,6,7].map(n => `
    <button type="button" class="rate-day${n === d.days ? ' sel' : ''}" data-days="${n}"
            data-action="setRateDays" aria-label="${n} día${n > 1 ? 's' : ''} por semana">${n}</button>`).join('');

  document.getElementById('rate-meta-directa').value = d.metaDirecta || '';
  document.getElementById('rate-hours-day').value    = d.hoursDay;
  document.getElementById('rate-tax-on').checked     = d.taxOn;
  document.getElementById('rate-tax').value          = d.tax;
  document.getElementById('rate-remember').checked   = S.rate ? S.rate.remember : true;

  marcarChips('.rate-modes .m-btn',  b => b.dataset.mode  === d.mode);
  marcarChips('.rate-shares .m-btn', b => Number(b.dataset.share) === d.share);
  marcarChips('.rate-focus .m-btn',  b => Number(b.dataset.focus) === d.focus);

  document.getElementById('rate-legal').textContent =
    `Los montos sugeridos son una referencia para un hogar de Santiago (${RATE_REF_FECHA}) y están para que los cambies por los tuyos. El piso legal se calcula con el ingreso mínimo de ${fmt(RATE_MIN_MENSUAL)} y una jornada de ${RATE_MIN_JORNADA} horas semanales.`;

  rateRecalc();
}

function marcarChips(selector, esActivo) {
  document.querySelectorAll(selector).forEach(b => b.classList.toggle('active', esActivo(b)));
}

function setRateMode(mode) {
  S.rateDraft.mode = mode === 'directo' ? 'directo' : 'gastos';
  marcarChips('.rate-modes .m-btn', b => b.dataset.mode === S.rateDraft.mode);
  rateRecalc();
}

function setRateShare(pct) {
  S.rateDraft.share = pct;
  marcarChips('.rate-shares .m-btn', b => Number(b.dataset.share) === pct);
  rateRecalc();
}

function setRateDays(n) {
  S.rateDraft.days = n;
  document.querySelectorAll('.rate-day').forEach(b => {
    b.classList.toggle('sel', Number(b.dataset.days) === n);
  });
  rateRecalc();
}

function setRateFocus(pct) {
  S.rateDraft.focus = pct;
  marcarChips('.rate-focus .m-btn', b => Number(b.dataset.focus) === pct);
  rateRecalc();
}

// Lee los campos, recalcula y repinta todos los resultados. Se llama en cada
// pulsación: ver el número moverse es la mitad de lo que enseña la pantalla.
function rateRecalc() {
  const d = S.rateDraft;
  if (!d) return;

  // Volcar los campos libres al borrador
  document.querySelectorAll('[data-gasto]').forEach(i => {
    d.gastos[i.dataset.gasto] = parseMonto(i.value);
  });
  d.metaDirecta = parseMonto(document.getElementById('rate-meta-directa').value);
  const hdBruto = parseHoras(document.getElementById('rate-hours-day').value);
  d.hoursDay    = reflejarRecorte('rate-hours-day', hdBruto, Math.min(16, hdBruto));
  d.taxOn       = document.getElementById('rate-tax-on').checked;
  const txBruto = parseMonto(document.getElementById('rate-tax').value);
  d.tax         = reflejarRecorte('rate-tax', txBruto, Math.min(60, txBruto));

  const directo = d.mode === 'directo';
  document.getElementById('rate-gastos').hidden  = directo;
  document.getElementById('rate-directo').hidden = !directo;
  document.getElementById('rate-tax-wrap').hidden = !d.taxOn;

  const hogar = RATE_GASTOS.reduce((s, g) => s + (d.gastos[g.id] || 0), 0);
  const meta  = directo ? d.metaDirecta : hogar * d.share / 100;

  // Se redondean antes de dividir, no solo al pintarlas: si la pantalla dice
  // "85 horas cobrables" y por dentro divide entre 84,5, quien rehaga la cuenta
  // a mano no llega al mismo número y deja de fiarse de la app.
  const horasMes  = Math.round(d.days * d.hoursDay * SEMANAS_MES);
  const cobrables = Math.round(horasMes * d.focus / 100);
  const conTax    = meta * (1 + (d.taxOn ? d.tax : 0) / 100);
  // Un valor hora de $8.327 no lo escribe nadie: se redondea a la centena.
  const valor = cobrables > 0 ? Math.round(conTax / cobrables / 100) * 100 : 0;

  document.getElementById('rate-hogar').textContent       = fmt(hogar);
  document.getElementById('rate-meta').textContent        = fmt(meta);
  document.getElementById('rate-month-hours').textContent = horasMes;
  document.getElementById('rate-billable').textContent    = cobrables;
  document.getElementById('rate-value').textContent       = fmt(valor);

  document.getElementById('rate-formula').textContent = cobrables > 0
    ? `${fmt(meta)}${d.taxOn ? ` + ${d.tax}%` : ''} ÷ ${cobrables} horas cobrables`
    : 'Dinos cuántas horas puedes dedicarle';

  pintarPisoLegal(valor);
  S.rateValue = valor;
}

// El aviso del piso legal es el corazón de la pantalla: si el número queda por
// debajo del mínimo por hora, hay que decirlo sin rodeos.
function pintarPisoLegal(valor) {
  const caja = document.getElementById('rate-floor-note');
  const hd   = document.getElementById('rate-floor-hd');
  const txt  = document.getElementById('rate-floor-txt');

  if (valor <= 0) {
    caja.className = 'note-card note-card-blue';
    hd.textContent = '💡 Falta un dato';
    txt.textContent = 'Completa los bloques de arriba y aquí aparece tu valor hora.';
    return;
  }

  if (valor < RATE_MIN_HORA) {
    caja.className = 'note-card note-card-red';
    hd.textContent = '⚠️ Estás bajo el mínimo legal';
    txt.innerHTML = `Por hora, el sueldo mínimo en Chile equivale a unos <strong>${fmt(RATE_MIN_HORA)}</strong>. Tu resultado (${fmt(valor)}) queda por debajo: significa que estás pidiéndole a tu emprendimiento menos de lo que te pagaría cualquier empleo. Sube tu meta mensual o baja las horas que le dedicas.`;
    return;
  }

  caja.className = 'note-card note-card-green';
  hd.textContent = '✅ Por sobre el mínimo legal';
  txt.innerHTML = `El sueldo mínimo por hora equivale a unos <strong>${fmt(RATE_MIN_HORA)}</strong>. Tu valor hora lo supera, que es justo lo que debe pasar: trabajar por tu cuenta tiene costos y riesgos que un sueldo no tiene.`;
}

// "Usar este valor": lo lleva al paso 2 y, si lo pidió, lo guarda para la
// próxima vez.
function applyRate() {
  const valor = S.rateValue || 0;
  if (valor <= 0) { toast('Completa los datos para obtener tu valor hora ⏰'); return; }

  const recordar = document.getElementById('rate-remember').checked;
  const perfil = {
    rate: valor,
    remember: recordar,
    savedAt: Date.now(),
    inputs: JSON.parse(JSON.stringify(S.rateDraft))
  };

  // El perfil se guarda siempre (para que el asistente recuerde sus montos);
  // `remember` solo decide si el valor se rellena solo en cada producto nuevo.
  S.rate = perfil;
  const guardado = saveRate(perfil);

  const campo = document.getElementById('inp-rate');
  if (campo) { campo.value = valor; S.p.rate = valor; updateLaborPreview(); }
  renderRateSaved();

  if (!guardado) toast('⚠️ Valor aplicado, pero no se pudo recordar en este navegador');
  else toast(recordar ? `✨ Tu valor hora: ${fmt(valor)}` : `✨ Valor aplicado: ${fmt(valor)}`);

  // Si venía de la guía o de "Tu marca" no hay ningún cálculo esperando: se
  // vuelve al origen. Desde el paso 2, ahí se queda.
  showView(S.rateFrom === 'view-calc' ? 'view-calc' : S.rateFrom);
}

// Fila del paso 2 que anuncia el valor guardado. El número nunca aparece por
// arte de magia: si el campo viene relleno, aquí se explica por qué.
function renderRateSaved() {
  const el = document.getElementById('rate-saved');
  if (!el) return;
  if (!S.rate || !S.rate.remember) { el.classList.remove('show'); return; }
  el.querySelector('.rs-text').textContent = `Usas tu valor hora guardado: ${fmt(S.rate.rate)}`;
  el.classList.add('show');
}

// Fila de la pestaña "Tu marca"
function renderRateRow() {
  const sub = document.getElementById('rate-row-sub');
  if (!sub) return;
  sub.textContent = S.rate
    ? `${fmt(S.rate.rate)} por hora${S.rate.remember ? ' · se usa en cada producto' : ''}`
    : 'Calcúlalo una vez y reutilízalo';
}

// ===================================================
// ASISTENTE DE COSTOS FIJOS
// ===================================================
// El hermano del de valor hora, para el paso 4. Mismo esqueleto: borrador en
// memoria, recálculo en vivo y persistencia solo al pulsar "Usar estos valores".
//
// La diferencia importante es conceptual: el asistente de valor hora deja fuera
// a propósito los gastos de la casa, y aquí entra la parte de esa casa que
// ocupa el taller. Entre los dos cubren el total sin contar nada dos veces.

function sanitizeFixedProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const num = (v, max, def) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : def;
  };

  const inRaw = (raw.inputs && typeof raw.inputs === 'object') ? raw.inputs : {};
  const leerLista = (lista, guardado) => {
    const src = (guardado && typeof guardado === 'object') ? guardado : {};
    const out = {};
    for (const g of lista) out[g.id] = num(src[g.id], MAX_INPUT_NUM, g.ref);
    return out;
  };

  const inputs = {
    share:      [0, 10, 15, 25].includes(Number(inRaw.share)) ? Number(inRaw.share) : FIXED_DEFAULTS.share,
    hogar:      leerLista(FIXED_HOGAR, inRaw.hogar),
    negocio:    leerLista(FIXED_NEGOCIO, inRaw.negocio),
    toolsValue: num(inRaw.toolsValue, MAX_INPUT_NUM, FIXED_DEFAULTS.toolsValue),
    toolsYears: Math.min(20, Math.max(1, Math.round(num(inRaw.toolsYears, 20, FIXED_DEFAULTS.toolsYears)))),
    units:      Math.min(100000, Math.max(1, Math.round(num(inRaw.units, 100000, FIXED_DEFAULTS.units))))
  };

  const fixed = num(raw.fixed, MAX_INPUT_NUM, -1);
  if (fixed < 0) return null;

  return {
    fixed: Math.round(fixed),
    units: inputs.units,
    remember: raw.remember !== false,
    savedAt: num(raw.savedAt, Number.MAX_SAFE_INTEGER, 0),
    inputs
  };
}

function loadFixed() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY_FIXED) || 'null'); } catch(e) {}
  return sanitizeFixedProfile(raw);
}

function saveFixed(perfil) {
  try {
    localStorage.setItem(KEY_FIXED, JSON.stringify(perfil));
    return true;
  } catch(e) {
    return false;
  }
}

function openFixedWizard(origen) {
  S.fixedFrom = origen || 'view-calc';

  if (S.fixed) {
    S.fixedDraft = JSON.parse(JSON.stringify(S.fixed.inputs));
    S.fixedSembrado = false;
  } else {
    S.fixedDraft = JSON.parse(JSON.stringify(FIXED_DEFAULTS));
    // Si ya calculó su valor hora, el arriendo y las cuentas están dichos: se
    // reutilizan en vez de pedirle lo mismo otra vez.
    S.fixedSembrado = false;
    if (S.rate && S.rate.inputs && S.rate.inputs.gastos) {
      for (const g of FIXED_HOGAR) {
        const v = S.rate.inputs.gastos[g.desdeRate];
        if (Number.isFinite(v) && v > 0) { S.fixedDraft.hogar[g.id] = v; S.fixedSembrado = true; }
      }
    }
  }

  renderFixedWizard();
  showView('view-fixed');
}

function closeFixedWizard() {
  showView(S.fixedFrom || 'view-calc');
}

function renderFixedWizard() {
  const d = S.fixedDraft;

  const fila = (g, grupo) => `
    <div class="rate-row">
      <label class="rate-row-lbl" for="fx-${grupo}-${g.id}">${g.lbl}</label>
      <input class="rate-row-input" type="text" inputmode="numeric" id="fx-${grupo}-${g.id}"
             data-fixed="${grupo}" data-fid="${g.id}"
             maxlength="10" autocomplete="off"
             value="${d[grupo][g.id]}" data-input="fixedRecalc">
    </div>`;

  document.getElementById('fixed-home-rows').innerHTML = FIXED_HOGAR.map(g => fila(g, 'hogar')).join('');
  document.getElementById('fixed-biz-rows').innerHTML  = FIXED_NEGOCIO.map(g => fila(g, 'negocio')).join('');

  document.getElementById('fixed-home-origen').textContent = S.fixedSembrado
    ? 'Tomados de lo que respondiste en tu valor hora. Cámbialos si aquí no calzan.'
    : 'Lo que pagas por tu casa, completo. Abajo se aplica solo la parte del negocio.';

  document.getElementById('fixed-tools-value').value = d.toolsValue;
  document.getElementById('fixed-tools-years').value = d.toolsYears;
  document.getElementById('fixed-units').value       = d.units;
  document.getElementById('fixed-remember').checked  = S.fixed ? S.fixed.remember : true;

  marcarChips('.fixed-shares .m-btn', b => Number(b.dataset.fshare) === d.share);

  document.getElementById('fixed-legal').textContent =
    `Los montos sugeridos son una referencia (${RATE_REF_FECHA}) para que la pantalla no empiece en blanco: cámbialos por los tuyos. Lo que aquí no entre, no lo estará cobrando ningún producto.`;

  fixedRecalc();
}

function setFixedShare(pct) {
  S.fixedDraft.share = pct;
  marcarChips('.fixed-shares .m-btn', b => Number(b.dataset.fshare) === pct);
  fixedRecalc();
}

function fixedRecalc() {
  const d = S.fixedDraft;
  if (!d) return;

  document.querySelectorAll('[data-fixed]').forEach(i => {
    d[i.dataset.fixed][i.dataset.fid] = parseMonto(i.value);
  });
  d.toolsValue = parseMonto(document.getElementById('fixed-tools-value').value);
  const tyBruto = parseMonto(document.getElementById('fixed-tools-years').value);
  d.toolsYears = Math.max(1, reflejarRecorte('fixed-tools-years', tyBruto, Math.min(20, tyBruto)) || 1);
  const unBruto = parseMonto(document.getElementById('fixed-units').value);
  d.units      = Math.max(1, reflejarRecorte('fixed-units', unBruto, Math.min(100000, unBruto)) || 1);

  const hogarBruto = FIXED_HOGAR.reduce((s, g) => s + (d.hogar[g.id] || 0), 0);
  const hogar   = Math.round(hogarBruto * d.share / 100);
  const negocio = FIXED_NEGOCIO.reduce((s, g) => s + (d.negocio[g.id] || 0), 0);
  const tools   = Math.round(d.toolsValue / (d.toolsYears * 12));
  const total   = hogar + negocio + tools;
  const porUnidad = Math.round(total / d.units);

  document.getElementById('fixed-home-total').textContent  = fmt(hogar);
  document.getElementById('fixed-biz-total').textContent   = fmt(negocio);
  document.getElementById('fixed-tools-total').textContent = fmt(tools);
  document.getElementById('fixed-value').textContent       = fmt(total);
  document.getElementById('fixed-formula').textContent     =
    `${fmt(hogar)} de tu casa + ${fmt(negocio)} del negocio + ${fmt(tools)} de herramientas`;

  document.getElementById('fixed-note').innerHTML = total > 0
    ? `Repartidos entre <strong>${d.units} unidades</strong> al mes, cada producto carga <strong>${fmt(porUnidad)}</strong>. Si no los cobras, ese dinero sale de tu bolsillo todos los meses, vendas o no vendas.`
    : 'Aunque trabajes desde tu casa y con lo que ya tienes, algo te cuesta: la luz que gastas, el internet, el transporte a comprar materiales. Si aquí va cero, lo estás pagando tú.';

  S.fixedValue = total;
  S.fixedUnits = d.units;
}

function applyFixed() {
  const total = S.fixedValue || 0;
  const units = S.fixedUnits || 1;

  const recordar = document.getElementById('fixed-remember').checked;
  const perfil = {
    fixed: total,
    units,
    remember: recordar,
    savedAt: Date.now(),
    inputs: JSON.parse(JSON.stringify(S.fixedDraft))
  };

  S.fixed = perfil;
  const guardado = saveFixed(perfil);

  const campoF = document.getElementById('inp-fixed');
  const campoU = document.getElementById('inp-units');
  if (campoF) campoF.value = total;
  if (campoU) campoU.value = units;
  renderFixedSaved();

  if (!guardado) toast('⚠️ Valores aplicados, pero no se pudieron recordar en este navegador');
  else toast(`✨ Costos fijos: ${fmt(total)} al mes`);

  showView(S.fixedFrom === 'view-calc' ? 'view-calc' : S.fixedFrom);
}

function renderFixedSaved() {
  const el = document.getElementById('fixed-saved');
  if (!el) return;
  if (!S.fixed || !S.fixed.remember) { el.classList.remove('show'); return; }
  el.querySelector('.rs-text').textContent =
    `Usas tus costos guardados: ${fmt(S.fixed.fixed)} entre ${S.fixed.units} unidades`;
  el.classList.add('show');
}

function renderFixedRow() {
  const sub = document.getElementById('fixed-row-sub');
  if (!sub) return;
  sub.textContent = S.fixed
    ? `${fmt(S.fixed.fixed)} al mes · ${S.fixed.units} unidades`
    : 'Calcúlalos una vez y reutilízalos';
}

// ===================================================
// MATERIALS
// ===================================================
function addMat() {
  const list = document.getElementById('mat-list');
  const row = document.createElement('div');
  row.className = 'mat-row';
  row.innerHTML = `
    <input class="field-input mat-name" type="text" placeholder="ej: Fragancia" maxlength="60" autocomplete="off" style="--step-accent:var(--coral-deep)">
    <input class="field-input mat-cost" type="text" inputmode="numeric" placeholder="$" maxlength="10" autocomplete="off" data-input="calcMatTotal" style="--step-accent:var(--coral-deep)" aria-label="Costo del material">
    <button class="btn-rem" data-action="remMat" aria-label="Quitar material">✕</button>`;
  list.appendChild(row);
  row.querySelector('input').focus();
}

function remMat(btn) {
  const rows = document.querySelectorAll('.mat-row');
  if (rows.length > 1) { btn.parentElement.remove(); calcMatTotal(); }
  else toast('¡Al menos un material! 🧺');
}

function getMatTotal() {
  return Array.from(document.querySelectorAll('.mat-cost'))
    .reduce((s, i) => s + parseMonto(i.value), 0);
}

function calcMatTotal() {
  document.getElementById('mat-total').textContent = fmt(getMatTotal());
}

// ===================================================
// LABOR PREVIEW
// ===================================================
function updateLaborPreview() {
  const h = parseHoras(document.getElementById('inp-hours').value);
  const r = parseMonto(document.getElementById('inp-rate').value);
  const prev = document.getElementById('labor-preview');
  if (h > 0 && r > 0) {
    document.getElementById('labor-val').textContent = fmt(h * r);
    prev.style.display = 'block';
  } else {
    prev.style.display = 'none';
  }
}

// ===================================================
// CREATIVITY
// ===================================================
function selCr(el) {
  document.querySelectorAll('.cr-option').forEach(o => {
    o.classList.remove('sel');
    o.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('sel');
  el.setAttribute('aria-pressed', 'true');
  S.p.cr = el.dataset.val;
}

// ===================================================
// RESULTS
// ===================================================
function showResults() {
  const fixed = parseMonto(document.getElementById('inp-fixed').value);
  const units = parseMonto(document.getElementById('inp-units').value);
  if (units <= 0) { toast('Las unidades mensuales deben ser mayor a 0 📦'); return; }
  S.p.fixed = fixed;
  S.p.units = units;
  renderResults();
  showView('view-results');
  setTimeout(animateBars, 350);
}

function calc(margin) {
  const p = S.p;
  const mat    = p.matTotal;
  const labor  = p.hours * p.rate;
  const cr     = (mat + labor) * (CR_MULT[p.cr] || 0.05);
  const struct = p.fixed / Math.max(p.units, 1);
  const minP   = mat + labor + cr + struct;
  const idealP = minP * (1 + (margin !== undefined ? margin : p.margin) / 100);
  return { mat, labor, cr, struct, minP, idealP };
}

function renderResults() {
  const r = calc();
  document.getElementById('res-name').textContent = S.p.name;
  document.getElementById('res-min').textContent        = fmt(r.minP);
  document.getElementById('res-min-iva').textContent    = fmt(r.minP * (1 + IVA));
  document.getElementById('res-ideal').textContent      = fmt(r.idealP);
  document.getElementById('res-ideal-iva').textContent  = fmt(r.idealP * (1 + IVA));
  document.getElementById('res-margin-lbl').textContent = S.p.margin;
  // El icono que eligió la creadora manda; solo sin elección se infiere del
  // nombre. "Sin icono" cae al 🎨 de reserva, igual que la lista de productos.
  document.getElementById('confetti-emoji').textContent =
    (S.p.emojiManual ? S.p.emoji : getEmoji(S.p.name)) || '🎨';

  renderBars(r);
  renderWisdom(r);
}

function renderBars(r) {
  const bars = [
    { e:'🧺', lbl:'Materiales',   val:r.mat,    c1:'#FF8A7A', c2:'#FF6B6B' },
    { e:'⏰', lbl:'Tu tiempo',     val:r.labor,  c1:'#6BA9FF', c2:'#4D96FF' },
    { e:'🎨', lbl:'Creatividad',   val:r.cr,     c1:'#DFA8FF', c2:'#C77DFF' },
    { e:'🏠', lbl:'Costos fijos',  val:r.struct, c1:'#8FDB99', c2:'#3BA55C' },
  ];
  const minP = r.minP;
  document.getElementById('bar-items').innerHTML = bars.map(b => {
    const pct = minP > 0 ? (b.val / minP * 100).toFixed(1) : 0;
    return `
      <div class="bar-item">
        <div class="bar-header">
          <div class="bar-lbl"><span class="bar-lbl-emoji">${b.e}</span>${b.lbl}</div>
          <div class="bar-val">${fmt(b.val)} · ${pct}%</div>
        </div>
        <div class="bar-track">
          <div class="bar-fill" data-w="${pct}" style="background:linear-gradient(90deg,${b.c1},${b.c2}); width:0"></div>
        </div>
      </div>`;
  }).join('');
}

function animateBars() {
  document.querySelectorAll('.bar-fill').forEach(b => {
    b.style.width = b.dataset.w + '%';
  });
}

function renderWisdom(r) {
  const fn = WISDOMS[Math.floor(Math.random() * WISDOMS.length)];
  document.getElementById('wisdom-txt').innerHTML = fn(r);
}

function setMargin(btn) {
  // Acotado a resultados: .m-btn también existe en asistentes y Estudio.
  document.querySelectorAll('#view-results .m-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  S.p.margin = parseInt(btn.dataset.m);
  // Cambiar el margen después de guardar deja el resultado en pantalla distinto
  // del producto guardado: vuelve a haber trabajo pendiente.
  S.p._saved = false;
  const r = calc();
  document.getElementById('res-ideal').textContent      = fmt(r.idealP);
  document.getElementById('res-ideal-iva').textContent  = fmt(r.idealP * (1 + IVA));
  document.getElementById('res-margin-lbl').textContent = S.p.margin;
}

// ===================================================
// SAVE
// ===================================================
// El doble toque es lo normal en móvil cuando la primera pulsación no da
// feedback inmediato, y aquí el botón sigue vivo 1,4 s hasta el cambio de
// vista: sin esta guarda salían dos productos idénticos con ids distintos.
let _guardando = false;

// Devuelve el id del producto creado, o null si no se pudo guardar.
// `silencioso` lo usa publishFromResults(), que encadena con el Estudio.
function saveProduct(silencioso) {
  if (_guardando) return null;
  const r = calc();
  const prod = {
    id:     nextProductId(),
    addedAt: Date.now(),
    name:   S.p.name,
    desc:   S.p.desc || '',
    // Puede ser cadena vacía a propósito: la creadora eligió "sin icono".
    emoji:  S.p.emojiManual ? S.p.emoji : getEmoji(S.p.name),
    date:   new Date().toLocaleDateString('es-CL'),
    mat:    Math.round(r.mat),
    labor:  Math.round(r.labor),
    cr:     Math.round(r.cr),
    struct: Math.round(r.struct),
    minP:   Math.round(r.minP),
    idealP: Math.round(r.idealP),
    margin: S.p.margin,
    crLvl:  S.p.cr
  };
  S.products.unshift(prod);
  // Si el almacenamiento falla hay que deshacer: dejarlo en memoria haría creer
  // que se guardó, y el siguiente arranque lo perdería sin avisar.
  if (!persistProducts()) {
    S.products = S.products.filter(x => x.id !== prod.id);
    return null;
  }
  renderHome();
  renderProducts();
  // El cálculo de resultados quedó guardado: salir de esa pantalla ya no debe
  // preguntar por trabajo pendiente.
  S.p._saved = true;
  if (!silencioso) {
    toast('✨ ¡Producto guardado!');
    _guardando = true;
    setTimeout(() => { _guardando = false; showView('view-products'); }, 1400);
  }
  return prod.id;
}

// "Crear la publicación" desde la pantalla de resultados. El Estudio trabaja
// sobre productos guardados, así que primero se guarda y luego se abre el
// editor con el id recién creado — sin el toast ni el salto a la lista.
function publishFromResults() {
  const id = saveProduct(true);
  if (id == null) return;
  toast('✨ Producto guardado');
  openStudio('historia', id);
}

function delProduct(e, id) {
  e.stopPropagation();
  const p = S.products.find(p => p.id === id);
  if (!p) return;
  confirmDialog({
    icon: '🗑️',
    title: '¿Eliminar producto?',
    message: `"${p.name}" se borrará de tu lista. Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    dangerous: true
  }).then(ok => {
    if (!ok) return;
    const antes = S.products;
    S.products = S.products.filter(p => p.id !== id);
    // Si no se pudo escribir, se deshace: sin el rollback quedaba una tarjeta
    // zombi en pantalla (el producto seguía visible pero ya no existía en
    // memoria) y el borrado se colaba a disco con el siguiente guardado.
    if (!persistProducts()) { S.products = antes; return; }
    renderHome();
    renderProducts();
    toast('🗑️ Producto eliminado');
  }).catch(() => {});
}

// ===================================================
// DETAIL (EDITABLE)
// ===================================================
function showDetail(idOrEvent, id) {
  let realId = idOrEvent;
  if (idOrEvent && typeof idOrEvent === 'object') {
    idOrEvent.stopPropagation();
    realId = id;
  }
  const p = S.products.find(p => p.id === realId);
  if (!p) return;

  const crOpts = [
    { val:'facil',    e:'😊', lbl:'Fácil' },
    { val:'moderado', e:'🤔', lbl:'Mod.' },
    { val:'intenso',  e:'🔥', lbl:'Intenso' },
    { val:'obra',     e:'🏆', lbl:'Autor' },
  ];
  const crGrid = crOpts.map(o => `
    <div class="det-cr-opt${p.crLvl===o.val?' sel':''}" data-val="${o.val}" data-action="detSelCr" data-id="${realId}"
         role="button" tabindex="0" aria-pressed="${p.crLvl===o.val}">
      <div class="dco-emoji">${o.e}</div>
      <div class="dco-lbl">${o.lbl}</div>
    </div>`).join('');

  const marginBtns = MARGINS.map(m => `
    <button class="m-btn${p.margin===m?' active':''}" data-m="${m}" data-action="detSetMargin" data-id="${realId}">${m}%<br><small>${m===30?'Básico':m===50?'Sugerido':m===80?'Autor':'Premium'}</small></button>`
  ).join('');

  // Todo lo editable del detalle vive en un borrador hasta que la creadora
  // pulse "Guardar cambios". Si se tocara el producto directamente, salir sin
  // guardar dejaría el cambio vivo en memoria con los precios viejos, y el
  // siguiente persistProducts() (guardar otro producto, borrar, importar) lo
  // escribiría a disco: un producto que dice "margen 120%" con el precio
  // calculado al 50%.
  S._detId    = realId;
  S._detEmoji = p.emoji || '';
  S._detDraft = { crLvl: p.crLvl, margin: p.margin };

  document.getElementById('det-body').innerHTML = `
    <div class="detail-head">
      <div class="detail-emoji-wrap">
        <button type="button" class="icon-picker-btn big" data-action="openIconPicker" data-btn="det-emoji-btn"
                id="det-emoji-btn" title="Cambiar el icono">
          <span class="icon-picker-glyph${p.emoji ? '' : ' empty'}" id="det-emoji">${p.emoji ? esc(p.emoji) : '＋'}</span>
        </button>
      </div>
      <div>
        <div class="detail-pname" id="det-pname">${esc(p.name)}</div>
        <div class="detail-date">Guardado el ${p.date}</div>
      </div>
    </div>

    <!-- PRECIOS -->
    <div class="price-hero">
      <div class="ph-tag">Precio ideal · con IVA</div>
      <div class="ph-val" id="det-ideal-iva">${fmt(p.idealP * (1 + IVA))}</div>
      <div class="ph-note">Neto <strong id="det-ideal">${fmt(p.idealP)}</strong> · margen <strong id="det-margin-lbl">${p.margin}</strong>%</div>
    </div>

    <div class="price-floor">
      <div class="pf-text">
        <div class="pf-tag">Precio mínimo</div>
        <div class="pf-val" id="det-min-iva">${fmt(p.minP * (1 + IVA))}</div>
        <div class="pf-net">Neto <span id="det-min">${fmt(p.minP)}</span></div>
      </div>
      <div class="pf-note">Tu suelo, IVA incluido.</div>
    </div>

    <!-- PUBLICAR -->
    <button type="button" class="det-publish" data-action="openStudio" data-id="${realId}">
      <span class="dp-ico">📸</span>
      <span class="dp-text">
        <span class="dp-title">Publicar este producto</span>
        <span class="dp-sub">Historia lista con este precio</span>
      </span>
      <span class="dp-arrow">→</span>
    </button>

    <!-- MARGEN -->
    <div class="margin-section" style="padding:0; margin-bottom:20px">
      <div class="margin-lbl">Margen de ganancia</div>
      <div class="margin-btns" id="det-margin-btns">${marginBtns}</div>
    </div>

    <!-- DESCRIPCIÓN -->
    <div class="det-edit-section">
      <div class="det-edit-title">📝 Descripción</div>
      <p class="det-edit-hint">Es la que aparece en tus publicaciones.</p>
      <textarea class="field-input field-textarea" id="det-desc" rows="2" maxlength="${MAX_DESC_LEN}"
                placeholder="ej: Hecho a mano con lavanda de Colchagua">${esc(p.desc || '')}</textarea>
    </div>

    <!-- EDITAR COMPOSICIÓN -->
    <div class="det-edit-section">
      <div class="det-edit-title">Composición del precio</div>

      <div class="det-field-row">
        <label class="det-field-lbl" for="det-mat">🧺 Materiales</label>
        <input class="det-field-input" type="text" inputmode="numeric" id="det-mat" value="${p.mat}" maxlength="10" autocomplete="off" data-input="detRecalc" data-id="${realId}">
      </div>
      <div class="det-field-row">
        <label class="det-field-lbl" for="det-labor">⏰ Tu tiempo</label>
        <input class="det-field-input" type="text" inputmode="numeric" id="det-labor" value="${p.labor}" maxlength="10" autocomplete="off" data-input="detRecalc" data-id="${realId}">
      </div>
      <div class="det-field-row">
        <label class="det-field-lbl" for="det-struct">🏠 Costos fijos</label>
        <input class="det-field-input" type="text" inputmode="numeric" id="det-struct" value="${p.struct}" maxlength="10" autocomplete="off" data-input="detRecalc" data-id="${realId}">
      </div>

      <div class="field-label" style="margin-top:18px; margin-bottom:10px">🎨 Carga creativa</div>
      <div class="det-cr-grid" id="det-cr-grid">${crGrid}</div>
    </div>

    <!-- GUARDAR + ACCIONES -->
    <div style="padding-bottom:16px">
      <button class="btn-det-save" data-action="saveDetProduct" data-id="${realId}">Guardar cambios</button>
      <div class="det-secondary-actions">
        <button class="btn-det-secondary btn-whatsapp" data-action="shareWhatsApp" data-id="${realId}">${ICONS.whatsapp}<span>WhatsApp</span></button>
        <button class="btn-det-secondary" data-action="duplicateProduct" data-id="${realId}">📋 Duplicar</button>
      </div>
      <button class="btn-new-calc" data-action="showView" data-view="view-products" style="width:100%">← Volver a mis productos</button>
    </div>`;

  showView('view-detail');
}

function detRecalc(id) {
  const p = S.products.find(p => p.id === id);
  if (!p) return;
  const d      = S._detDraft || { crLvl: p.crLvl, margin: p.margin };
  const mat    = parseMonto(document.getElementById('det-mat').value);
  const labor  = parseMonto(document.getElementById('det-labor').value);
  const struct = parseMonto(document.getElementById('det-struct').value);
  const cr     = (mat + labor) * (CR_MULT[d.crLvl] || 0.05);
  const minP   = mat + labor + cr + struct;
  const idealP = minP * (1 + d.margin / 100);
  document.getElementById('det-min').textContent       = fmt(minP);
  document.getElementById('det-min-iva').textContent   = fmt(minP * (1 + IVA));
  document.getElementById('det-ideal').textContent     = fmt(idealP);
  document.getElementById('det-ideal-iva').textContent = fmt(idealP * (1 + IVA));
}

function detSelCr(el, id) {
  if (!S._detDraft) return;
  document.querySelectorAll('.det-cr-opt').forEach(o => {
    o.classList.remove('sel');
    o.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('sel');
  el.setAttribute('aria-pressed', 'true');
  S._detDraft.crLvl = el.dataset.val;
  detRecalc(id);
}

function detSetMargin(btn, id) {
  if (!S._detDraft) return;
  document.querySelectorAll('#det-margin-btns .m-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  S._detDraft.margin = parseInt(btn.dataset.m);
  document.getElementById('det-margin-lbl').textContent = S._detDraft.margin;
  detRecalc(id);
}

function saveDetProduct(id) {
  if (_guardando) return;
  const idx = S.products.findIndex(p => p.id === id);
  if (idx < 0) return;
  // Sin cambios no se recalcula ni se escribe nada: volver a derivar minP
  // desde las partes ya redondeadas movía el precio ±$1-2 en cada guardado,
  // y "guardar" algo idéntico no es guardar.
  if (!detTieneCambios()) {
    toast('✓ Sin cambios que guardar');
    showView('view-products');
    return;
  }
  const p = S.products[idx];
  const mat    = parseMonto(document.getElementById('det-mat').value);
  const labor  = parseMonto(document.getElementById('det-labor').value);
  const struct = parseMonto(document.getElementById('det-struct').value);
  if (mat + labor + struct <= 0) { toast('Al menos un valor debe ser mayor a 0 🔢'); return; }
  // Recién aquí el borrador se vuelve definitivo.
  const d      = S._detDraft || { crLvl: p.crLvl, margin: p.margin };
  const crLvl  = VALID_CR_LVLS.includes(d.crLvl) ? d.crLvl : p.crLvl;
  const margin = MARGINS.includes(d.margin) ? d.margin : p.margin;
  const cr     = (mat + labor) * (CR_MULT[crLvl] || 0.05);
  const minP   = mat + labor + cr + struct;
  const idealP = minP * (1 + margin / 100);
  const descEl = document.getElementById('det-desc');
  const previo = p;
  S.products[idx] = {
    ...p,
    desc: descEl ? descEl.value.trim().slice(0, MAX_DESC_LEN) : (p.desc || ''),
    emoji: S._detEmoji == null ? (p.emoji || '') : S._detEmoji,
    crLvl, margin,
    mat:Math.round(mat), labor:Math.round(labor), struct:Math.round(struct),
    cr:Math.round(cr), minP:Math.round(minP), idealP:Math.round(idealP)
  };
  // El borrador solo se descarta si la escritura llegó a disco. Si falla, se
  // restaura el producto anterior: memoria y localStorage no pueden divergir,
  // y el aviso de "cambios sin guardar" debe seguir funcionando.
  if (!persistProducts()) { S.products[idx] = previo; return; }
  S._detDraft = null;
  S._detId    = null;
  renderHome();
  renderProducts();
  toast('✨ ¡Cambios guardados!');
  _guardando = true;
  setTimeout(() => { _guardando = false; showView('view-products'); }, 1400);
}

// ===================================================
// PERSISTENCIA
// ===================================================
// Guarda S.products en localStorage. Devuelve true en éxito.
// Muestra un toast claro si falla (cuota llena, Safari privado, etc.).
function persistProducts() {
  try {
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(S.products));
    return true;
  } catch (err) {
    const isQuota = err && (err.name === 'QuotaExceededError' || err.code === 22);
    toast(isQuota
      ? '⚠️ Sin espacio para guardar. Exporta un respaldo y borra productos antiguos.'
      : '⚠️ No se pudo guardar en este navegador. Exporta un respaldo para no perder tu trabajo.'
    );
    return false;
  }
}

// ===================================================
// BACKUP — EXPORT / IMPORT
// ===================================================
function exportData() {
  // Desde v2 el respaldo lleva el perfil de marca, desde v3 el valor hora y
  // desde v4 los costos fijos, así que vale la pena exportar aunque todavía no
  // haya productos.
  if (S.products.length === 0 && !studioHasBrand() && !S.rate && !S.fixed) {
    toast('⚠️ No hay productos para exportar');
    return;
  }
  const payload = {
    app: 'PrecioCrea',
    version: 4,
    exportDate: new Date().toLocaleDateString('es-CL'),
    products: S.products,
    // La marca GUARDADA: un nombre a medio teclear en el formulario no debe
    // colarse en un respaldo.
    brand: studioBrandPersisted(),
    rate: S.rate || null,
    fixed: S.fixed || null
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  a.href     = url;
  a.download = `preciocrea-respaldo-${date}.json`;
  // El <a> tiene que estar en el documento: fuera de él, algunos navegadores
  // ignoran el click() y el toast diría "descargado" sin haber descargado.
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revocar de inmediato aborta la descarga en algunos WebView de Android.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  // Marca que se respaldó para apagar el recordatorio
  try { localStorage.setItem(KEY_BACKUP, String(Date.now())); } catch(e) {}
  renderBackupReminder();
  toast('📤 Respaldo descargado');
}

// ===================================================
// RECORDATORIO DE RESPALDO
// ===================================================
// Devuelve {newCount, days, hasBackup} o null si no hay nada que recordar.
function getBackupState() {
  if (S.products.length === 0) return null;
  // Un navegador con el almacenamiento bloqueado lanza al leer, y esto corre
  // dentro de renderHome(): sin el try/catch el home se quedaría a medio pintar.
  let lastRaw = 0;
  try { lastRaw = parseInt(localStorage.getItem(KEY_BACKUP) || '0', 10) || 0; } catch(e) {}
  const hasBackup = lastRaw > 0;
  // Cuántos productos entraron a este dispositivo después del último respaldo.
  // Se mira `addedAt` y no el id: un producto importado conserva el id (y por
  // tanto la fecha) del dispositivo de origen, así que por id nunca contaría
  // como pendiente — justo cuando la creadora acaba de mudarse de teléfono y
  // más necesita respaldar.
  const newCount = S.products.filter(p => (Number(p.addedAt) || Number(p.id)) > lastRaw).length;
  if (newCount === 0) return null;
  const days = hasBackup ? Math.floor((Date.now() - lastRaw) / 86400000) : null;
  return { newCount, days, hasBackup };
}

function renderBackupReminder() {
  const el = document.getElementById('backup-reminder');
  if (!el) return;
  const state = getBackupState();
  if (!state) { el.classList.remove('show'); return; }

  const { newCount, days, hasBackup } = state;
  const msg = !hasBackup
    ? `Aún no has respaldado tus productos.`
    : (days >= 7
        ? `Llevas ${days} días sin respaldar y tienes ${newCount} producto/s nuevo/s.`
        : `Tienes ${newCount} producto/s sin respaldar.`);
  el.querySelector('.bk-rem-text').textContent = msg;
  // Solo destacar si pasaron 7+ días o son varios productos nuevos
  el.classList.toggle('urgent', (days !== null && days >= 7) || newCount >= 3);
  el.classList.add('show');
}

// Saneo un producto importado: descarta campos desconocidos, valida tipos
// y rangos, y reconstruye el objeto desde cero. Devuelve null si es inválido.
function sanitizeImportedProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const name = typeof raw.name === 'string'
    ? raw.name.trim().slice(0, MAX_NAME_LEN)
    : '';
  if (!name) return null;

  const safeNum = v => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };

  const marginNum = Number(raw.margin);
  const margin = MARGINS.includes(marginNum) ? marginNum : 50;
  const crLvl = VALID_CR_LVLS.includes(raw.crLvl) ? raw.crLvl : 'facil';

  const rawId = Number(raw.id);
  const id = Number.isFinite(rawId) && rawId > 0 ? rawId : nextProductId();

  // Cuándo entró el producto a ESTE dispositivo (lo usa el recordatorio de
  // respaldo). Un producto guardado antes de que existiera el campo cae al id,
  // que es su fecha de creación: mismo comportamiento que tenía.
  const rawAdded = Number(raw.addedAt);
  const addedAt = Number.isFinite(rawAdded) && rawAdded > 0 ? rawAdded : id;

  const date = typeof raw.date === 'string'
    ? raw.date.slice(0, MAX_DATE_LEN)
    : new Date().toLocaleDateString('es-CL');

  // Un respaldo v1 no trae `desc` ni `emoji` propio: se rellenan con el valor
  // por defecto en vez de descartar el producto.
  const desc = typeof raw.desc === 'string' ? raw.desc.trim().slice(0, MAX_DESC_LEN) : '';
  // Solo se acepta el emoji si es corto; si no viene, se infiere del nombre.
  const emoji = typeof raw.emoji === 'string' ? [...raw.emoji].slice(0, 2).join('') : getEmoji(name);

  return {
    id, addedAt, name, desc, emoji,
    date,
    mat:    safeNum(raw.mat),
    labor:  safeNum(raw.labor),
    cr:     safeNum(raw.cr),
    struct: safeNum(raw.struct),
    minP:   safeNum(raw.minP),
    idealP: safeNum(raw.idealP),
    margin, crLvl
  };
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > MAX_IMPORT_SIZE) {
    toast('❌ Archivo demasiado grande (máx. 1 MB)');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);

      // El perfil de marca se procesa ANTES que los productos: un respaldo que
      // solo trae marca (aún sin productos calculados) también debe servir.
      // Los respaldos v1 no traen `brand` y simplemente se saltan este paso.
      let brandImported = false;
      if (data && data.brand) {
        const b = studioSanitizeBrand(data.brand);
        if (b && b.name) { studioApplyImportedBrand(b); brandImported = true; }
      }

      // El valor hora entra igual: antes que los productos y tolerando los
      // respaldos v1 y v2, que no lo traen.
      let rateImported = false;
      if (data && data.rate) {
        const r = sanitizeRateProfile(data.rate);
        if (r) {
          S.rate = r;
          saveRate(r);
          renderRateSaved();
          renderRateRow();
          rateImported = true;
        }
      }

      let fixedImported = false;
      if (data && data.fixed) {
        const f = sanitizeFixedProfile(data.fixed);
        if (f) {
          S.fixed = f;
          saveFixed(f);
          renderFixedSaved();
          renderFixedRow();
          fixedImported = true;
        }
      }

      const rawList = Array.isArray(data) ? data : (data && Array.isArray(data.products) ? data.products : []);
      if (!rawList.length) {
        // Un respaldo sin productos puede traer igualmente la marca o el valor
        // hora, y en ese caso sí sirvió de algo.
        const traido = [
          brandImported && 'tu marca',
          rateImported  && 'tu valor hora',
          fixedImported && 'tus costos fijos'
        ].filter(Boolean);
        toast(traido.length
          ? `✅ Se importó ${traido.join(' y ')}`
          : '⚠️ El archivo no tiene productos');
        input.value=''; return;
      }

      const sanitized = rawList.map(sanitizeImportedProduct).filter(Boolean);
      if (!sanitized.length) {
        toast('⚠️ Ningún producto del archivo es válido');
        input.value = ''; return;
      }

      // La deduplicación va por id original: así reimportar el mismo respaldo
      // no duplica nada. Pero `addedAt` sí se refresca, porque respecto de este
      // teléfono estos productos son nuevos y aún no están respaldados aquí.
      const existingIds = new Set(S.products.map(p => p.id));
      const ahora = Date.now();
      const newOnes = sanitized
        .filter(p => !existingIds.has(p.id))
        .map(p => ({ ...p, addedAt: ahora }));
      if (!newOnes.length) {
        toast('ℹ️ Estos productos ya están guardados');
        input.value = ''; return;
      }

      // Reparar ids repetidos DENTRO del archivo, después de deduplicar contra
      // lo guardado. Dos productos sin id válido reciben ambos Date.now() del
      // mismo milisegundo en sanitizeImportedProduct: con ids gemelos, borrar
      // uno borraría los dos y el detalle abriría siempre el primero. Mismo
      // patrón que loadProducts().
      const usados = new Set(S.products.map(p => Number(p.id)));
      for (const p of newOnes) {
        if (usados.has(Number(p.id))) p.id = nextProductId(usados);
        usados.add(Number(p.id));
      }

      const antes = S.products;
      S.products = [...newOnes, ...S.products];
      // Si el almacenamiento falla hay que deshacer: dejarlos en memoria haría
      // creer que se importaron, y el siguiente arranque los perdería.
      if (!persistProducts()) { S.products = antes; input.value = ''; return; }
      renderHome();
      renderProducts();
      toast(`✅ ${newOnes.length} producto(s) importado/s`);
    } catch(err) {
      toast('❌ Archivo inválido');
    }
    input.value = '';
  };
  reader.onerror = () => {
    toast('❌ No se pudo leer el archivo');
    input.value = '';
  };
  reader.readAsText(file);
}

// ===================================================
// TOOLTIPS & HELP ACCORDION
// ===================================================
function toggleHelp(section) {
  section.classList.toggle('open');
  const hd = section.querySelector('.help-section-hd');
  if (hd) hd.setAttribute('aria-expanded', String(section.classList.contains('open')));
}

function toggleTip(id) {
  const box = document.getElementById(id);
  const open = box.classList.contains('open');
  document.querySelectorAll('.tip-box').forEach(b => b.classList.remove('open'));
  if (!open) box.classList.add('open');
}

// Close tips on outside click
document.addEventListener('click', e => {
  if (!e.target.classList.contains('tip-btn')) {
    document.querySelectorAll('.tip-box').forEach(b => b.classList.remove('open'));
  }
});

// Los "botones" que son <div data-action> (opciones de creatividad, acordeón
// de la guía, tarjetas de producto) responden a Enter y Espacio como un botón
// de verdad: el click() sintético entra por la delegación normal. Delegado,
// así cubre también los que se generan por innerHTML.
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target;
  if (el && el.getAttribute && el.getAttribute('role') === 'button'
      && el.tagName !== 'BUTTON' && el.tagName !== 'A') {
    e.preventDefault();
    el.click();
  }
});

// ===================================================
// HELPERS
// ===================================================

// Dinero en pesos chilenos: SIEMPRE enteros. Puntos y comas son separadores de
// miles, nunca decimales — "12.000" son doce mil pesos, no doce. Con parseFloat
// ese mismo texto valía 12 y el precio salía calculado sobre nada; y "12,000"
// directamente no parseaba. Se toman solo los dígitos y listo.
function parseMonto(val) {
  const digitos = String(val ?? '').replace(/\D/g, '');
  if (!digitos) return 0;
  return Math.min(parseInt(digitos.slice(0, 15), 10), MAX_INPUT_NUM);
}

// Horas y cantidades con decimales: acepta coma o punto ("2,5" y "2.5").
// En es-CL el separador decimal es la coma, y el <input type=number> la
// rechazaba en silencio: la creadora veía 2,5 escrito y la app leía 0.
function parseHoras(val) {
  const n = parseFloat(String(val ?? '').trim().replace(',', '.'));
  if (!isFinite(n) || isNaN(n) || n < 0) return 0;
  return Math.min(n, MAX_INPUT_NUM);
}

// Refleja un recorte de rango en el campo: si la fórmula va a usar 16 horas,
// la pantalla no puede seguir diciendo 24 — quien rehaga la cuenta a mano no
// llegaría al mismo número. Solo se pisa el campo cuando hubo recorte por
// arriba: corregir mientras se teclea un valor incompleto movería el cursor.
function reflejarRecorte(id, bruto, recortado) {
  if (bruto > recortado) {
    const el = document.getElementById(id);
    if (el) el.value = recortado;
  }
  return recortado;
}

function fmt(n) {
  return '$' + Math.round(n).toLocaleString('es-CL');
}

function fmtShort(n) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return '$' + Math.round(n/1000) + 'K';
  return '$' + Math.round(n);
}

// ===================================================
// ICONO DEL PRODUCTO
// ===================================================
// El icono se sugiere a partir del nombre, pero la creadora manda: puede
// elegir otro o quedarse sin ninguno. Por eso el producto guarda el emoji tal
// cual (cadena vacía = sin icono) y nunca se vuelve a inferir sobre lo elegido.

const ICON_CHOICES = [
  '🎨','🧶','🧼','🕯️','💎','💍','📿','👜','🧵','🪡',
  '🌿','🌸','🌻','🍃','✨','🎁','🎀','🖼️','🖌️','🪞',
  '☕','🍯','🍫','🧁','🥧','🫖','🧴','🧺','👗','🧣',
  '🧢','👛','🪅','🪆','🐚','🪵','🪴','🕊️','🦋','⭐'
];

let _iconTarget = null;   // 'inp-emoji' (calculadora) o 'det-emoji' (detalle)

function openIconPicker(btnId) {
  const overlay0 = document.getElementById('icon-overlay');
  // Doble toque en el botón: la segunda apertura registraría otro juego de
  // listeners sobre la misma parrilla y elegir un icono aplicaría dos veces.
  if (overlay0 && overlay0.classList.contains('show')) return;
  _iconTarget = btnId === 'inp-emoji-btn' ? 'calc' : 'det';
  const grid = document.getElementById('icon-grid');
  const actual = _iconTarget === 'calc' ? S.p.emoji : (S._detEmoji || '');
  const invocador = document.getElementById(btnId);

  grid.innerHTML = ICON_CHOICES.map(e => `
    <button type="button" class="icon-opt${e === actual ? ' sel' : ''}" data-e="${e}">${e}</button>
  `).join('');

  const overlay = document.getElementById('icon-overlay');
  const cerrar = () => {
    overlay.classList.remove('show');
    grid.removeEventListener('click', onPick);
    document.getElementById('icon-cancel').removeEventListener('click', cerrar);
    document.getElementById('icon-none').removeEventListener('click', onNone);
    overlay.removeEventListener('click', onBg);
    document.removeEventListener('keydown', onKey);
    _modalAbierto = null;
    if (invocador && document.contains(invocador)) invocador.focus();
  };
  _modalAbierto = cerrar;
  armarGuardia();
  const aplicar = (emoji) => { setProductIcon(emoji); cerrar(); };
  const onPick = (ev) => {
    const b = ev.target.closest('.icon-opt');
    if (b) aplicar(b.dataset.e);
  };
  const onNone = () => aplicar('');
  const onBg = (ev) => { if (ev.target === overlay) cerrar(); };
  const onKey = (ev) => { if (ev.key === 'Escape') cerrar(); };

  grid.addEventListener('click', onPick);
  document.getElementById('icon-cancel').addEventListener('click', cerrar);
  document.getElementById('icon-none').addEventListener('click', onNone);
  overlay.addEventListener('click', onBg);
  document.addEventListener('keydown', onKey);
  overlay.classList.add('show');
  // Mover el foco dentro del diálogo: el icono elegido (o el primero).
  const sel = grid.querySelector('.icon-opt.sel') || grid.querySelector('.icon-opt');
  if (sel) setTimeout(() => sel.focus(), 50);
}

// Pinta un icono en su botón. Sin icono se muestra un signo de suma tenue,
// para que el botón siga siendo obviamente pulsable.
function paintIconBtn(spanId, emoji) {
  const el = document.getElementById(spanId);
  if (!el) return;
  el.textContent = emoji || '＋';
  el.classList.toggle('empty', !emoji);
}

function setProductIcon(emoji) {
  if (_iconTarget === 'calc') {
    S.p.emoji = emoji;
    S.p.emojiManual = true;         // a partir de aquí el nombre ya no lo pisa
    paintIconBtn('inp-emoji', emoji);
  } else {
    S._detEmoji = emoji;
    paintIconBtn('det-emoji', emoji);
  }
}

// Mientras la creadora no haya tocado el icono, se va sugiriendo según el nombre.
function onNameInput() {
  if (S.p.emojiManual) return;
  const v = document.getElementById('inp-name').value;
  S.p.emoji = v.trim() ? getEmoji(v) : '';
  paintIconBtn('inp-emoji', S.p.emoji);
}

function getEmoji(name) {
  const n = (name||'').toLowerCase();
  if (n.includes('jabón')||n.includes('jabon')||n.includes('soap')) return '🧼';
  if (n.includes('aro')||n.includes('arete')||n.includes('earring')) return '💎';
  if (n.includes('anillo')||n.includes('ring')) return '💍';
  if (n.includes('vela')||n.includes('candle')) return '🕯️';
  if (n.includes('crochet')||n.includes('tejido')||n.includes('amigurumi')) return '🧶';
  if (n.includes('resina')||n.includes('resin')) return '✨';
  if (n.includes('crema')||n.includes('cosmet')||n.includes('perfume')||n.includes('aceite')) return '🌿';
  if (n.includes('bolso')||n.includes('cartera')||n.includes('bag')) return '👜';
  if (n.includes('pulsera')||n.includes('collar')) return '📿';
  if (n.includes('taza')||n.includes('mug')) return '☕';
  if (n.includes('cuadro')||n.includes('pintura')) return '🖼️';
  return '🎨';
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// Diálogo modal de confirmación. Devuelve Promise<boolean>.
// Sólo permite UN diálogo a la vez; si ya hay uno abierto, devuelve false.
let _confirmBusy = false;

// El cierre del modal visible, para que el botón Atrás pueda cancelarlo.
// Cada modal lo registra al abrirse y lo limpia al cerrarse; solo puede haber
// uno a la vez (los tres son overlays de pantalla completa).
let _modalAbierto = null;
function confirmDialog({ icon = '⚠️', title = '¿Confirmar?', message = '', confirmText = 'Aceptar', cancelText = 'Cancelar', dangerous = true } = {}) {
  return new Promise(resolve => {
    if (_confirmBusy) { resolve(false); return; }
    _confirmBusy = true;
    // Si algo revienta antes de armar el diálogo, el candado no puede quedar
    // echado para siempre: todos los diálogos posteriores devolverían false en
    // silencio y "Eliminar" dejaría de funcionar sin ninguna pista.
    try {
      const overlay = document.getElementById('modal-overlay');
      const btnOk   = document.getElementById('modal-confirm');
      const btnNo   = document.getElementById('modal-cancel');
      document.getElementById('modal-icon').textContent  = icon;
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-msg').textContent   = message;
      btnOk.textContent = confirmText;
      btnNo.textContent = cancelText;
      btnOk.classList.toggle('safe', !dangerous);

      // Para devolver el foco al cerrar: sin esto, tras cancelar con Escape el
      // foco queda perdido en el body y quien navega con teclado empieza de cero.
      const invocador = document.activeElement;

      const cleanup = (val) => {
        overlay.classList.remove('show');
        btnOk.removeEventListener('click', onOk);
        btnNo.removeEventListener('click', onNo);
        overlay.removeEventListener('click', onBgClick);
        document.removeEventListener('keydown', onKey);
        _confirmBusy = false;
        _modalAbierto = null;
        if (invocador && typeof invocador.focus === 'function' && document.contains(invocador)) {
          invocador.focus();
        }
        resolve(val);
      };
      _modalAbierto = () => cleanup(false);
      armarGuardia();
      const onOk = () => cleanup(true);
      const onNo = () => cleanup(false);
      const onBgClick = (e) => { if (e.target === overlay) cleanup(false); };
      // Escape cancela. Enter NO confirma a propósito: el foco arranca en
      // "Cancelar", así que quien pulsara Enter creyendo que activaba el botón
      // enfocado terminaba borrando el producto. El botón que tenga el foco ya
      // responde a Enter por su cuenta, y hace lo correcto.
      // Tab queda atrapado entre los dos botones: detrás del velo no hay nada
      // que enfocar y salir del diálogo con el teclado lo dejaba inoperante.
      const onKey = (e) => {
        if (e.key === 'Escape') { cleanup(false); return; }
        if (e.key === 'Tab') {
          e.preventDefault();
          (document.activeElement === btnNo ? btnOk : btnNo).focus();
        }
      };

      btnOk.addEventListener('click', onOk);
      btnNo.addEventListener('click', onNo);
      overlay.addEventListener('click', onBgClick);
      document.addEventListener('keydown', onKey);
      overlay.classList.add('show');
      // Pone el foco en cancelar por defecto (más seguro)
      setTimeout(() => btnNo.focus(), 50);
    } catch (err) {
      _confirmBusy = false;
      resolve(false);
    }
  });
}

// ===================================================
// PWA — Service Worker
// ===================================================
// BUILD-PORTABLE-STRIP-START
// Registra el SW desde ./sw.js. Cuando hay una versión nueva esperando,
// muestra el banner #update-banner para que la usuaria recargue.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Con quién llegó la página: si ya la controlaba un SW, un controllerchange
    // significa "versión nueva activada" y recargar es lo correcto. En la
    // primera visita el controller pasa de null al SW recién instalado
    // (clients.claim) y recargar ahí botaría a la usuaria a mitad de uso.
    const teniaController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.register('./sw.js').then(reg => {
      const showUpdateBanner = () => {
        const banner = document.getElementById('update-banner');
        if (banner) banner.classList.add('show');
      };
      if (reg.waiting) showUpdateBanner();
      reg.addEventListener('updatefound', () => {
        const incoming = reg.installing;
        if (!incoming) return;
        incoming.addEventListener('statechange', () => {
          if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });
      const btn = document.getElementById('update-reload');
      if (btn) btn.addEventListener('click', () => {
        // El SW en espera activa la versión nueva y el controllerchange de más
        // abajo recarga. Si por lo que sea ya no hay SW esperando (otra pestaña
        // lo activó), recargar directo cumple igual la promesa del botón.
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        else window.location.reload();
      });
    }).catch(() => {/* opcional, no es bloqueante */});

    // Cuando el SW nuevo toma control, recargar para servir la versión nueva.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!teniaController || reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
// BUILD-PORTABLE-STRIP-END

// ===================================================
// BOTÓN ATRÁS (Android / navegador)
// ===================================================
// Patrón de "entrada guardián": no se modela el historial completo — se
// mantiene UNA entrada extra en history y cada popstate (1) se re-arma y
// (2) despacha la misma acción de retroceso que harían el ← o Escape en el
// estado visible. Así las confirmaciones asíncronas funcionan sin pelear con
// history (el guardián ya está re-armado antes de preguntar), y los flujos
// que navegan a otra vista (applyRate → origen, guardados con setTimeout)
// no necesitan saber nada del historial.
//
// En Inicio sin nada abierto la acción es null: no se re-arma y el siguiente
// Atrás sale de la app, que es lo esperable en una PWA.
let _guardia = false;

function armarGuardia() {
  if (_guardia) return;
  // try/catch: en algún navegador sobre file:// pushState puede lanzar; el
  // botón Atrás es una mejora, nunca un motivo de crash.
  try { history.pushState({ pc: 1 }, ''); _guardia = true; } catch (e) {}
}

// La acción que ejecutaría "volver atrás" ahora mismo, o null si no hay nada
// que cerrar. El orden es el de las capas visuales: modal → bienvenida →
// sheet → pestaña.
function accionAtras() {
  if (_modalAbierto) return _modalAbierto;

  const welcome = document.getElementById('welcome');
  if (welcome && !welcome.hidden) return dismissWelcome;

  const RUTAS = {
    'view-calc':        navBack,                                // paso a paso
    'view-results':     () => showView('view-calc'),
    'view-detail':      () => showView('view-products'),
    'view-backup':      closeBackup,
    'view-help':        closeHelp,
    'view-rate':        closeRateWizard,
    'view-fixed':       closeFixedWizard,
    'view-studio-pick': () => showView('view-studio-hub'),
    'view-studio-edit': () => { if (typeof closeStudio === 'function') closeStudio(); }
  };
  const activa = vistaActiva();
  if (RUTAS[activa]) return RUTAS[activa];
  if (activa !== 'view-home') return () => showView('view-home');
  return null;
}

function initAtras() {
  try { history.replaceState({ pc: 0 }, ''); } catch (e) { return; }
  armarGuardia();
  window.addEventListener('popstate', () => {
    _guardia = false;
    const accion = accionAtras();
    if (!accion) return;
    armarGuardia();
    accion();
  });
}

// ===================================================
// REGISTRO DE ACCIONES (núcleo)
// ===================================================
// Los argumentos viajan en data-attributes; los controles que ya llevaban
// data-m / data-val / data-share / etc. se leen dentro de su propia función,
// así que su wrapper solo pasa el elemento.
Object.assign(ACCIONES, {
  // Navegación general
  goHome:      () => goHome(),
  showView:    el => showView(el.dataset.view),
  navBack:     () => navBack(),
  goStep:      el => goStep(Number(el.dataset.step)),
  openBackup:  () => openBackup(),
  closeBackup: () => closeBackup(),
  openHelp:    el => openHelp(el.dataset.section || undefined),
  closeHelp:   () => closeHelp(),
  toggleHelp:  el => toggleHelp(el.closest('.help-section')),
  toggleTip:   el => toggleTip(el.dataset.tip),
  // Reenvía el click a otro elemento (los <input type="file"> ocultos).
  clickTarget: el => {
    const t = document.getElementById(el.dataset.target);
    if (t) t.click();
  },

  // Bienvenida e instalación
  dismissWelcome:       () => dismissWelcome(),
  welcomeExample:       () => welcomeExample(),
  showWelcome:          () => showWelcome(),
  startCalcWithExample: () => startCalcWithExample(),
  handleInstallClick:   () => handleInstallClick(),
  hideInstallGuide:     () => hideInstallGuide(),

  // Calculadora y resultados
  startCalc:          () => startCalc(),
  addMat:             () => addMat(),
  remMat:             el => remMat(el),
  selCr:              el => selCr(el),
  showResults:        () => showResults(),
  setMargin:          el => setMargin(el),
  saveProduct:        () => saveProduct(),
  publishFromResults: () => publishFromResults(),
  openIconPicker:     el => openIconPicker(el.dataset.btn),

  // Productos y detalle
  showDetail:       el => showDetail(Number(el.dataset.id)),
  delProduct:       (el, ev) => delProduct(ev, Number(el.dataset.id)),
  openStudio:       el => openStudio(el.dataset.format || 'historia', Number(el.dataset.id)),
  duplicateProduct: el => duplicateProduct(Number(el.dataset.id)),
  shareWhatsApp:    el => shareWhatsApp(Number(el.dataset.id)),
  saveDetProduct:   el => saveDetProduct(Number(el.dataset.id)),
  detSelCr:         el => detSelCr(el, Number(el.dataset.id)),
  detSetMargin:     el => detSetMargin(el, Number(el.dataset.id)),
  clearSearch:      () => clearSearch(),

  // Asistentes
  openRateWizard:   el => openRateWizard(el.dataset.from),
  closeRateWizard:  () => closeRateWizard(),
  applyRate:        () => applyRate(),
  setRateMode:      el => setRateMode(el.dataset.mode),
  setRateShare:     el => setRateShare(Number(el.dataset.share)),
  setRateFocus:     el => setRateFocus(Number(el.dataset.focus)),
  setRateDays:      el => setRateDays(Number(el.dataset.days)),
  openFixedWizard:  el => openFixedWizard(el.dataset.from),
  closeFixedWizard: () => closeFixedWizard(),
  applyFixed:       () => applyFixed(),
  setFixedShare:    el => setFixedShare(Number(el.dataset.fshare)),

  // Respaldo
  exportData: () => exportData()
});

Object.assign(ENTRADAS, {
  filterProducts:     el => filterProducts(el.value),
  onNameInput:        () => onNameInput(),
  calcMatTotal:       () => calcMatTotal(),
  updateLaborPreview: () => updateLaborPreview(),
  rateRecalc:         () => rateRecalc(),
  fixedRecalc:        () => fixedRecalc(),
  detRecalc:          el => detRecalc(Number(el.dataset.id))
});

Object.assign(CAMBIOS, {
  rateRecalc: () => rateRecalc(),
  importData: el => importData(el)
});

// ===================================================
// ARRANQUE
// ===================================================
// Al final a propósito: todo lo declarado con let/const ya está evaluado y
// ninguna función puede pisar una zona muerta temporal (ver nota en INIT).
(function init() {
  S.products = loadProducts();
  S.rate     = loadRate();
  S.fixed    = loadFixed();
  // Antes que la bienvenida: showWelcome() arma la entrada guardián y el
  // replaceState de initAtras() debe correr sobre la entrada original.
  initAtras();
  renderHome();
  renderProducts();
  initWelcome();
  setupInstallPrompt();
})();

