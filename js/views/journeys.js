import {getFlows} from '../datasource.js';
import {openAssets} from '../engine.js';
import {esc} from '../utils.js';
import {liveView} from '../live.js';

function render(){
  const flows = getFlows();
  const open = openAssets();
  document.getElementById('flow-list').innerHTML = flows.map(f=>{
    // A flow "runs hot" while assets in its governance domain are in-pipeline.
    const domain = f.domain || f.name;
    const active = open.filter(a => a.source?.domain === domain).length;
    const stages = Array.isArray(f.stages) ? f.stages : [];
    const health = Number(f.health);
    return `<div class="panel journey-card">
      <div class="panel-title">${esc(f.name)}
        <span class="eyebrow">${active ? active+' asset'+(active>1?'s':'')+' flowing now' : 'Healthy'}</span>
      </div>
      ${stages.length ? `<div class="journey-stages">${stages.map((s,i)=>
        `<span class="j-stage">${esc(s)}</span>${i<stages.length-1?'<span class="j-arrow">→</span>':''}`).join('')}
      </div>` : ''}
      ${Number.isFinite(health) ? `
      <div class="prog-row" style="margin-top:14px"><span>Lineage health</span><span>${health}%</span></div>
      <div class="prog-bar"><div class="prog-fill" style="width:${Math.min(100,Math.max(0,health))}%"></div></div>` : ''}
      ${f.nba ? `<div class="nba"><span class="nba-tag">Next best governance action</span>${esc(f.nba)}</div>` : ''}
    </div>`;
  }).join('') || '<div class="panel"><div class="empty-hint">No lineage data yet. Flows are loaded from your data feed — connect one in setup and include a <code>flows</code> array in its response.</div></div>';
}

export function initLineage(){
  liveView('lineage', render);
}
