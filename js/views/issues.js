import {state, approve, reject} from '../engine.js';
import {STAGES, CHANNELS} from '../data.js';
import {esc, mdLite, errorHtml, toast, fmtMoney, fmtTimeSec} from '../utils.js';
import {callClaude} from '../api.js';
import {liveView} from '../live.js';

let filter = 'all';
let selectedId = null;

const channelIcon = id => (CHANNELS.find(c=>c.id===id)||{}).icon || '•';

function visible(){
  return state.issues.filter(i=>{
    if(filter==='open') return i.stage<4 && !i.needsApproval;
    if(filter==='approval') return i.needsApproval;
    if(filter==='resolved') return i.stage===4;
    return true;
  });
}

function stageDots(issue){
  return `<div class="stage-track">` + STAGES.map((s,idx)=>{
    const cls = idx < issue.stage || issue.stage === 4 ? 'done' : idx === issue.stage ? (issue.needsApproval?'held':'now') : '';
    return `<span class="stage-dot ${cls}" title="${s}"></span>`;
  }).join('<span class="stage-line"></span>') + `</div>`;
}

function renderList(){
  const items = visible();
  document.getElementById('issue-list').innerHTML = items.map(i=>`
    <div class="issue-card ${i.id===selectedId?'sel':''} ${i.needsApproval?'held-card':''}" data-id="${i.id}">
      <div class="issue-top">
        <span class="issue-ch">${channelIcon(i.channel)}</span>
        <span class="issue-type">${esc(i.type)}</span>
        <span class="sev sev-${i.severity}">${i.severity}</span>
      </div>
      <div class="issue-meta">${i.id} · ${esc(i.customer.name)} · ${esc(i.customer.segment)}</div>
      ${stageDots(i)}
      <div class="issue-stage-lbl">${i.needsApproval ? '✋ Awaiting human approval' : i.stage===4 ? (i.rejected?'Closed by human':'✓ Resolved autonomously') : STAGES[i.stage]+'…'}</div>
    </div>`).join('') || '<div class="empty-hint">No issues yet. Issues stream in live from your data source — connect one in setup if you haven\'t.</div>';
}

// `preserveDeepDive` keeps any existing AI deep-dive result (or its in-flight
// spinner) in place across the frequent engine 'change' re-renders. It's reset
// only when the operator selects a different issue.
function renderDetail(preserveDeepDive){
  const el = document.getElementById('issue-detail');
  const i = state.issues.find(x=>x.id===selectedId);
  if(!i){ el.innerHTML = '<div class="empty-hint">Select an issue to see the autonomous resolution timeline.</div>'; return; }
  const deepDiveHtml = preserveDeepDive
    ? (document.getElementById('deepdive-out')?.innerHTML || '') : '';
  el.innerHTML = `
    <div class="detail-head">
      <div>
        <div class="detail-title">${channelIcon(i.channel)} ${esc(i.type)} <span class="sev sev-${i.severity}">${i.severity}</span></div>
        <div class="issue-meta">${i.id} · ${esc(i.customer.name)} (${i.customer.id}) · LTV ${fmtMoney(i.customer.ltv)} · risk: ${i.risk}</div>
      </div>
    </div>
    <p class="detail-desc">${esc(i.detail)}</p>
    <div class="section-eyebrow">Decision engine playbook</div>
    <ol class="playbook">${i.playbook.map(p=>`<li>${esc(p)}</li>`).join('')}</ol>
    <div class="section-eyebrow">Timeline</div>
    <div class="timeline">${i.stepLog.map(s=>`
      <div class="tl-item">
        <div class="tl-stage">${esc(s.stage)}</div>
        <div class="tl-note">${esc(s.note)}</div>
        <div class="tl-time">${fmtTimeSec(s.time)}</div>
      </div>`).join('')}</div>
    ${i.needsApproval ? `
      <div class="approve-row">
        <button class="btn btn-p" data-act="approve">Approve action</button>
        <button class="btn btn-o" data-act="reject">Reject & handle manually</button>
      </div>` : ''}
    <div class="approve-row">
      <button class="btn btn-o" data-act="deepdive">✦ AI deep-dive</button>
    </div>
    <div class="ai-prose" id="deepdive-out">${deepDiveHtml}</div>`;
}

async function deepDive(issue){
  // Re-fetch the output node on each write: a concurrent engine re-render may
  // have replaced it, and the operator may have switched to another issue.
  const setOut = html => {
    const out = document.getElementById('deepdive-out');
    if(out && selectedId === issue.id) out.innerHTML = html;
  };
  setOut('<div class="loading-row"><div class="spinner"></div> Analyzing root cause & prevention…</div>');
  try {
    const reply = await callClaude({max_tokens:600,
      system:'You are the analysis engine of an autonomous customer-experience platform. Be concise and concrete. Use **bold** for headers only; no other markdown.',
      messages:[{role:'user', content:
        `Issue: ${issue.type} (${issue.severity} severity, ${issue.channel} channel)\nDetail: ${issue.detail}\nCustomer: ${issue.customer.segment} segment, sentiment ${issue.customer.sentiment}/100, persona: ${issue.customer.persona}\nPlaybook executed: ${issue.playbook.join('; ')}\n\nGive: **Root cause hypothesis**, **Prevention recommendation**, **Customer follow-up** (one short message we could send). Max 150 words.`}]});
    setOut(mdLite(reply));
  } catch(e){
    setOut(errorHtml(e.message));
  }
}

export function initIssues(){
  document.getElementById('issue-filters').addEventListener('click', e=>{
    const c = e.target.closest('.chip'); if(!c) return;
    filter = c.dataset.f;
    document.querySelectorAll('#issue-filters .chip').forEach(x=>x.classList.toggle('on', x===c));
    renderList();
  });
  document.getElementById('issue-list').addEventListener('click', e=>{
    const card = e.target.closest('.issue-card'); if(!card) return;
    selectedId = card.dataset.id;
    renderList(); renderDetail();
  });
  document.getElementById('issue-detail').addEventListener('click', e=>{
    const btn = e.target.closest('[data-act]'); if(!btn) return;
    const i = state.issues.find(x=>x.id===selectedId); if(!i) return;
    if(btn.dataset.act==='approve'){ approve(i); toast('Action approved — agent resuming.'); }
    if(btn.dataset.act==='reject'){ reject(i); toast('Action rejected — issue routed to manual handling.'); }
    if(btn.dataset.act==='deepdive') deepDive(i);
  });
  liveView('issues', ()=>{ renderList(); renderDetail(true); });
}
