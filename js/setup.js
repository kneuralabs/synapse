import {esc, shake} from './utils.js';

const KEY_DONE    = 'snps_setup_done';
const KEY_ORG     = 'snps_org';
const KEY_SOURCES = 'snps_sources';
const KEY_DATA    = 'snps_data_url';
const KEY_PROXY   = 'snps_api_proxy';

export const isSetupDone = () => !!localStorage.getItem(KEY_DONE);

export function getOrg() {
  try { return JSON.parse(localStorage.getItem(KEY_ORG)) || {}; }
  catch { return {}; }
}

// Sources entered in the setup wizard, normalized to the shape the app assumes.
export function getSources() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY_SOURCES)) || [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function getDataUrl() {
  return localStorage.getItem(KEY_DATA) || '';
}

export function setDataUrl(url) {
  if (url) localStorage.setItem(KEY_DATA, url);
  else localStorage.removeItem(KEY_DATA);
}

export function getApiProxy() {
  return localStorage.getItem(KEY_PROXY) || '';
}

export function setApiProxy(url) {
  if (url) localStorage.setItem(KEY_PROXY, url);
  else localStorage.removeItem(KEY_PROXY);
}

export function resetSetup() {
  [KEY_DONE, KEY_ORG, KEY_SOURCES, KEY_DATA, KEY_PROXY].forEach(k => localStorage.removeItem(k));
}

export function applyOrgToUI() {
  const org = getOrg();
  if (!org.name) return;
  const src = org.operator || org.name;
  const initials = src.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  document.querySelectorAll('.tb-avatar').forEach(el => el.textContent = initials);
  const nameEl = document.querySelector('.sb-user-name');
  if (nameEl) nameEl.textContent = org.name;
  const roleEl = document.querySelector('.sb-user-role');
  if (roleEl) roleEl.textContent = org.operator || org.industry || 'Data Steward';
}

// ── Wizard state ─────────────────────────────────────────────────────────────

let _onDone = null;
let _sources = [];
let _srcIdCounter = 1001;

export function runSetupWizard(onDone) {
  _onDone = onDone;
  _sources = [];
  _srcIdCounter = 1001;
  goStep(1);
  document.getElementById('setup-overlay').classList.add('active');
}

function goStep(n) {
  document.querySelectorAll('.setup-step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });
  document.querySelectorAll('.setup-step-dot').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
    el.classList.toggle('done', i + 1 < n);
  });
  if (n === 1) bindStep1();
  if (n === 2) bindStep2();
  if (n === 3) bindStep3();
}

// ── Step 1: Organization ─────────────────────────────────────────────────────

function bindStep1() {
  document.getElementById('s1-next').onclick = () => {
    const name = document.getElementById('s1-org-name').value.trim();
    if (!name) { shake('s1-org-name'); return; }
    localStorage.setItem(KEY_ORG, JSON.stringify({
      name,
      industry: document.getElementById('s1-industry').value,
      operator: document.getElementById('s1-operator').value.trim()
    }));
    applyOrgToUI();
    goStep(2);
  };
  document.getElementById('s1-org-name').onkeydown = e => {
    if (e.key === 'Enter') document.getElementById('s1-next').click();
  };
}

// ── Step 2: Data sources ─────────────────────────────────────────────────────

function bindStep2() {
  renderSourceList();
  document.getElementById('s2-add-btn').onclick = addSource;
  document.getElementById('s2-back').onclick = () => goStep(1);
  // Zero sources is fine here — the data feed connected in step 3 can supply
  // them; the launch step validates that at least one source of data exists.
  document.getElementById('s2-next').onclick = () => goStep(3);
  document.getElementById('s2-name').onkeydown = e => {
    if (e.key === 'Enter') addSource();
  };
}

function addSource() {
  const name = document.getElementById('s2-name').value.trim();
  if (!name) { shake('s2-name'); return; }
  _sources.push({
    id:          'SRC-' + _srcIdCounter++,
    name,
    type:        document.getElementById('s2-type').value,
    domain:      document.getElementById('s2-domain').value.trim() || 'Unclassified',
    owner:       document.getElementById('s2-owner').value.trim() || 'Unassigned',
    health:      Math.min(100, Math.max(0, parseInt(document.getElementById('s2-coverage').value) || 60)),
    description: document.getElementById('s2-desc').value.trim() || 'Source added via setup.'
  });
  ['s2-name', 's2-domain', 's2-owner', 's2-desc'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('s2-coverage').value = '60';
  document.getElementById('s2-name').focus();
  renderSourceList();
}

function renderSourceList() {
  const el = document.getElementById('s2-src-list');
  if (_sources.length === 0) {
    el.innerHTML = '<div class="setup-cust-empty">No sources yet — fill the form above and click "+ Add source".</div>';
    return;
  }
  el.innerHTML = _sources.map((s, i) => `
    <div class="setup-cust-chip">
      <span class="setup-cust-name">${esc(s.name)}</span>
      <span class="setup-cust-seg">${esc(s.domain)}</span>
      <span class="setup-cust-ltv">${s.health}% governed</span>
      <button class="setup-cust-del" data-i="${i}" title="Remove">✕</button>
    </div>`).join('');
  el.querySelectorAll('.setup-cust-del').forEach(btn => {
    btn.onclick = () => { _sources.splice(+btn.dataset.i, 1); renderSourceList(); };
  });
}

// ── Step 3: Data feed & launch ────────────────────────────────────────────────

function bindStep3() {
  // Pre-fill so re-running the wizard doesn't silently drop existing URLs.
  document.getElementById('s3-data-url').value = getDataUrl();
  document.getElementById('s3-api-url').value = getApiProxy();
  document.getElementById('s3-back').onclick = () => goStep(2);
  document.getElementById('s3-launch').onclick = () => {
    const dataUrl = document.getElementById('s3-data-url').value.trim();
    // The platform needs at least one source of real data: a data feed URL or
    // sources entered in step 2.
    if (!dataUrl && _sources.length === 0) { shake('s3-data-url'); return; }
    localStorage.setItem(KEY_SOURCES, JSON.stringify(_sources));
    setDataUrl(dataUrl);
    localStorage.setItem('snps_autonomy', document.getElementById('s3-autonomy').value);
    setApiProxy(document.getElementById('s3-api-url').value.trim());
    localStorage.setItem(KEY_DONE, '1');
    document.getElementById('setup-overlay').classList.remove('active');
    if (_onDone) _onDone();
  };
}
