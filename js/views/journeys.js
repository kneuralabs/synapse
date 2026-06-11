import {getJourneys} from '../datasource.js';
import {state, on} from '../engine.js';
import {esc} from '../utils.js';

function render(){
  const journeys = getJourneys();
  document.getElementById('journey-list').innerHTML = journeys.map(j=>{
    const active = state.issues.filter(i=>i.stage<4 && i.customer.journey===j.name).length;
    const stages = Array.isArray(j.stages) ? j.stages : [];
    const health = Number(j.health);
    return `<div class="panel journey-card">
      <div class="panel-title">${esc(j.name)}
        <span class="eyebrow">${active ? active+' customer'+(active>1?'s':'')+' being helped now' : 'Healthy'}</span>
      </div>
      ${stages.length ? `<div class="journey-stages">${stages.map((s,i)=>
        `<span class="j-stage">${esc(s)}</span>${i<stages.length-1?'<span class="j-arrow">→</span>':''}`).join('')}
      </div>` : ''}
      ${Number.isFinite(health) ? `
      <div class="prog-row" style="margin-top:14px"><span>Journey health</span><span>${health}%</span></div>
      <div class="prog-bar"><div class="prog-fill" style="width:${Math.min(100,Math.max(0,health))}%"></div></div>` : ''}
      ${j.nba ? `<div class="nba"><span class="nba-tag">Next best action</span>${esc(j.nba)}</div>` : ''}
    </div>`;
  }).join('') || '<div class="panel"><div class="empty-hint">No journey data yet. Journeys are loaded from your data source — connect one in setup and include a <code>journeys</code> array in its response.</div></div>';
}

export function initJourneys(){
  on('change', render);
  render();
}
