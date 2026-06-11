import {allCustomers} from '../datasource.js';
import {state, on} from '../engine.js';
import {esc} from '../utils.js';

let selectedId = null;

function sentClass(s){ return s>=70 ? 'good' : s>=55 ? 'mid' : 'bad'; }

function renderGrid(){
  document.getElementById('customer-grid').innerHTML = allCustomers().map(c=>{
    const open = state.issues.filter(i=>i.stage<4 && i.customer.id===c.id).length;
    return `<div class="proj-card ${c.id===selectedId?'sel':''}" data-id="${c.id}">
      <div class="proj-card-top">
        <div class="proj-name">${esc(c.name)}</div>
        <span class="ws-pill">${esc(c.segment)}</span>
      </div>
      <div class="proj-client">${c.id} · ${esc(c.tenure)} · LTV $${c.ltv.toLocaleString()}</div>
      <div class="prog-row" style="margin-top:14px"><span>Sentiment</span><span>${c.sentiment}%</span></div>
      <div class="prog-bar"><div class="prog-fill sent-${sentClass(c.sentiment)}" style="width:${c.sentiment}%"></div></div>
      <div class="proj-ws">
        <span class="ws-pill">${esc(c.journey)} journey</span>
        ${open?`<span class="ws-pill pill-hot">${open} issue${open>1?'s':''} being resolved</span>`:''}
      </div>
    </div>`;
  }).join('') || '<div class="empty-hint">No customers yet. Add them in setup or include a <code>customers</code> array in your data source response.</div>';
}

function renderDetail(){
  const el = document.getElementById('customer-detail');
  const c = allCustomers().find(x=>x.id===selectedId);
  if(!c){ el.style.display='none'; return; }
  const history = state.issues.filter(i=>i.customer.id===c.id);
  el.style.display='block';
  el.innerHTML = `
    <div class="detail-title">${esc(c.name)} — Digital Twin</div>
    <div class="issue-meta">${c.id} · ${esc(c.segment)} · prefers ${esc(c.channelPref)} channel</div>
    <p class="detail-desc">${esc(c.persona)}</p>
    <div class="section-eyebrow">Issue history (this session)</div>
    ${history.length ? `<div class="timeline">${history.map(i=>`
      <div class="tl-item">
        <div class="tl-stage">${esc(i.type)}</div>
        <div class="tl-note">${i.stage===4 ? esc(i.resolution) : 'Resolution in progress — '+(i.needsApproval?'awaiting approval':'agents acting')}</div>
        <div class="tl-time">${i.createdAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
      </div>`).join('')}</div>`
    : '<div class="empty-hint">No issues detected for this customer yet — the agents are watching.</div>'}`;
}

export function initCustomers(){
  document.getElementById('customer-grid').addEventListener('click', e=>{
    const card = e.target.closest('.proj-card'); if(!card) return;
    selectedId = card.dataset.id === selectedId ? null : card.dataset.id;
    renderGrid(); renderDetail();
  });
  on('change', ()=>{ renderGrid(); renderDetail(); });
  renderGrid();
}
