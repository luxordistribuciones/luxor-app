// =============================================
//  LUXOR DISTRIBUCIONES — PWA App Logic
// =============================================

const CACHE_KEY      = 'luxor_products_v1';
const CACHE_TIME_KEY = 'luxor_cache_time';
const SCRIPT_URL_KEY = 'luxor_script_url';
const PER_PAGE       = 30;

const state = {
  products: [],
  filtered: [],
  providers: [],
  filter: 'todos',
  query: '',
  page: 1,
  syncing: false
};

// ---- LocalStorage helpers ----
const getScriptUrl  = () => localStorage.getItem(SCRIPT_URL_KEY);
const saveScriptUrl = (u) => localStorage.setItem(SCRIPT_URL_KEY, u);

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
  } catch(e) { console.warn('Cache write failed', e); }
}

function loadCache() {
  try {
    const s = localStorage.getItem(CACHE_KEY);
    return s ? JSON.parse(s) : null;
  } catch(e) { return null; }
}

function cacheAgeMs() {
  const t = localStorage.getItem(CACHE_TIME_KEY);
  return t ? Date.now() - parseInt(t) : Infinity;
}

function cacheAgeLabel() {
  const ms = cacheAgeMs();
  if (ms === Infinity) return '';
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `Actualizado hace ${d}d`;
  if (h > 0) return `Actualizado hace ${h}h`;
  if (m > 0) return `Actualizado hace ${m}m`;
  return 'Actualizado ahora';
}

// ---- Data fetch ----
async function fetchFromScript() {
  const url = getScriptUrl();
  if (!url) throw new Error('URL no configurada');
  const res = await fetch(`${url}?action=getData`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error('Datos inválidos');
  return json;
}

async function syncData(feedback = true) {
  if (state.syncing) return;
  state.syncing = true;

  const btn = document.getElementById('sync-btn');
  const lbl = document.getElementById('sync-status');
  btn.classList.add('spinning');
  if (feedback) lbl.textContent = 'Sincronizando…';

  try {
    const data = await fetchFromScript();
    state.products = data;
    saveCache(data);
    buildProviders();
    applyFilters();
    if (feedback) {
      lbl.textContent = '✓ Listo';
      setTimeout(() => lbl.textContent = cacheAgeLabel(), 2500);
    }
  } catch(err) {
    console.error(err);
    if (feedback) {
      lbl.textContent = '✗ Error al sincronizar';
      setTimeout(() => lbl.textContent = cacheAgeLabel(), 3000);
    }
  } finally {
    state.syncing = false;
    btn.classList.remove('spinning');
  }
}

// ---- Providers ----
function buildProviders() {
  const set = new Set();
  state.products.forEach(p => { const v = (p[3]||'').trim(); if(v) set.add(v); });
  state.providers = Array.from(set).sort();
  renderFilters();
}

// ---- Filtering ----
function applyFilters() {
  let r = state.products;
  if (state.filter !== 'todos') r = r.filter(p => (p[3]||'').trim() === state.filter);
  if (state.query) {
    const q = state.query.toLowerCase();
    r = r.filter(p =>
      (p[1]||'').toLowerCase().includes(q) ||
      (p[2]||'').toLowerCase().includes(q) ||
      (p[0]||'').toLowerCase().includes(q)
    );
  }
  state.filtered = r;
  state.page = 1;
  renderProducts();
  renderPagination();
  renderStats();
}

// ---- Escape HTML ----
function esc(t) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(t)));
  return d.innerHTML;
}

// ---- Render filters ----
function renderFilters() {
  const el = document.getElementById('filter-pills');
  const all = ['todos', ...state.providers];
  el.innerHTML = all.map(f => `
    <button class="filter-pill${state.filter === f ? ' active' : ''}" data-f="${esc(f)}">
      ${f === 'todos' ? 'Todos' : esc(f)}
    </button>`).join('');
  el.querySelectorAll('.filter-pill').forEach(b => {
    b.addEventListener('click', () => {
      state.filter = b.dataset.f;
      renderFilters();
      applyFilters();
    });
  });
}

// ---- Render products ----
function renderProducts() {
  const el = document.getElementById('product-list');
  if (!state.filtered.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-ico">🔍</div>
      <p>Sin resultados</p>
      <span>Probá con otra búsqueda o filtro</span>
    </div>`;
    return;
  }
  const start = (state.page - 1) * PER_PAGE;
  const items = state.filtered.slice(start, start + PER_PAGE);
  el.innerHTML = items.map((item, i) => `
    <div class="product-card" style="animation-delay:${i * 18}ms">
      <div class="product-main">
        <div class="product-desc">${esc(item[1] || 'Sin descripción')}</div>
        ${item[2] ? `<div class="product-code">Cód: ${esc(item[2])}</div>` : ''}
      </div>
      <div class="product-right">
        <div class="product-price">${esc(item[0] || '')}</div>
        ${item[3] ? `<div class="product-prov">${esc((item[3]||'').trim())}</div>` : ''}
      </div>
    </div>`).join('');
}

// ---- Render pagination ----
function renderPagination() {
  const el = document.getElementById('pagination');
  const total = state.filtered.length;
  const pages = Math.ceil(total / PER_PAGE);
  if (pages <= 1) { el.innerHTML = ''; return; }

  const cur = state.page;
  let nums = [];
  if (pages <= 7) {
    nums = Array.from({length: pages}, (_, i) => i + 1);
  } else {
    nums = [1];
    if (cur > 3) nums.push('…');
    for (let i = Math.max(2, cur-1); i <= Math.min(pages-1, cur+1); i++) nums.push(i);
    if (cur < pages-2) nums.push('…');
    nums.push(pages);
  }

  el.innerHTML = `
    <div class="pg-inner">
      <button class="pg-btn${cur===1?' disabled':''}" data-p="${cur-1}" ${cur===1?'disabled':''}>‹</button>
      ${nums.map(n => n==='…'
        ? `<span class="pg-ellipsis">…</span>`
        : `<button class="pg-btn${n===cur?' active':''}" data-p="${n}">${n}</button>`
      ).join('')}
      <button class="pg-btn${cur===pages?' disabled':''}" data-p="${cur+1}" ${cur===pages?'disabled':''}>›</button>
    </div>
    <div class="pg-info">Página ${cur} de ${pages}</div>`;

  el.querySelectorAll('.pg-btn:not(.disabled)').forEach(b => {
    b.addEventListener('click', () => {
      const p = parseInt(b.dataset.p);
      if (p >= 1 && p <= pages && p !== state.page) {
        state.page = p;
        renderProducts();
        renderPagination();
        document.getElementById('product-list').scrollTop = 0;
      }
    });
  });
}

// ---- Render stats ----
function renderStats() {
  const el = document.getElementById('stats-text');
  const f = state.filtered.length, t = state.products.length;
  el.textContent = (state.query || state.filter !== 'todos')
    ? `${f} de ${t} productos`
    : `${t} productos`;
}

// ---- Online status ----
function updateOnline() {
  const b = document.getElementById('offline-banner');
  if (b) b.classList.toggle('hidden', navigator.onLine);
}

// ---- Debounce ----
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---- Setup screen ----
function showSetup() {
  document.getElementById('splash').classList.add('hidden');
  document.getElementById('setup-screen').classList.remove('hidden');
}

function showApp() {
  document.getElementById('splash').classList.add('hidden');
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

async function handleSave() {
  const input = document.getElementById('script-url-input');
  const errEl = document.getElementById('setup-error');
  const btn   = document.getElementById('save-config-btn');
  const url   = input.value.trim();

  errEl.classList.add('hidden');

  if (!url) { showErr('Por favor ingresá la URL del script'); return; }
  if (!url.includes('script.google.com')) { showErr('La URL debe ser de Google Apps Script (script.google.com/macros...)'); return; }

  btn.disabled = true;
  btn.textContent = 'Conectando…';
  saveScriptUrl(url);

  try {
    const data = await fetchFromScript();
    state.products = data;
    saveCache(data);
    buildProviders();
    applyFilters();
    showApp();
    setupListeners();
    updateOnline();
    document.getElementById('sync-status').textContent = cacheAgeLabel();
  } catch(err) {
    localStorage.removeItem(SCRIPT_URL_KEY);
    showErr(`No se pudo conectar: ${err.message}. Verificá la URL.`);
    btn.disabled = false;
    btn.textContent = 'Guardar y conectar';
  }

  function showErr(msg) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
}

// ---- Event listeners (main app) ----
function setupListeners() {
  const si = document.getElementById('search-input');
  const cl = document.getElementById('clear-search');
  const ds = debounce(() => {
    state.query = si.value.trim();
    cl.classList.toggle('hidden', !state.query);
    applyFilters();
  }, 280);
  si.addEventListener('input', ds);
  cl.addEventListener('click', () => {
    si.value = ''; state.query = '';
    cl.classList.add('hidden');
    applyFilters(); si.focus();
  });

  document.getElementById('sync-btn').addEventListener('click', () => {
    if (navigator.onLine) {
      syncData(true);
    } else {
      document.getElementById('sync-status').textContent = 'Sin conexión';
      setTimeout(() => document.getElementById('sync-status').textContent = cacheAgeLabel(), 2000);
    }
  });

  window.addEventListener('online',  updateOnline);
  window.addEventListener('offline', updateOnline);

  setInterval(() => {
    const el = document.getElementById('sync-status');
    if (el && !state.syncing) el.textContent = cacheAgeLabel();
  }, 60000);
}

// ---- Skeleton loading ----
function showSkeleton() {
  const el = document.getElementById('product-list');
  el.innerHTML = Array(8).fill('<div class="skeleton"></div>').join('');
}

// ---- Service worker ----
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(r => console.log('SW ok:', r.scope))
      .catch(e => console.warn('SW fail:', e));
  }
}

// ---- INIT ----
async function init() {
  registerSW();

  // Wait for splash animation
  await new Promise(r => setTimeout(r, 1500));

  const scriptUrl = getScriptUrl();

  if (!scriptUrl) {
    showSetup();
    document.getElementById('save-config-btn').addEventListener('click', handleSave);
    document.getElementById('script-url-input').addEventListener('keypress', e => {
      if (e.key === 'Enter') handleSave();
    });
    return;
  }

  // Load cached data first → fast startup
  const cached = loadCache();
  if (cached && cached.length) {
    state.products = cached;
    buildProviders();
    applyFilters();
    showApp();
    setupListeners();
    updateOnline();
    document.getElementById('sync-status').textContent = cacheAgeLabel();

    // Background sync if cache is older than 1 hour
    if (cacheAgeMs() > 3_600_000 && navigator.onLine) syncData(false);
  } else {
    showApp();
    setupListeners();
    updateOnline();
    showSkeleton();
    syncData(true);
  }
}

document.addEventListener('DOMContentLoaded', init);
