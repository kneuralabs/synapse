import {WORKSTREAMS, PROJECTS} from '../data.js';
import {nav} from '../router.js';
import {toast} from '../utils.js';
import {preFillChat} from './chat.js';

function renderProjects(){
  document.getElementById('proj-grid').innerHTML = PROJECTS.map(p=>`
    <div class="proj-card" data-id="${p.id}">
      <div class="proj-card-top">
        <div><div class="proj-name">${p.name}</div><div class="proj-client">${p.client}</div></div>
        <div class="proj-status status-${p.status}">${p.status}</div>
      </div>
      <div class="proj-progress">
        <div class="prog-row"><span>Progress</span><span>${p.progress}%</span></div>
        <div class="prog-bar"><div class="prog-fill" style="width:${p.progress}%"></div></div>
      </div>
      <div class="proj-ws">${p.ws.map(w=>`<span class="ws-pill">${w}</span>`).join('')}</div>
    </div>`).join('');
}

export function openProject(id){
  const p = PROJECTS.find(x=>x.id===id);
  if(!p) return;
  const d = document.getElementById('proj-detail');
  d.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div><div class="dash-title" style="font-size:1.3rem">${p.name}</div><div class="dash-sub">${p.client} · ${p.industry}</div></div>
      <div class="proj-status status-${p.status}">${p.status}</div>
    </div>
    <div style="font-size:.85rem;color:var(--slate);margin-bottom:20px;line-height:1.7">${p.brief}</div>
    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi"><div class="kpi-val">${p.progress}%</div><div class="kpi-lbl">Complete</div></div>
      <div class="kpi"><div class="kpi-val">${p.ws.length}</div><div class="kpi-lbl">Workstreams</div></div>
    </div>
    <div style="font-family:'Inter',sans-serif;font-size:.75rem;font-weight:700;margin-bottom:10px;color:var(--slate);letter-spacing:.08em;text-transform:uppercase">Active Workstreams</div>
    ${p.ws.map(w=>{const ws=WORKSTREAMS.find(x=>x.name===w)||{color:'#6C7FFF'};return`<div class="ws-row"><div class="ws-dot" style="background:${ws.color}"></div><div>${w}</div></div>`}).join('')}
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-p" data-action="ask-ai" data-id="${p.id}">Ask AI about this</button>
      <button class="btn btn-o" data-action="close">Close</button>
    </div>`;
  d.classList.add('show');
  d.scrollIntoView({behavior:'smooth',block:'nearest'});
}

export function initProjects(){
  renderProjects();
  document.getElementById('proj-grid').addEventListener('click', e=>{
    const card = e.target.closest('.proj-card');
    if(card) openProject(Number(card.dataset.id));
  });
  document.getElementById('proj-detail').addEventListener('click', e=>{
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    if(btn.dataset.action==='close'){
      document.getElementById('proj-detail').classList.remove('show');
    } else if(btn.dataset.action==='ask-ai'){
      const p = PROJECTS.find(x=>x.id===Number(btn.dataset.id));
      nav('chat');
      preFillChat(`Tell me about the ${p.name} engagement`);
    }
  });
  document.getElementById('btn-new-project').addEventListener('click', ()=>{
    nav('strategy');
    toast('Start a new brief to create a project.');
  });
}
