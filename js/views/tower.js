import {state, on, setAutonomy, setRunning, openAssets, riskAssets, approvalQueue, estateHealth, scannersChanged, scannerRemoved} from '../engine.js';
import {SOURCE_TYPES} from '../data.js';
import {allSources} from '../datasource.js';
import {getScanners, addScanner, updateScanner, removeScanner} from '../scanners.js';
import {esc, toast, fmtMoney, fmtTime, shake} from '../utils.js';
import {liveView} from '../live.js';

const sourceIcon = type => (SOURCE_TYPES.find(t=>t.id===type)||{}).icon || '🗄️';

function renderKpis(){
  const k = state.kpis;
  const health = estateHealth();
  document.getElementById('map-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-val">${openAssets().length}</div><div class="kpi-lbl">Assets in scan</div></div>
    <div class="kpi"><div class="kpi-val">${k.governedToday} <span class="up">↑</span></div><div class="kpi-lbl">Governed today</div></div>
    <div class="kpi"><div class="kpi-val">${k.autoRate}%</div><div class="kpi-lbl">Auto-classification rate</div></div>
    <div class="kpi"><div class="kpi-val">${fmtMoney(k.exposureProtected)} <span class="up">↑</span></div><div class="kpi-lbl">Exposure remediated</div></div>
    <div class="kpi"><div class="kpi-val">${health ?? '—'}${health!=null?'%':''}</div><div class="kpi-lbl">Estate health</div></div>`;
}

let editingId = null; // scanner id being edited, '__new__' for the add form, or null

function scannerForm(s = {}){
  return `<div class="fleet-form">
    <input class="setup-input sf-name" placeholder="Scanner name" value="${esc(s.name||'')}" maxlength="40">
    <input class="setup-input sf-scope" placeholder="Scope / what it detects" value="${esc(s.scope||'')}" maxlength="80">
    <div class="fleet-form-row">
      <input class="fleet-color sf-color" type="color" value="${esc(s.color||'#6C7FFF')}" title="Scanner color">
      <div class="fleet-form-actions">
        <button class="btn btn-p" data-fleet="save">Save</button>
        <button class="btn btn-o" data-fleet="cancel">Cancel</button>
      </div>
    </div>
  </div>`;
}

function renderFleet(){
  // Engine 'change' events re-render constantly — don't clobber an open form.
  if(editingId && document.querySelector('#scanner-fleet .fleet-form')) return;
  const rows = getScanners().map(s=>{
    if(editingId === s.id) return scannerForm(s);
    const load = state.scannerLoads[s.id]||0;
    return `<div class="ws-row" data-id="${esc(s.id)}">
      <span class="ws-dot" style="background:${esc(s.color)}"></span>
      <div style="flex:1;min-width:0">
        <div class="ws-name">${esc(s.name)}</div>
        <div class="agent-scope">${esc(s.scope)}</div>
      </div>
      <span class="agent-state ${load?'busy':''}">${load ? load+' scanning' : 'idle'}</span>
      <button class="fleet-btn" data-fleet="edit" title="Edit scanner">✎</button>
      <button class="fleet-btn" data-fleet="del" title="Remove scanner">✕</button>
    </div>`;
  }).join('');
  document.getElementById('scanner-fleet').innerHTML = rows +
    (editingId === '__new__' ? scannerForm() : '<button class="btn btn-o fleet-add" data-fleet="add">+ Add scanner</button>');
}

function onFleetClick(e){
  const btn = e.target.closest('[data-fleet]');
  if(!btn) return;
  const act = btn.dataset.fleet;
  if(act === 'add'){ editingId = '__new__'; renderFleet(); }
  if(act === 'edit'){ editingId = btn.closest('[data-id]').dataset.id; renderFleet(); }
  if(act === 'cancel'){ editingId = null; renderFleet(); }
  if(act === 'del'){
    const id = btn.closest('[data-id]').dataset.id;
    if(!removeScanner(id)){ toast('At least one scanner is required.'); return; }
    editingId = null;
    scannerRemoved(id); // re-assigns its in-flight assets, logs, re-renders
  }
  if(act === 'save'){
    const form = btn.closest('.fleet-form');
    const name = form.querySelector('.sf-name').value.trim();
    if(!name){ shake(form.querySelector('.sf-name')); return; }
    const patch = {name, scope: form.querySelector('.sf-scope').value.trim(), color: form.querySelector('.sf-color').value};
    if(editingId === '__new__') addScanner(patch);
    else updateScanner(editingId, patch);
    editingId = null;
    scannersChanged(`Scanner fleet updated — "${name}"`); // logs + re-renders all views
  }
}

function renderFeed(){
  const items = state.audit.slice(0,12);
  document.getElementById('map-feed').innerHTML = items.map(a=>`
    <div class="activity-item">
      <div class="act-dot ${a.kind}"></div>
      <div class="act-body">${esc(a.text)}</div>
      <div class="act-time">${fmtTime(a.time)}</div>
    </div>`).join('') || '<div class="empty-hint">Waiting for the first scan…</div>';
}

function renderSources(){
  // Tally in-flight assets per source in a single pass.
  const counts = {};
  for(const a of openAssets()) counts[a.source?.id] = (counts[a.source?.id]||0) + 1;
  const sources = allSources();
  document.getElementById('source-grid').innerHTML = sources.map(s=>{
    const open = counts[s.id] || 0;
    return `<div class="channel-card ${open?'hot':''}">
      <div class="channel-icon">${sourceIcon(s.type)}</div>
      <div class="channel-name">${esc(s.name)}</div>
      <div class="channel-state">${open ? open+' asset'+(open>1?'s':'')+' scanning' : esc(s.health)+'% governed'}</div>
    </div>`;
  }).join('') || '<div class="empty-hint">No sources yet. Register them in setup or include a <code>sources</code> array in your data feed.</div>';
}

function renderBadges(){
  document.getElementById('badge-catalog').textContent = state.assets.length;
  document.getElementById('badge-risks').textContent = riskAssets().length;
  const ap = approvalQueue().length;
  const badge = document.getElementById('badge-approvals');
  badge.textContent = ap;
  badge.style.display = ap ? '' : 'none';
}

function renderAutonomy(){
  document.querySelectorAll('#autonomy-seg button').forEach(b=>
    b.classList.toggle('on', b.dataset.mode===state.autonomy));
}

function renderEnginePill(){
  document.getElementById('engine-label').textContent = state.running ? 'Engine live' : 'Engine paused';
  document.getElementById('engine-dot').classList.toggle('paused', !state.running);
}

// View-local panels (inside #v-map) — only worth rendering when on screen.
function renderView(){
  renderKpis(); renderFleet(); renderSources(); renderAutonomy();
}

// Global chrome that lives outside the map view (sidebar badges, topbar engine
// pill) — must stay current no matter which view is active.
function renderChrome(){
  renderBadges(); renderEnginePill();
}

export function initMap(){
  document.getElementById('autonomy-seg').addEventListener('click', e=>{
    const b = e.target.closest('button[data-mode]');
    if(b) setAutonomy(b.dataset.mode);
  });
  document.getElementById('engine-pill').addEventListener('click', ()=>setRunning(!state.running));
  document.getElementById('scanner-fleet').addEventListener('click', onFleetClick);
  on('change', renderChrome);        // always-visible chrome
  liveView('map', renderView);       // map panels — only while map is active
  liveView('map', renderFeed, 'audit');
  renderChrome();
}
