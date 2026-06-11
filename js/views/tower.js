import {state, on, setAutonomy, setRunning, openIssues, approvalQueue, predictedCsat} from '../engine.js';
import {AGENTS, CHANNELS} from '../data.js';
import {esc} from '../utils.js';

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

function renderFleet(){
  document.getElementById('agent-fleet').innerHTML = AGENTS.map(a=>{
    const load = state.agentLoads[a.id]||0;
    return `<div class="ws-row">
      <span class="ws-dot" style="background:${a.color}"></span>
      <div style="flex:1;min-width:0">
        <div class="ws-name">${a.name}</div>
        <div class="agent-scope">${a.scope}</div>
      </div>
      <span class="agent-state ${load?'busy':''}">${load ? load+' active' : 'idle'}</span>
    </div>`;
  }).join('');
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
  on('change', renderAll);
  on('audit', renderFeed);
  renderAll(); renderFeed();
}
