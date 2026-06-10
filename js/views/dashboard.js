import {WORKSTREAMS, PROJECTS, ACTIVITIES} from '../data.js';
import {nav} from '../router.js';
import {openProject} from './projects.js';

function renderDashboard(){
  // WS activity bars
  const acts = [72,58,85,44,63,38];
  document.getElementById('ws-activity').innerHTML = WORKSTREAMS.map((w,i)=>`
    <div class="ws-row">
      <div class="ws-dot" style="background:${w.color}"></div>
      <div class="ws-name" style="font-size:.8rem">${w.name}</div>
      <div class="ws-bar-wrap"><div class="ws-bar" data-w="${acts[i]}" style="width:0%;background:${w.color}"></div></div>
      <div class="ws-pct">${acts[i]}%</div>
    </div>`).join('');
  setTimeout(()=>document.querySelectorAll('.ws-bar').forEach(b=>b.style.width=b.dataset.w+'%'),100);

  document.getElementById('activity-feed').innerHTML = ACTIVITIES.map(a=>`
    <div class="activity-item"><div class="act-dot"></div><div class="act-body">${a.text}</div><div class="act-time">${a.time}</div></div>`).join('');

  document.getElementById('dash-projects').innerHTML = PROJECTS.slice(0,4).map(p=>`
    <div class="proj-card" data-id="${p.id}" style="cursor:pointer">
      <div class="proj-card-top"><div class="proj-name" style="font-size:.85rem">${p.name}</div><div class="proj-status status-${p.status}">${p.status}</div></div>
      <div class="proj-client" style="margin-bottom:10px">${p.client}</div>
      <div class="prog-row"><span>${p.progress}% complete</span></div>
      <div class="prog-bar"><div class="prog-fill" style="width:${p.progress}%"></div></div>
    </div>`).join('');
}

export function initDashboard(){
  renderDashboard();
  document.getElementById('dash-projects').addEventListener('click', e=>{
    const card = e.target.closest('.proj-card');
    if(card){ nav('projects'); openProject(Number(card.dataset.id)); }
  });
  document.getElementById('btn-new-strategy').addEventListener('click', ()=>nav('strategy'));
}
