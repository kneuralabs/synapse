import {POLICIES} from '../data.js';
import {state} from '../engine.js';
import {esc, fmtTimeSec} from '../utils.js';
import {liveView} from '../live.js';

const KIND_LABEL = {discover:'DISCOVER', classify:'CLASSIFY', govern:'GOVERN', approval:'STEWARD', policy:'POLICY'};

function renderPolicies(){
  document.getElementById('policy-list').innerHTML = POLICIES.map(p=>`
    <div class="ws-row">
      <span class="ws-dot" style="background:var(--green)"></span>
      <div style="flex:1;min-width:0">
        <div class="ws-name">${esc(p.name)}</div>
        <div class="agent-scope">${esc(p.policy)}</div>
      </div>
      <span class="agent-state busy">enforced</span>
    </div>`).join('');
}

function renderAudit(){
  document.getElementById('audit-list').innerHTML = state.audit.slice(0,40).map(a=>`
    <div class="activity-item">
      <span class="audit-kind k-${a.kind}">${KIND_LABEL[a.kind]||a.kind}</span>
      <div class="act-body">${esc(a.text)}</div>
      <div class="act-time">${fmtTimeSec(a.time)}</div>
    </div>`).join('') || '<div class="empty-hint">No events yet.</div>';
}

export function initGovernance(){
  renderPolicies(); // policies are static — render once
  liveView('governance', renderAudit, 'audit');
}
