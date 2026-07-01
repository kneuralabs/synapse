import {approvalQueue, approve, reject} from '../engine.js';
import {esc, toast, fmtMoney} from '../utils.js';
import {liveView} from '../live.js';

function render(){
  const items = approvalQueue();
  document.getElementById('approval-list').innerHTML = items.length ? items.map(i=>`
    <div class="panel approval-card" data-id="${i.id}">
      <div class="detail-title">${esc(i.type)} <span class="sev sev-${i.severity}">${i.severity}</span> <span class="sev sev-high">risk: ${i.risk}</span></div>
      <div class="issue-meta">${i.id} · ${esc(i.customer.name)} (${esc(i.customer.segment)}, LTV ${fmtMoney(i.customer.ltv)})</div>
      <p class="detail-desc">${esc(i.detail)}</p>
      <div class="section-eyebrow">Proposed autonomous action</div>
      <ol class="playbook">${i.playbook.map(p=>`<li>${esc(p)}</li>`).join('')}</ol>
      <div class="approve-row">
        <button class="btn btn-p" data-act="approve">Approve</button>
        <button class="btn btn-o" data-act="reject">Reject</button>
      </div>
    </div>`).join('')
  : '<div class="panel"><div class="empty-hint">No pending approvals. In <strong>Guarded</strong> mode only high-risk actions are held here; in <strong>Full auto</strong> nothing is.</div></div>';
}

export function initApprovals(){
  document.getElementById('approval-list').addEventListener('click', e=>{
    const btn = e.target.closest('[data-act]'); if(!btn) return;
    const card = btn.closest('.approval-card');
    const issue = approvalQueue().find(i=>i.id===card.dataset.id);
    if(!issue) return;
    if(btn.dataset.act==='approve'){ approve(issue); toast(`${issue.id} approved — agent executing.`); }
    else { reject(issue); toast(`${issue.id} rejected — routed to manual handling.`); }
  });
  liveView('approvals', render);
}
