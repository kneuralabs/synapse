import {approvalQueue, approve, reject} from '../engine.js';
import {sensPill, sensName, assetIcon} from '../labels.js';
import {esc, toast} from '../utils.js';
import {liveView} from '../live.js';

function render(){
  const items = approvalQueue();
  document.getElementById('approval-list').innerHTML = items.length ? items.map(a=>`
    <div class="panel approval-card" data-id="${a.id}">
      <div class="detail-title">${assetIcon(a.assetType)} ${esc(a.name)} ${sensPill(a.sensitivity)} <span class="sev sev-high">risk: ${a.risk}</span></div>
      <div class="issue-meta">${a.id} · ${esc(a.source.name)} · ${esc(a.exposure)}${a.classifications.length ? ' · ' + esc(a.classifications.join(', ')) : ''}</div>
      <p class="detail-desc">Proposed: apply the <strong>${esc(sensName(a.sensitivity))}</strong> label${a.exposure==='Over-shared' ? ' and restrict access to remediate over-sharing' : ' and align access to policy'}.</p>
      <div class="section-eyebrow">Governance actions to execute</div>
      <ol class="playbook">${a.playbook.map(p=>`<li>${esc(p)}</li>`).join('')}</ol>
      <div class="approve-row">
        <button class="btn btn-p" data-act="approve">Approve</button>
        <button class="btn btn-o" data-act="reject">Reject</button>
      </div>
    </div>`).join('')
  : '<div class="panel"><div class="empty-hint">No pending approvals. In <strong>Guarded</strong> mode only high-risk remediations are held here; in <strong>Full auto</strong> nothing is.</div></div>';
}

export function initApprovals(){
  document.getElementById('approval-list').addEventListener('click', e=>{
    const btn = e.target.closest('[data-act]'); if(!btn) return;
    const card = btn.closest('.approval-card');
    const asset = approvalQueue().find(a=>a.id===card.dataset.id);
    if(!asset) return;
    if(btn.dataset.act==='approve'){ approve(asset); toast(`${asset.id} approved — scanner executing.`); }
    else { reject(asset); toast(`${asset.id} rejected — routed to manual handling.`); }
  });
  liveView('approvals', render);
}
