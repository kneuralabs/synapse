import {state, approve, reject} from '../engine.js';
import {STAGES} from '../data.js';
import {assetIcon, sensPill, sensName} from '../labels.js';
import {esc, mdLite, errorHtml, toast, fmtMoney, fmtTimeSec} from '../utils.js';
import {callClaude} from '../api.js';
import {liveView} from '../live.js';

let filter = 'all';
let selectedId = null;

function visible(){
  return state.assets.filter(a=>{
    if(filter==='open') return a.stage<4 && !a.needsApproval;
    if(filter==='approval') return a.needsApproval;
    if(filter==='governed') return a.stage===4;
    return true;
  });
}

function stageDots(asset){
  return `<div class="stage-track">` + STAGES.map((s,idx)=>{
    const cls = idx < asset.stage || asset.stage === 4 ? 'done' : idx === asset.stage ? (asset.needsApproval?'held':'now') : '';
    return `<span class="stage-dot ${cls}" title="${s}"></span>`;
  }).join('<span class="stage-line"></span>') + `</div>`;
}

function renderList(){
  const items = visible();
  document.getElementById('risk-list').innerHTML = items.map(a=>`
    <div class="issue-card ${a.id===selectedId?'sel':''} ${a.needsApproval?'held-card':''}" data-id="${a.id}">
      <div class="issue-top">
        <span class="issue-ch">${assetIcon(a.assetType)}</span>
        <span class="issue-type">${esc(a.name)}</span>
        <span class="sev sev-${a.risk}">${a.risk} risk</span>
      </div>
      <div class="issue-meta">${a.id} · ${esc(a.source.name)} · ${sensName(a.sensitivity)} · ${esc(a.exposure)}</div>
      ${stageDots(a)}
      <div class="issue-stage-lbl">${a.needsApproval ? '✋ Awaiting steward approval' : a.stage===4 ? (a.rejected?'Held by steward':'✓ Governed autonomously') : STAGES[a.stage]+'…'}</div>
    </div>`).join('') || '<div class="empty-hint">No assets yet. Assets stream in live from your data feed — connect one in setup if you haven\'t.</div>';
}

// `preserveDeepDive` keeps any existing AI deep-dive result (or its in-flight
// spinner) in place across the frequent engine 'change' re-renders. It's reset
// only when the operator selects a different asset.
function renderDetail(preserveDeepDive){
  const el = document.getElementById('risk-detail');
  const a = state.assets.find(x=>x.id===selectedId);
  if(!a){ el.innerHTML = '<div class="empty-hint">Select an asset to see its classification &amp; governance timeline.</div>'; return; }
  const deepDiveHtml = preserveDeepDive
    ? (document.getElementById('deepdive-out')?.innerHTML || '') : '';
  el.innerHTML = `
    <div class="detail-head">
      <div>
        <div class="detail-title">${assetIcon(a.assetType)} ${esc(a.name)} ${sensPill(a.sensitivity)}</div>
        <div class="issue-meta">${a.id} · ${esc(a.source.name)} · ${esc(a.path)} · ${esc(a.exposure)} · risk: ${a.risk}</div>
      </div>
    </div>
    ${a.classifications.length ? `<div class="section-eyebrow">Sensitive information types</div>
      <div class="proj-ws">${a.classifications.map(c=>`<span class="ws-pill">${esc(c)}</span>`).join('')}</div>` : ''}
    <div class="section-eyebrow">Governance playbook</div>
    <ol class="playbook">${a.playbook.map(p=>`<li>${esc(p)}</li>`).join('')}</ol>
    <div class="section-eyebrow">Timeline</div>
    <div class="timeline">${a.stepLog.map(s=>`
      <div class="tl-item">
        <div class="tl-stage">${esc(s.stage)}</div>
        <div class="tl-note">${esc(s.note)}</div>
        <div class="tl-time">${fmtTimeSec(s.time)}</div>
      </div>`).join('')}</div>
    ${a.needsApproval ? `
      <div class="approve-row">
        <button class="btn btn-p" data-act="approve">Approve remediation</button>
        <button class="btn btn-o" data-act="reject">Reject &amp; handle manually</button>
      </div>` : ''}
    <div class="approve-row">
      <button class="btn btn-o" data-act="deepdive">✦ AI deep-dive</button>
    </div>
    <div class="ai-prose" id="deepdive-out">${deepDiveHtml}</div>`;
}

async function deepDive(asset){
  // Re-fetch the output node on each write: a concurrent engine re-render may
  // have replaced it, and the operator may have switched to another asset.
  const setOut = html => {
    const out = document.getElementById('deepdive-out');
    if(out && selectedId === asset.id) out.innerHTML = html;
  };
  setOut('<div class="loading-row"><div class="spinner"></div> Assessing exposure &amp; remediation…</div>');
  try {
    const reply = await callClaude({max_tokens:600,
      system:'You are the analysis engine of an autonomous data-governance platform. Be concise and concrete. Use **bold** for headers only; no other markdown.',
      messages:[{role:'user', content:
        `Asset: ${asset.name} (${asset.assetType}) in ${asset.source.name}\nSensitivity: ${sensName(asset.sensitivity)}. Exposure: ${asset.exposure}. Risk: ${asset.risk}.\nSensitive types found: ${asset.classifications.join(', ') || 'none'}\nGovernance actions taken: ${asset.playbook.join('; ')}\n\nGive: **Exposure risk**, **Remediation recommendation**, **Regulatory note** (which regulation this implicates and why). Max 150 words.`}]});
    setOut(mdLite(reply));
  } catch(e){
    setOut(errorHtml(e.message));
  }
}

export function initRisks(){
  document.getElementById('risk-filters').addEventListener('click', e=>{
    const c = e.target.closest('.chip'); if(!c) return;
    filter = c.dataset.f;
    document.querySelectorAll('#risk-filters .chip').forEach(x=>x.classList.toggle('on', x===c));
    renderList();
  });
  document.getElementById('risk-list').addEventListener('click', e=>{
    const card = e.target.closest('.issue-card'); if(!card) return;
    selectedId = card.dataset.id;
    renderList(); renderDetail();
  });
  document.getElementById('risk-detail').addEventListener('click', e=>{
    const btn = e.target.closest('[data-act]'); if(!btn) return;
    const a = state.assets.find(x=>x.id===selectedId); if(!a) return;
    if(btn.dataset.act==='approve'){ approve(a); toast('Remediation approved — scanner resuming.'); }
    if(btn.dataset.act==='reject'){ reject(a); toast('Remediation rejected — asset held for manual handling.'); }
    if(btn.dataset.act==='deepdive') deepDive(a);
  });
  liveView('risks', ()=>{ renderList(); renderDetail(true); });
}
