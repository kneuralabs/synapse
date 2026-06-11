import {GUARDRAILS} from '../data.js';
import {state, on} from '../engine.js';
import {esc} from '../utils.js';

const KIND_LABEL = {detect:'DETECT', action:'ACTION', resolve:'RESOLVE', approval:'HITL', governance:'POLICY'};

function renderGuardrails(){
  document.getElementById('guardrail-list').innerHTML = GUARDRAILS.map(g=>`
    <div class="ws-row">
      <span class="ws-dot" style="background:var(--green)"></span>
      <div style="flex:1;min-width:0">
        <div class="ws-name">${esc(g.name)}</div>
        <div class="agent-scope">${esc(g.policy)}</div>
      </div>
      <span class="agent-state busy">enforced</span>
    </div>`).join('');
}

function renderAudit(){
  document.getElementById('audit-list').innerHTML = state.audit.slice(0,40).map(a=>`
    <div class="activity-item">
      <span class="audit-kind k-${a.kind}">${KIND_LABEL[a.kind]||a.kind}</span>
      <div class="act-body">${esc(a.text)}</div>
      <div class="act-time">${a.time.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>
    </div>`).join('') || '<div class="empty-hint">No events yet.</div>';
}

export function initGovernance(){
  on('audit', renderAudit);
  renderGuardrails();
  renderAudit();
}
