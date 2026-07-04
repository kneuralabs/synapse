import {FRAMEWORKS} from '../data.js';
import {getScanners} from '../scanners.js';
import {state, estateHealth} from '../engine.js';
import {sensName} from '../labels.js';
import {esc, fmtMoney} from '../utils.js';
import {liveView} from '../live.js';

const PII = new Set(['Email Address','Person Name','Phone Number','National ID',
  'Passport Number','Bank Account','IP Address']);

// Whether an asset carries data that falls within a framework's scope. ISO/SOC2/
// NIST cover the whole estate; the rest are keyed to the sensitive types found.
function inScope(a, fw){
  const c = a.classifications || [];
  if(fw === 'gdpr')  return c.some(x => PII.has(x));
  if(fw === 'hipaa') return c.includes('Health Record');
  if(fw === 'pci')   return c.includes('Credit Card Number') || c.includes('Bank Account');
  return true; // iso, soc2, nist — whole-estate controls
}

const isGoverned = a => a.stage === 4 && !a.rejected;

// Framework readiness is the share of in-scope data that is actually governed.
// Null when no in-scope data exists yet — reported honestly, not as 100%.
function readiness(fw){
  const scope = state.assets.filter(a => inScope(a, fw));
  if(!scope.length) return null;
  return Math.round(scope.filter(isGoverned).length / scope.length * 100);
}

function readyClass(pct){ return pct>=80 ? 'good' : pct>=50 ? 'mid' : 'bad'; }

function render(){
  const k = state.kpis;
  const health = estateHealth();
  const total = state.assets.length;
  const governed = state.assets.filter(isGoverned);
  const coverage = total ? Math.round(governed.length / total * 100) : 0;
  const sensitiveProtected = governed.filter(a=>a.classifications.length).length;

  document.getElementById('compliance-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-val">${coverage}%</div><div class="kpi-lbl">Estate governed</div></div>
    <div class="kpi"><div class="kpi-val">${fmtMoney(k.exposureProtected)} <span class="up">↑</span></div><div class="kpi-lbl">Exposure remediated</div></div>
    <div class="kpi"><div class="kpi-val">${sensitiveProtected}</div><div class="kpi-lbl">Sensitive assets protected</div></div>
    <div class="kpi"><div class="kpi-val">${health ?? '—'}${health!=null?'%':''}</div><div class="kpi-lbl">Estate health</div></div>`;

  document.getElementById('framework-list').innerHTML = FRAMEWORKS.map(f=>{
    const pct = readiness(f.id);
    const val = pct == null ? '—' : pct+'%';
    const bar = pct == null ? 0 : pct;
    return `<div class="ws-row" title="${esc(f.full)}">
      <span class="ws-dot" style="background:var(--periwinkle)"></span>
      <div style="flex:1;min-width:0">
        <div class="ws-name">${esc(f.name)}</div>
        <div class="agent-scope">${pct == null ? 'No in-scope data yet' : esc(f.full)}</div>
      </div>
      <div class="ws-bar-wrap"><div class="ws-bar sent-${pct==null?'mid':readyClass(pct)}" style="width:${bar}%"></div></div>
      <span class="ws-pct" style="width:38px">${val}</span>
    </div>`;
  }).join('');

  document.getElementById('compliance-outcomes').innerHTML = governed.slice(0,8).map(a=>`
    <div class="activity-item">
      <div class="act-dot govern"></div>
      <div class="act-body"><strong>${esc(a.name)}</strong> — ${sensName(a.sensitivity)} · ${esc(a.source.name)} · ${fmtMoney(a.value)} exposure remediated</div>
    </div>`).join('') || '<div class="empty-hint">Governed assets appear here as scanners work the estate.</div>';

  const byScanner = getScanners().map(s=>({s, v: governed.filter(a=>a.scanner===s.id).reduce((sum,a)=>sum+a.value,0)}));
  const max = Math.max(1, ...byScanner.map(x=>x.v));
  document.getElementById('scanner-value').innerHTML = byScanner.map(({s,v})=>`
    <div class="ws-row">
      <span class="ws-dot" style="background:${esc(s.color)}"></span>
      <span class="ws-name">${esc(s.name)}</span>
      <div class="ws-bar-wrap"><div class="ws-bar" style="width:${Math.round(v/max*100)}%;background:${esc(s.color)}"></div></div>
      <span class="ws-pct" style="width:54px">${fmtMoney(v)}</span>
    </div>`).join('');
}

export function initCompliance(){
  liveView('compliance', render);
}
