import {getAgents} from '../agents.js';
import {state, on, predictedCsat} from '../engine.js';
import {esc, fmtMoney} from '../utils.js';

function render(){
  const k = state.kpis;
  const csat = predictedCsat();
  const resolved = state.issues.filter(i=>i.stage===4 && !i.rejected);
  const hoursSaved = Math.round(resolved.reduce((s,i)=>s+i.mins,0)/60*10)/10;

  document.getElementById('value-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-val">${fmtMoney(k.valueRecovered)} <span class="up">↑</span></div><div class="kpi-lbl">Revenue protected</div></div>
    <div class="kpi"><div class="kpi-val">${hoursSaved}h <span class="up">↑</span></div><div class="kpi-lbl">Human hours saved</div></div>
    <div class="kpi"><div class="kpi-val">${k.avgMins || '—'}<span style="font-size:.9rem">min</span></div><div class="kpi-lbl">Avg manual effort avoided / issue</div></div>
    <div class="kpi"><div class="kpi-val">${csat ?? '—'}${csat!=null?'%':''}</div><div class="kpi-lbl">Predicted CSAT</div></div>`;

  const byAgent = getAgents().map(a=>({a, v: resolved.filter(i=>i.agent===a.id).reduce((s,i)=>s+i.value,0)}));
  const max = Math.max(1, ...byAgent.map(x=>x.v));
  document.getElementById('value-agents').innerHTML = byAgent.map(({a,v})=>`
    <div class="ws-row">
      <span class="ws-dot" style="background:${esc(a.color)}"></span>
      <span class="ws-name">${esc(a.name)}</span>
      <div class="ws-bar-wrap"><div class="ws-bar" style="width:${Math.round(v/max*100)}%;background:${a.color}"></div></div>
      <span class="ws-pct" style="width:54px">${fmtMoney(v)}</span>
    </div>`).join('');

  document.getElementById('value-outcomes').innerHTML = resolved.slice(0,8).map(i=>`
    <div class="activity-item">
      <div class="act-dot resolve"></div>
      <div class="act-body"><strong>${esc(i.type)}</strong> — ${esc(i.customer.name)} · ${fmtMoney(i.value)} protected, ~${i.mins} min saved</div>
    </div>`).join('') || '<div class="empty-hint">Outcomes appear here as the agents resolve issues.</div>';
}

export function initValue(){
  on('change', render);
  render();
}
