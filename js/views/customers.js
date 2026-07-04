import {state} from '../engine.js';
import {STAGES} from '../data.js';
import {assetIcon, sensPill, sensName, classChips} from '../labels.js';
import {esc, fmtTimeSec} from '../utils.js';
import {liveView} from '../live.js';

let selectedId = null;
let query = '';

function matches(a){
  if(!query) return true;
  const hay = [a.name, a.path, a.source.name, a.source.domain, sensName(a.sensitivity),
    a.exposure, ...(a.classifications||[]), ...(a.glossary||[])].join(' ').toLowerCase();
  return hay.includes(query);
}

function statusLabel(a){
  if(a.needsApproval) return '✋ Awaiting approval';
  if(a.stage===4) return a.rejected ? 'Held by steward' : '✓ Governed';
  return STAGES[a.stage]+'…';
}

function renderGrid(){
  const items = state.assets.filter(matches);
  document.getElementById('catalog-grid').innerHTML = items.map(a=>`
    <div class="proj-card ${a.id===selectedId?'sel':''}" data-id="${a.id}">
      <div class="proj-card-top">
        <div class="proj-name">${assetIcon(a.assetType)} ${esc(a.name)}</div>
        ${sensPill(a.sensitivity)}
      </div>
      <div class="proj-client">${a.id} · ${esc(a.source.name)} · ${esc(a.assetType)}</div>
      ${classChips(a.classifications)}
      <div class="proj-ws">
        <span class="ws-pill ${a.exposure==='Over-shared'?'pill-hot':''}">${esc(a.exposure)}</span>
        <span class="ws-pill">${esc(statusLabel(a))}</span>
      </div>
    </div>`).join('') ||
    (state.assets.length
      ? '<div class="empty-hint">No assets match your search.</div>'
      : '<div class="empty-hint">No assets catalogued yet. Connect a data feed in setup — discovered assets are classified and appear here.</div>');
}

function renderDetail(){
  const el = document.getElementById('catalog-detail');
  const a = state.assets.find(x=>x.id===selectedId);
  if(!a){ el.style.display='none'; return; }
  el.style.display='block';
  el.innerHTML = `
    <div class="detail-title">${assetIcon(a.assetType)} ${esc(a.name)} ${sensPill(a.sensitivity)}</div>
    <div class="issue-meta">${a.id} · ${esc(a.source.name)} · ${esc(a.path)}${a.rows?' · ~'+a.rows.toLocaleString()+' rows':''}</div>
    <p class="detail-desc">${esc(a.resolution)}</p>
    <div class="catalog-meta">
      <div class="cm-item"><span class="cm-k">Type</span><span class="cm-v">${esc(a.assetType)}${a.format?' · '+esc(a.format):''}</span></div>
      <div class="cm-item"><span class="cm-k">Domain</span><span class="cm-v">${esc(a.source.domain)}</span></div>
      <div class="cm-item"><span class="cm-k">Owner</span><span class="cm-v">${esc(a.source.owner)}</span></div>
      <div class="cm-item"><span class="cm-k">Exposure</span><span class="cm-v">${esc(a.exposure)}</span></div>
    </div>
    ${a.classifications.length ? `<div class="section-eyebrow">Sensitive information types</div>${classChips(a.classifications)}` : ''}
    ${a.glossary.length ? `<div class="section-eyebrow">Glossary terms</div>
      <div class="proj-ws">${a.glossary.map(g=>`<span class="ws-pill">${esc(g)}</span>`).join('')}</div>` : ''}
    <div class="section-eyebrow">Governance history</div>
    <div class="timeline">${a.stepLog.map(s=>`
      <div class="tl-item">
        <div class="tl-stage">${esc(s.stage)}</div>
        <div class="tl-note">${esc(s.note)}</div>
        <div class="tl-time">${fmtTimeSec(s.time)}</div>
      </div>`).join('')}</div>`;
}

export function initCatalog(){
  document.getElementById('catalog-grid').addEventListener('click', e=>{
    const card = e.target.closest('.proj-card'); if(!card) return;
    selectedId = card.dataset.id === selectedId ? null : card.dataset.id;
    renderGrid(); renderDetail();
  });
  document.getElementById('catalog-search').addEventListener('input', e=>{
    query = e.target.value.trim().toLowerCase();
    renderGrid();
  });
  liveView('catalog', ()=>{ renderGrid(); renderDetail(); });
}
