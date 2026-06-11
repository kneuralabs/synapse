import {ISSUE_TEMPLATES} from './data.js';
import {esc} from './utils.js';

const KEY_DONE  = 'snps_setup_done';
const KEY_ORG   = 'snps_org';
const KEY_CUSTS = 'snps_customers';
const KEY_TMPLS = 'snps_templates';
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

export function getActiveTemplates() {
  try {
    const sel = JSON.parse(localStorage.getItem(KEY_TMPLS));
    if (!sel || !sel.length) return ISSUE_TEMPLATES;
    return ISSUE_TEMPLATES.filter(t => sel.includes(t.type));
  } catch { return ISSUE_TEMPLATES; }
}

export function getApiProxy() {
  return localStorage.getItem(KEY_PROXY) || '';
}

export function resetSetup() {
  [KEY_DONE, KEY_ORG, KEY_CUSTS, KEY_TMPLS, KEY_PROXY].forEach(k => localStorage.removeItem(k));
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
let _selectedTypes = new Set();
let _custIdCounter = 1001;

export function runSetupWizard(onDone) {
  _onDone = onDone;
  _customers = [];
  _custIdCounter = 1001;
  _selectedTypes = new Set(ISSUE_TEMPLATES.map(t => t.type));
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
  document.getElementById('s2-next').onclick = () => {
    if (_customers.length === 0) { shake('s2-add-btn'); return; }
    goStep(3);
  };
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

// ── Step 3: Issue Types ──────────────────────────────────────────────────────

function bindStep3() {
  const grid = document.getElementById('s3-tmpl-grid');
  grid.innerHTML = ISSUE_TEMPLATES.map(t => `
    <label class="setup-tmpl-card ${_selectedTypes.has(t.type) ? 'sel' : ''}">
      <input type="checkbox" class="setup-tmpl-cb" value="${esc(t.type)}" ${_selectedTypes.has(t.type) ? 'checked' : ''}>
      <div class="setup-tmpl-name">${esc(t.type)}</div>
      <div class="setup-tmpl-detail">${esc(t.detail)}</div>
      <div class="setup-tmpl-meta">${esc(t.channel)} · ${t.severity} severity · ${esc(t.agent)} agent</div>
    </label>`).join('');

  grid.querySelectorAll('.setup-tmpl-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.setup-tmpl-card').classList.toggle('sel', cb.checked);
      if (cb.checked) _selectedTypes.add(cb.value);
      else _selectedTypes.delete(cb.value);
    });
  });

  document.getElementById('s3-back').onclick = () => goStep(2);
  document.getElementById('s3-launch').onclick = () => {
    if (_selectedTypes.size === 0) { shake('s3-launch'); return; }
    localStorage.setItem(KEY_CUSTS, JSON.stringify(_customers));
    localStorage.setItem(KEY_TMPLS, JSON.stringify([..._selectedTypes]));
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
