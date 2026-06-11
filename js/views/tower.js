import {state, on, setAutonomy, setRunning, openIssues, approvalQueue, predictedCsat, agentsChanged, agentRemoved} from '../engine.js';
import {CHANNELS} from '../data.js';
import {getAgents, addAgent, updateAgent, removeAgent} from '../agents.js';
import {esc, toast} from '../utils.js';

function fmtMoney(n){ return '$' + n.toLocaleString(); }

function renderKpis(){
  const k = state.kpis;
  document.getElementById('tower-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-val">${openIssues().length}</div><div class="kpi-lbl">Problems in flight</div></div>
    <div class="kpi"><div class="kpi-val">${k.resolvedToday} <span class="up">↑</span></div><div class="kpi-lbl">Auto-resolved today</div></div>
    <div class="kpi"><div class="kpi-val">${k.autoRate}%</div><div class="kpi-lbl">Fully autonomous rate</div></div>
    <div class="kpi"><div class="kpi-val">${fmtMoney(k.valueRecovered)} <span class="up">↑</span></div><div class="kpi-lbl">Value recovered</div></div>
    <div class="kpi"><div class="kpi-val">${predictedCsat() ?? '—'}${predictedCsat()!=null?'%':''}</div><div class="kpi-lbl">Predicted CSAT</div></div>`;
}

let editingId = null; // agent id being edited, '__new__' for the add form, or null

function agentForm(a = {}){
  return `<div class="fleet-form">
    <input class="setup-input af-name" placeholder="Agent name" value="${esc(a.name||'')}" maxlength="40">
    <input class="setup-input af-scope" placeholder="Scope / responsibility" value="${esc(a.scope||'')}" maxlength="80">
    <div class="fleet-form-row">
      <input class="fleet-color af-color" type="color" value="${a.color||'#6C7FFF'}" title="Agent color">
      <div class="fleet-form-actions">
        <button class="btn btn-p" data-fleet="save">Save</button>
        <button class="btn btn-o" data-fleet="cancel">Cancel</button>
      </div>
    </div>
  </div>`;
}

function renderFleet(){
  // Engine 'change' events re-render constantly — don't clobber an open form.
  if(editingId && document.querySelector('#agent-fleet .fleet-form')) return;
  const rows = getAgents().map(a=>{
    if(editingId === a.id) return agentForm(a);
    const load = state.agentLoads[a.id]||0;
    return `<div class="ws-row" data-id="${esc(a.id)}">
      <span class="ws-dot" style="background:${esc(a.color)}"></span>
      <div style="flex:1;min-width:0">
        <div class="ws-name">${esc(a.name)}</div>
        <div class="agent-scope">${esc(a.scope)}</div>
      </div>
      <span class="agent-state ${load?'busy':''}">${load ? load+' active' : 'idle'}</span>
      <button class="fleet-btn" data-fleet="edit" title="Edit agent">✎</button>
      <button class="fleet-btn" data-fleet="del" title="Remove agent">✕</button>
    </div>`;
  }).join('');
  document.getElementById('agent-fleet').innerHTML = rows +
    (editingId === '__new__' ? agentForm() : '<button class="btn btn-o fleet-add" data-fleet="add">+ Add agent</button>');
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
    if(!removeAgent(id)){ toast('At least one agent is required.'); return; }
    editingId = null;
    agentRemoved(id); // re-assigns its open issues, logs, re-renders
  }
  if(act === 'save'){
    const form = btn.closest('.fleet-form');
    const name = form.querySelector('.af-name').value.trim();
    if(!name){ form.querySelector('.af-name').classList.add('shake'); setTimeout(()=>form.querySelector('.af-name').classList.remove('shake'),350); return; }
    const patch = {name, scope: form.querySelector('.af-scope').value.trim(), color: form.querySelector('.af-color').value};
    if(editingId === '__new__') addAgent(patch);
    else updateAgent(editingId, patch);
    editingId = null;
    agentsChanged(`Agent fleet updated — "${name}"`); // logs + re-renders all views
  }
}

function renderFeed(){
  const items = state.audit.slice(0,12);
  document.getElementById('tower-feed').innerHTML = items.map(a=>`
    <div class="activity-item">
      <div class="act-dot ${a.kind}"></div>
      <div class="act-body">${esc(a.text)}</div>
      <div class="act-time">${a.time.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
    </div>`).join('') || '<div class="empty-hint">Waiting for signals…</div>';
}

function renderChannels(){
  document.getElementById('channel-grid').innerHTML = CHANNELS.map(c=>{
    const open = openIssues().filter(i=>i.channel===c.id).length;
    return `<div class="channel-card ${open?'hot':''}">
      <div class="channel-icon">${c.icon}</div>
      <div class="channel-name">${c.name}</div>
      <div class="channel-state">${open ? open+' open issue'+(open>1?'s':'') : 'Healthy'}</div>
    </div>`;
  }).join('');
}

function renderBadges(){
  document.getElementById('badge-issues').textContent = openIssues().length;
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

function renderAll(){
  renderKpis(); renderFleet(); renderChannels(); renderBadges(); renderAutonomy(); renderEnginePill();
}

export function initTower(){
  document.getElementById('autonomy-seg').addEventListener('click', e=>{
    const b = e.target.closest('button[data-mode]');
    if(b) setAutonomy(b.dataset.mode);
  });
  document.getElementById('engine-pill').addEventListener('click', ()=>setRunning(!state.running));
  document.getElementById('agent-fleet').addEventListener('click', onFleetClick);
  on('change', renderAll);
  on('audit', renderFeed);
  renderAll(); renderFeed();
}
