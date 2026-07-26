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
const KEY_ONBOARD   = 'pc_onboarding_done';

// SVG inline de marcas (uso referencial, ver disclaimer en el footer)
const ICONS = {
  whatsapp: '<svg viewBox="0 0 24 24" class="brand-svg brand-wa" fill="currentColor" aria-hidden="true"><path d="M19.05 4.91A9.816 9.816 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01zm-7.01 15.24c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.264 8.264 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.183 8.183 0 0 1 2.41 5.83c.02 4.54-3.68 8.23-8.22 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.07-.11-.22-.16-.47-.28z"/></svg>',
  android:  '<svg viewBox="0 0 24 24" class="brand-svg brand-android" fill="currentColor" aria-hidden="true"><path d="M17.523 15.341c-.551 0-.999-.448-.999-1s.448-.999.999-.999c.551 0 .999.448.999.999 0 .552-.448 1-.999 1m-11.046 0c-.551 0-.999-.448-.999-1s.448-.999.999-.999c.551 0 .999.448.999.999 0 .552-.448 1-.999 1m11.405-6.02l1.997-3.459a.416.416 0 00-.152-.568.416.416 0 00-.568.152l-2.022 3.503C15.59 8.244 13.853 7.851 12 7.851s-3.59.393-5.137 1.099L4.841 5.447a.416.416 0 00-.568-.152.416.416 0 00-.152.568l1.997 3.459C2.689 11.187.343 14.659 0 18.761h24c-.343-4.102-2.689-7.574-6.118-9.44"/></svg>',
  apple:    '<svg viewBox="0 0 24 24" class="brand-svg brand-apple" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25"/></svg>'
};

// ===================================================
// INIT
// ===================================================
(function init() {
  try {
    const saved = localStorage.getItem(KEY_PRODUCTS);
    if (saved) S.products = JSON.parse(saved);
  } catch(e) {}
  renderHome();
  renderOnboarding();
  setupInstallPrompt();
})();

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

function setupInstallPrompt() {
  // Si la app ya está instalada (modo standalone), no hace falta el botón.
  if (isStandalone()) return;

  // Si es iOS, mostrar el botón con la guía manual.
  if (isIos()) {
    renderInstallButton();
  }

  // Android / desktop Chrome: esperar el evento del navegador.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    renderInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById('btn-install');
    if (btn) btn.classList.remove('show');
    toast('🎉 ¡App instalada!');
  });
}

function renderInstallButton() {
  const btn = document.getElementById('btn-install');
  if (!btn || isStandalone()) return;
  if (deferredInstallPrompt || isIos()) btn.classList.add('show');
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
    }).catch(() => {/* el usuario cerró el diálogo */});
  } else if (isIos()) {
    document.getElementById('ios-install-overlay').classList.add('show');
  }
}

function hideIosInstallGuide() {
  document.getElementById('ios-install-overlay').classList.remove('show');
}

// ===================================================
// VIEWS
// ===================================================
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}

// ===================================================
// HOME
// ===================================================
function renderHome() {
  const list = document.getElementById('products-list');
  const statsRow = document.getElementById('stats-row');
  const listTitle = document.getElementById('list-title');

  const studioCard = document.getElementById('studio-card');

  if (S.products.length === 0) {
    statsRow.style.display = 'none';
    listTitle.style.display = 'none';
    if (studioCard) studioCard.style.display = 'none';
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌱</div>
        <p>Aún no tienes productos guardados.<br>¡Calcula el precio de tu primera creación!</p>
      </div>`;
    return;
  }

  statsRow.style.display = 'grid';
  listTitle.style.display = 'block';
  if (studioCard) studioCard.style.display = 'block';
  document.getElementById('stat-count').textContent = S.products.length;
  const avg = S.products.reduce((s,p) => s + p.idealP, 0) / S.products.length;
  document.getElementById('stat-avg').textContent = fmtShort(avg);

  list.innerHTML = S.products.map(p => `
    <div class="product-card" onclick="showDetail(${p.id})">
      ${p.emoji ? `<div class="pc-emoji">${p.emoji}</div>` : ''}
      <div class="pc-info">
        <div class="pc-name">${esc(p.name)}</div>
        ${p.desc ? `<div class="pc-desc">${esc(p.desc)}</div>` : ''}
        <div class="pc-prices">Ideal: <strong>${fmt(p.idealP)}</strong><span class="iva-inline"> · c/IVA: <strong>${fmt(p.idealP*(1+IVA))}</strong></span></div>
      </div>
      <div class="pc-actions">
        <button class="pc-edit" onclick="showDetail(event,${p.id})" title="Editar">✏️</button>
        <button class="pc-delete" onclick="delProduct(event,${p.id})" title="Eliminar">🗑️</button>
      </div>
    </div>`).join('');

  renderBackupReminder();
}

// ===================================================
// ONBOARDING
// ===================================================
function renderOnboarding() {
  const card = document.getElementById('onboard-card');
  if (!card) return;
  let done = false;
  try { done = localStorage.getItem(KEY_ONBOARD) === '1'; } catch(e) {}
  card.classList.toggle('show', !done);
}

function dismissOnboarding() {
  try { localStorage.setItem(KEY_ONBOARD, '1'); } catch(e) {}
  renderOnboarding();
}

// Empieza la calculadora con un ejemplo pre-rellenado (jabón de lavanda).
function startCalcWithExample() {
  dismissOnboarding();
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
  const p = S.products.find(x => x.id === id);
  if (!p) return;
  const copy = {
    ...p,
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: `${p.name} (copia)`.slice(0, MAX_NAME_LEN),
    date: new Date().toLocaleDateString('es-CL')
  };
  S.products.unshift(copy);
  if (!persistProducts()) return;
  toast('📋 Producto duplicado');
  setTimeout(() => { renderHome(); showView('view-home'); }, 700);
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
  q('inp-rate').value = '';
  q('inp-fixed').value = '';
  q('inp-units').value = '20';
  q('labor-preview').style.display = 'none';
  q('mat-total').textContent = '$0';
  q('mat-list').innerHTML = `
    <div class="mat-row">
      <input class="field-input mat-name" type="text" placeholder="ej: Aceite de coco" maxlength="60" autocomplete="off" style="--step-accent:var(--coral)">
      <input class="field-input mat-cost" type="number" placeholder="$" min="0" max="99999999" inputmode="numeric" oninput="calcMatTotal()" style="--step-accent:var(--coral)">
      <button class="btn-rem" onclick="remMat(this)">✕</button>
    </div>`;

  // Reset creativity
  document.querySelectorAll('.cr-option').forEach(o => o.classList.remove('sel'));
  document.querySelector('[data-val="facil"]').classList.add('sel');

  // Reset margin buttons
  document.querySelectorAll('.m-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-m="50"]').classList.add('active');
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
    const hasValidMat = costs.some(i => sanitizeNum(i.value) > 0);
    if (!hasValidMat) { toast('Ingresa el costo de al menos un material 🧺'); return; }
    S.p.matTotal = getMatTotal();
  }
  if (n === 3) {
    const h = sanitizeNum(document.getElementById('inp-hours').value);
    const r = sanitizeNum(document.getElementById('inp-rate').value);
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

function updateProg(n) {
  document.getElementById('prog-label').textContent = `Paso ${n} de 4`;
  for (let i = 1; i <= 4; i++) {
    const d = document.getElementById(`pd${i}`);
    d.className = 'pdot';
    if (i === n) d.classList.add('active');
    else if (i < n) d.classList.add('done');
  }
}

// ===================================================
// MATERIALS
// ===================================================
function addMat() {
  const list = document.getElementById('mat-list');
  const row = document.createElement('div');
  row.className = 'mat-row';
  row.innerHTML = `
    <input class="field-input mat-name" type="text" placeholder="ej: Fragancia" maxlength="60" autocomplete="off" style="--step-accent:var(--coral)">
    <input class="field-input mat-cost" type="number" placeholder="$" min="0" max="99999999" inputmode="numeric" oninput="calcMatTotal()" style="--step-accent:var(--coral)">
    <button class="btn-rem" onclick="remMat(this)">✕</button>`;
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
    .reduce((s, i) => s + sanitizeNum(i.value), 0);
}

function calcMatTotal() {
  // Also clamp the input itself to prevent negatives showing
  document.querySelectorAll('.mat-cost').forEach(i => {
    if (parseFloat(i.value) < 0) i.value = 0;
  });
  document.getElementById('mat-total').textContent = fmt(getMatTotal());
}

// ===================================================
// LABOR PREVIEW
// ===================================================
function updateLaborPreview() {
  const h = parseFloat(document.getElementById('inp-hours').value)||0;
  const r = parseFloat(document.getElementById('inp-rate').value)||0;
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
  document.querySelectorAll('.cr-option').forEach(o => o.classList.remove('sel'));
  el.classList.add('sel');
  S.p.cr = el.dataset.val;
}

// ===================================================
// RESULTS
// ===================================================
function showResults() {
  const fixed = sanitizeNum(document.getElementById('inp-fixed').value);
  const units = sanitizeNum(document.getElementById('inp-units').value);
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
  document.getElementById('confetti-emoji').textContent = getEmoji(S.p.name);

  renderBars(r);
  renderWisdom(r);
}

function renderBars(r) {
  const bars = [
    { e:'🧺', lbl:'Materiales',    val:r.mat,    c:'#FF6B6B' },
    { e:'⏰', lbl:'Tu tiempo',      val:r.labor,  c:'#4D96FF' },
    { e:'🎨', lbl:'Creatividad',    val:r.cr,     c:'#C77DFF' },
    { e:'🏠', lbl:'Costos fijos',   val:r.struct, c:'#6BCB77' },
  ];
  const minP = r.minP;
  document.getElementById('bar-items').innerHTML = bars.map(b => {
    const pct = minP > 0 ? (b.val / minP * 100).toFixed(1) : 0;
    return `
      <div class="bar-item">
        <div class="bar-header">
          <div class="bar-lbl"><span class="bar-lbl-emoji">${b.e}</span>${b.lbl}</div>
          <div class="bar-val">${fmt(b.val)} (${pct}%)</div>
        </div>
        <div class="bar-track">
          <div class="bar-fill" data-w="${pct}" style="background:${b.c}; width:0"></div>
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
  document.querySelectorAll('.m-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  S.p.margin = parseInt(btn.dataset.m);
  const r = calc();
  document.getElementById('res-ideal').textContent     = fmt(r.idealP);
  document.getElementById('res-ideal-iva').textContent = fmt(r.idealP * (1 + IVA));
}

// ===================================================
// SAVE
// ===================================================
function saveProduct() {
  const r = calc();
  const prod = {
    id:     Date.now(),
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
  if (!persistProducts()) return;
  renderHome();
  toast('✨ ¡Producto guardado!');
  setTimeout(() => showView('view-home'), 1400);
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
    S.products = S.products.filter(p => p.id !== id);
    if (!persistProducts()) return;
    renderHome();
    toast('🗑️ Producto eliminado');
  });
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
  document.getElementById('det-title').textContent = p.name;

  const crOpts = [
    { val:'facil',    e:'😊', lbl:'Fácil' },
    { val:'moderado', e:'🤔', lbl:'Mod.' },
    { val:'intenso',  e:'🔥', lbl:'Intenso' },
    { val:'obra',     e:'🏆', lbl:'Autor' },
  ];
  const crGrid = crOpts.map(o => `
    <div class="det-cr-opt${p.crLvl===o.val?' sel':''}" data-val="${o.val}" onclick="detSelCr(this,${realId})">
      <div class="dco-emoji">${o.e}</div>
      <div class="dco-lbl">${o.lbl}</div>
    </div>`).join('');

  const marginBtns = MARGINS.map(m => `
    <button class="m-btn${p.margin===m?' active':''}" data-m="${m}" onclick="detSetMargin(this,${realId})">${m}%<br><small>${m===30?'Básico':m===50?'Sugerido':m===80?'Autor':'Premium'}</small></button>`
  ).join('');

  // El icono del detalle es editable; se guarda en S._detEmoji hasta que la
  // creadora pulse "Guardar cambios".
  S._detEmoji = p.emoji || '';

  document.getElementById('det-body').innerHTML = `
    <div class="detail-emoji-wrap">
      <button type="button" class="icon-picker-btn big" onclick="openIconPicker('det-emoji-btn')"
              id="det-emoji-btn" title="Cambiar el icono">
        <span class="icon-picker-glyph${p.emoji ? '' : ' empty'}" id="det-emoji">${p.emoji || '＋'}</span>
      </button>
    </div>
    <div class="detail-pname" id="det-pname">${esc(p.name)}</div>
    <div class="detail-date">Guardado el ${p.date}</div>

    <!-- PRICES -->
    <div class="price-duo" style="padding:0; margin-bottom:20px">
      <div class="price-box price-box-floor">
        <div class="pb-tag">Precio Mínimo</div>
        <div class="pb-val" id="det-min">${fmt(p.minP)}</div>
        <div class="iva-row">
          <span class="iva-val" id="det-min-iva">${fmt(p.minP* (1 + IVA))}</span>
          <span class="iva-badge">c/IVA</span>
        </div>
        <div class="pb-note" style="color:var(--muted); margin-top:5px">Tu suelo</div>
      </div>
      <div class="price-box price-box-ideal">
        <div class="pb-tag">Precio Ideal</div>
        <div class="pb-val" id="det-ideal">${fmt(p.idealP)}</div>
        <div class="iva-row">
          <span class="iva-val" id="det-ideal-iva">${fmt(p.idealP* (1 + IVA))}</span>
          <span class="iva-badge">c/IVA</span>
        </div>
        <div class="pb-note" style="margin-top:5px">Margen <span id="det-margin-lbl">${p.margin}</span>%</div>
      </div>
    </div>

    <!-- MARGEN -->
    <div class="margin-section" style="padding:0; margin-bottom:20px">
      <div class="margin-lbl">📈 Ajustar margen de ganancia</div>
      <div class="margin-btns" id="det-margin-btns">${marginBtns}</div>
    </div>

    <!-- DESCRIPCIÓN -->
    <div class="det-edit-section" style="margin-bottom:16px">
      <div class="det-edit-title">📝 Descripción</div>
      <p class="det-edit-hint">Es la que aparece en tus publicaciones.</p>
      <textarea class="field-input field-textarea" id="det-desc" rows="2" maxlength="${MAX_DESC_LEN}"
                placeholder="ej: Hecho a mano con lavanda de Colchagua">${esc(p.desc || '')}</textarea>
    </div>

    <!-- EDITAR COMPOSICIÓN -->
    <div class="det-edit-section">
      <div class="det-edit-title">✏️ Editar composición del precio</div>

      <div class="det-field-row">
        <div class="det-field-lbl">🧺 Materiales</div>
        <input class="det-field-input" type="number" id="det-mat" value="${p.mat}" min="0" max="99999999" inputmode="numeric" oninput="detRecalc(${realId})">
      </div>
      <div class="det-field-row">
        <div class="det-field-lbl">⏰ Tu tiempo</div>
        <input class="det-field-input" type="number" id="det-labor" value="${p.labor}" min="0" max="99999999" inputmode="numeric" oninput="detRecalc(${realId})">
      </div>
      <div class="det-field-row">
        <div class="det-field-lbl">🏠 Costos fijos</div>
        <input class="det-field-input" type="number" id="det-struct" value="${p.struct}" min="0" max="99999999" inputmode="numeric" oninput="detRecalc(${realId})">
      </div>

      <div class="field-label" style="margin-top:14px; margin-bottom:10px">🎨 Carga creativa</div>
      <div class="det-cr-grid" id="det-cr-grid">${crGrid}</div>
    </div>

    <!-- SAVE + ACCIONES -->
    <div style="padding-bottom:12px">
      <button class="btn-det-save" onclick="saveDetProduct(${realId})">💾 Guardar cambios</button>
      <div class="det-secondary-actions">
        <button class="btn-det-secondary btn-whatsapp" onclick="shareWhatsApp(${realId})">${ICONS.whatsapp}<span>WhatsApp</span></button>
        <button class="btn-det-secondary" onclick="duplicateProduct(${realId})">📋 Duplicar</button>
        <button class="btn-det-secondary btn-studio" onclick="openStudio('historia',${realId})">📸 Publicar</button>
      </div>
      <button class="btn-new-calc" onclick="showView('view-home')" style="width:100%">← Volver al inicio</button>
    </div>`;

  showView('view-detail');
}

function detRecalc(id) {
  const p = S.products.find(p => p.id === id);
  if (!p) return;
  const mat    = sanitizeNum(document.getElementById('det-mat').value);
  const labor  = sanitizeNum(document.getElementById('det-labor').value);
  const struct = sanitizeNum(document.getElementById('det-struct').value);
  const cr     = (mat + labor) * (CR_MULT[p.crLvl] || 0.05);
  const minP   = mat + labor + cr + struct;
  const idealP = minP * (1 + p.margin / 100);
  document.getElementById('det-min').textContent       = fmt(minP);
  document.getElementById('det-min-iva').textContent   = fmt(minP * (1 + IVA));
  document.getElementById('det-ideal').textContent     = fmt(idealP);
  document.getElementById('det-ideal-iva').textContent = fmt(idealP * (1 + IVA));
}

function detSelCr(el, id) {
  document.querySelectorAll('.det-cr-opt').forEach(o => o.classList.remove('sel'));
  el.classList.add('sel');
  const p = S.products.find(p => p.id === id);
  if (p) { p.crLvl = el.dataset.val; detRecalc(id); }
}

function detSetMargin(btn, id) {
  document.querySelectorAll('#det-margin-btns .m-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const p = S.products.find(p => p.id === id);
  if (!p) return;
  p.margin = parseInt(btn.dataset.m);
  document.getElementById('det-margin-lbl').textContent = p.margin;
  detRecalc(id);
}

function saveDetProduct(id) {
  const idx = S.products.findIndex(p => p.id === id);
  if (idx < 0) return;
  const p = S.products[idx];
  const mat    = sanitizeNum(document.getElementById('det-mat').value);
  const labor  = sanitizeNum(document.getElementById('det-labor').value);
  const struct = sanitizeNum(document.getElementById('det-struct').value);
  if (mat + labor + struct <= 0) { toast('Al menos un valor debe ser mayor a 0 🔢'); return; }
  const cr     = (mat + labor) * (CR_MULT[p.crLvl] || 0.05);
  const minP   = mat + labor + cr + struct;
  const idealP = minP * (1 + p.margin / 100);
  const descEl = document.getElementById('det-desc');
  S.products[idx] = {
    ...p,
    desc: descEl ? descEl.value.trim().slice(0, MAX_DESC_LEN) : (p.desc || ''),
    emoji: S._detEmoji == null ? (p.emoji || '') : S._detEmoji,
    mat:Math.round(mat), labor:Math.round(labor), struct:Math.round(struct),
    cr:Math.round(cr), minP:Math.round(minP), idealP:Math.round(idealP)
  };
  if (!persistProducts()) return;
  renderHome();
  toast('✨ ¡Cambios guardados!');
  setTimeout(() => showView('view-home'), 1400);
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
  // Desde v2 el respaldo también lleva el perfil de marca, así que vale la
  // pena exportar aunque todavía no haya productos guardados.
  if (S.products.length === 0 && !studioHasBrand()) {
    toast('⚠️ No hay productos para exportar');
    return;
  }
  const payload = {
    app: 'PrecioCrea',
    version: 2,
    exportDate: new Date().toLocaleDateString('es-CL'),
    products: S.products,
    brand: studioBrandOrDefault()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  a.href     = url;
  a.download = `preciocrea-respaldo-${date}.json`;
  a.click();
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
  const lastRaw = parseInt(localStorage.getItem(KEY_BACKUP) || '0', 10);
  const hasBackup = lastRaw > 0;
  // Cuántos productos se crearon después del último respaldo
  const newCount = S.products.filter(p => Number(p.id) > lastRaw).length;
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
  const id = Number.isFinite(rawId) && rawId > 0 ? rawId : (Date.now() + Math.floor(Math.random() * 1000));

  const date = typeof raw.date === 'string'
    ? raw.date.slice(0, MAX_DATE_LEN)
    : new Date().toLocaleDateString('es-CL');

  // Un respaldo v1 no trae `desc` ni `emoji` propio: se rellenan con el valor
  // por defecto en vez de descartar el producto.
  const desc = typeof raw.desc === 'string' ? raw.desc.trim().slice(0, MAX_DESC_LEN) : '';
  // Solo se acepta el emoji si es corto; si no viene, se infiere del nombre.
  const emoji = typeof raw.emoji === 'string' ? [...raw.emoji].slice(0, 2).join('') : getEmoji(name);

  return {
    id, name, desc, emoji,
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

      const rawList = Array.isArray(data) ? data : (data && Array.isArray(data.products) ? data.products : []);
      if (!rawList.length) {
        toast(brandImported ? '🎨 Se importaron los datos de tu marca' : '⚠️ El archivo no tiene productos');
        input.value=''; return;
      }

      const sanitized = rawList.map(sanitizeImportedProduct).filter(Boolean);
      if (!sanitized.length) {
        toast('⚠️ Ningún producto del archivo es válido');
        input.value = ''; return;
      }

      const existingIds = new Set(S.products.map(p => p.id));
      const newOnes = sanitized.filter(p => !existingIds.has(p.id));
      if (!newOnes.length) {
        toast('ℹ️ Estos productos ya están guardados');
        input.value = ''; return;
      }

      S.products = [...newOnes, ...S.products];
      if (!persistProducts()) { input.value = ''; return; }
      renderHome();
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

// ===================================================
// HELPERS
// ===================================================

// Devuelve un número finito no negativo, capado a MAX_INPUT_NUM.
// Cualquier entrada inválida (NaN, Infinity, negativo, no numérico) → 0.
function sanitizeNum(val) {
  const n = parseFloat(val);
  if (!isFinite(n) || isNaN(n) || n < 0) return 0;
  return Math.min(n, MAX_INPUT_NUM);
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
  _iconTarget = btnId === 'inp-emoji-btn' ? 'calc' : 'det';
  const grid = document.getElementById('icon-grid');
  const actual = _iconTarget === 'calc' ? S.p.emoji : (S._detEmoji || '');

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
  };
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
function confirmDialog({ icon = '⚠️', title = '¿Confirmar?', message = '', confirmText = 'Aceptar', cancelText = 'Cancelar', dangerous = true } = {}) {
  return new Promise(resolve => {
    if (_confirmBusy) { resolve(false); return; }
    _confirmBusy = true;
    const overlay = document.getElementById('modal-overlay');
    const btnOk   = document.getElementById('modal-confirm');
    const btnNo   = document.getElementById('modal-cancel');
    document.getElementById('modal-icon').textContent  = icon;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-msg').textContent   = message;
    btnOk.textContent = confirmText;
    btnNo.textContent = cancelText;
    btnOk.classList.toggle('safe', !dangerous);

    const cleanup = (val) => {
      overlay.classList.remove('show');
      btnOk.removeEventListener('click', onOk);
      btnNo.removeEventListener('click', onNo);
      overlay.removeEventListener('click', onBgClick);
      document.removeEventListener('keydown', onKey);
      _confirmBusy = false;
      resolve(val);
    };
    const onOk = () => cleanup(true);
    const onNo = () => cleanup(false);
    const onBgClick = (e) => { if (e.target === overlay) cleanup(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter')  cleanup(true);
    };

    btnOk.addEventListener('click', onOk);
    btnNo.addEventListener('click', onNo);
    overlay.addEventListener('click', onBgClick);
    document.addEventListener('keydown', onKey);
    overlay.classList.add('show');
    // Pone el foco en cancelar por defecto (más seguro)
    setTimeout(() => btnNo.focus(), 50);
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
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      });
    }).catch(() => {/* opcional, no es bloqueante */});

    // Cuando el SW nuevo toma control, recargar para servir la versión nueva.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
// BUILD-PORTABLE-STRIP-END

