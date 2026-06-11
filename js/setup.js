import {esc} from './utils.js';

const KEY_DONE  = 'snps_setup_done';
const KEY_ORG   = 'snps_org';
const KEY_CUSTS = 'snps_customers';
const KEY_DATA  = 'snps_data_url';
const KEY_PROXY = 'snps_api_proxy';

export const isSetupDone = () => !!localStorage.getItem(KEY_DONE);

export function getOrg() {
  try { return JSON.parse(localStorage.getItem(KEY_ORG)) || {}; }
  catch { return {}; }
}

export function getCustomers() {
  try { return JSON.parse(localStorage.getItem(KEY_CUSTS)) || []; }
  catch { return []; }
}

export function getDataUrl() {
  return localStorage.getItem(KEY_DATA) || '';
}

export function getApiProxy() {
  return localStorage.getItem(KEY_PROXY) || '';
}

export function resetSetup() {
  [KEY_DONE, KEY_ORG, KEY_CUSTS, KEY_DATA, KEY_PROXY].forEach(k => localStorage.removeItem(k));
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
  if (roleEl) roleEl.textContent = org.operator || org.industry || 'Experience Operator';
}

// ── Wizard state ─────────────────────────────────────────────────────────────

let _onDone = null;
let _customers = [];
let _custIdCounter = 1001;

export function runSetupWizard(onDone) {
  _onDone = onDone;
  _customers = [];
  _custIdCounter = 1001;
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

// ── Step 2: Customers ────────────────────────────────────────────────────────

function bindStep2() {
  renderCustList();
  document.getElementById('s2-add-btn').onclick = addCustomer;
  document.getElementById('s2-back').onclick = () => goStep(1);
  // Zero customers is fine here — the data source connected in step 3 can
  // supply them; the launch step validates that at least one source exists.
  document.getElementById('s2-next').onclick = () => goStep(3);
  document.getElementById('s2-name').onkeydown = e => {
    if (e.key === 'Enter') addCustomer();
  };
}

function addCustomer() {
  const name = document.getElementById('s2-name').value.trim();
  if (!name) { shake('s2-name'); return; }
  _customers.push({
    id:          'C-' + _custIdCounter++,
    name,
    segment:     document.getElementById('s2-segment').value,
    ltv:         Math.max(0, parseInt(document.getElementById('s2-ltv').value) || 0),
    tenure:      document.getElementById('s2-tenure').value.trim() || '—',
    channelPref: document.getElementById('s2-channel').value,
    journey:     document.getElementById('s2-journey').value,
    sentiment:   Math.min(100, Math.max(0, parseInt(document.getElementById('s2-sentiment').value) || 70)),
    persona:     document.getElementById('s2-persona').value.trim() || 'Customer added via setup.'
  });
  ['s2-name', 's2-ltv', 's2-tenure', 's2-persona'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('s2-sentiment').value = '70';
  document.getElementById('s2-name').focus();
  renderCustList();
}

function renderCustList() {
  const el = document.getElementById('s2-cust-list');
  if (_customers.length === 0) {
    el.innerHTML = '<div class="setup-cust-empty">No customers yet — fill the form above and click "+ Add customer".</div>';
    return;
  }
  el.innerHTML = _customers.map((c, i) => `
    <div class="setup-cust-chip">
      <span class="setup-cust-name">${esc(c.name)}</span>
      <span class="setup-cust-seg">${esc(c.segment)}</span>
      <span class="setup-cust-ltv">$${c.ltv.toLocaleString()} LTV</span>
      <button class="setup-cust-del" data-i="${i}" title="Remove">✕</button>
    </div>`).join('');
  el.querySelectorAll('.setup-cust-del').forEach(btn => {
    btn.onclick = () => { _customers.splice(+btn.dataset.i, 1); renderCustList(); };
  });
}

// ── Step 3: Data source & launch ─────────────────────────────────────────────

function bindStep3() {
  document.getElementById('s3-back').onclick = () => goStep(2);
  document.getElementById('s3-launch').onclick = () => {
    const dataUrl = document.getElementById('s3-data-url').value.trim();
    // The platform needs at least one source of real data: a data source URL
    // or customers entered in step 2.
    if (!dataUrl && _customers.length === 0) { shake('s3-data-url'); return; }
    localStorage.setItem(KEY_CUSTS, JSON.stringify(_customers));
    if (dataUrl) localStorage.setItem(KEY_DATA, dataUrl);
    else localStorage.removeItem(KEY_DATA);
    localStorage.setItem('lv_autonomy', document.getElementById('s3-autonomy').value);
    const proxy = document.getElementById('s3-api-url').value.trim();
    if (proxy) localStorage.setItem(KEY_PROXY, proxy);
    else localStorage.removeItem(KEY_PROXY);
    localStorage.setItem(KEY_DONE, '1');
    document.getElementById('setup-overlay').classList.remove('active');
    if (_onDone) _onDone();
  };
}

function shake(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 350);
}
