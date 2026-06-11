import {JOURNEYS} from '../data.js';
import {state, on} from '../engine.js';
import {esc} from '../utils.js';

function render(){
  document.getElementById('journey-list').innerHTML = JOURNEYS.map(j=>{
    const active = state.issues.filter(i=>i.stage<4 && i.customer.journey===j.name).length;
    return `<div class="panel journey-card">
      <div class="panel-title">${esc(j.name)}
        <span class="eyebrow">${active ? active+' customer'+(active>1?'s':'')+' being helped now' : 'Healthy'}</span>
      </div>
      <div class="journey-stages">${j.stages.map((s,i)=>
        `<span class="j-stage">${esc(s)}</span>${i<j.stages.length-1?'<span class="j-arrow">→</span>':''}`).join('')}
      </div>
      <div class="prog-row" style="margin-top:14px"><span>Journey health</span><span>${j.health}%</span></div>
      <div class="prog-bar"><div class="prog-fill" style="width:${j.health}%"></div></div>
      <div class="nba"><span class="nba-tag">Next best action</span>${esc(j.nba)}</div>
    </div>`;
  }).join('');
}

export function initJourneys(){
  on('change', render);
  render();
}
