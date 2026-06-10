import {WORKSTREAMS} from '../data.js';
import {callClaude} from '../api.js';
import {esc, toast} from '../utils.js';

const selectedWS = new Set();

function renderWsChips(){
  document.getElementById('ws-chips').innerHTML = WORKSTREAMS.map(w=>`
    <button class="chip ${selectedWS.has(w.name)?'on':''}" data-name="${esc(w.name)}">${w.name}</button>`).join('');
}

export function selectWS(name){
  selectedWS.add(name);
  renderWsChips();
}

async function generateStrategy(){
  const client = document.getElementById('f-client').value.trim();
  const objective = document.getElementById('f-objective').value.trim();
  const industry = document.getElementById('f-industry').value;
  const timeline = document.getElementById('f-timeline').value;
  const budget = document.getElementById('f-budget').value;
  const ws = [...selectedWS];

  if(!client||!objective){toast('Add a client name and objective first.');return;}

  const panel = document.getElementById('strategy-result');
  const body = document.getElementById('result-body');
  panel.classList.add('show');
  document.getElementById('result-title').textContent = `Transformation Plan — ${client}`;
  body.innerHTML = `<div class="loading-row"><div class="spinner"></div> Generating your transformation plan…</div>`;

  const prompt = `You are Levitate, an experience intelligence platform. Generate a detailed, structured transformation plan for the following brief. Be specific, actionable, and use the exact workstreams and context provided.

Client: ${client}
Industry: ${industry||'Not specified'}
Objective: ${objective}
Workstreams to activate: ${ws.length?ws.join(', '):'All relevant workstreams'}
Timeline: ${timeline}
Budget: ${budget}

Structure your response as:
1. Executive Summary (2-3 sentences)
2. Strategic Diagnosis (key challenges and opportunities)
3. Recommended Workstreams with rationale (for each selected workstream)
4. Phased Roadmap (Phase 1/2/3 with clear milestones)
5. Expected Outcomes & KPIs
6. Risk Considerations

Format phases as: PHASE_START: [Phase Name] | [Duration] | [Key milestone] :PHASE_END
Keep it sharp, consulting-grade, and specific to the industry.`;

  try {
    const text = await callClaude({max_tokens:2000, messages:[{role:'user',content:prompt}]});
    streamText(body, formatStrategy(text));
  } catch(e) {
    body.innerHTML = `<div style="color:var(--accent)">${esc(e.message)}</div>`;
  }
}

function formatStrategy(text){
  text = esc(text);
  // Replace PHASE markers with styled divs
  text = text.replace(/PHASE_START:\s*(.+?)\s*:PHASE_END/g, (_,c)=>{
    const parts = c.split('|').map(s=>s.trim());
    return `<div class="phase"><h4>${parts[0]||''} ${parts[1]?'· '+parts[1]:''}</h4>${parts[2]||''}</div>`;
  });
  return text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>');
}

// Re-emit pre-built HTML node by node to simulate token streaming.
function streamText(el, html){
  el.innerHTML = '<span class="streaming-cursor"></span>';
  const div = document.createElement('div');
  div.innerHTML = html;
  const nodes = [];
  function collectText(node){
    if(node.nodeType===3) nodes.push({type:'text',text:node.textContent});
    else { nodes.push({type:'open',node:node.cloneNode(false)}); node.childNodes.forEach(collectText); nodes.push({type:'close'}); }
  }
  div.childNodes.forEach(collectText);

  el.innerHTML = '';
  const stack = [el]; let i = 0;
  const cur = document.createElement('span'); cur.className='streaming-cursor';
  function step(){
    if(i>=nodes.length){stack[stack.length-1].appendChild(cur);return;}
    const n = nodes[i++];
    if(n.type==='text'){stack[stack.length-1].appendChild(document.createTextNode(n.text));}
    else if(n.type==='open'){const newEl=n.node.cloneNode(false);stack[stack.length-1].appendChild(newEl);stack.push(newEl);}
    else if(n.type==='close'&&stack.length>1){stack.pop();}
    setTimeout(step, i%3===0?12:0);
  }
  step();
}

function clearStrategy(){
  document.getElementById('f-client').value='';
  document.getElementById('f-objective').value='';
  document.getElementById('f-industry').value='';
  selectedWS.clear();
  renderWsChips();
  document.getElementById('strategy-result').classList.remove('show');
}

export function initStrategy(){
  renderWsChips();
  document.getElementById('ws-chips').addEventListener('click', e=>{
    const chip = e.target.closest('.chip');
    if(!chip) return;
    const name = chip.dataset.name;
    selectedWS.has(name)?selectedWS.delete(name):selectedWS.add(name);
    chip.classList.toggle('on');
  });
  document.getElementById('btn-generate').addEventListener('click', generateStrategy);
  document.getElementById('btn-clear').addEventListener('click', clearStrategy);
  document.getElementById('btn-save').addEventListener('click', ()=>toast('Strategy saved to projects ✓'));
  document.getElementById('btn-export').addEventListener('click', ()=>toast('Export coming soon — PDF generation in roadmap.'));
}
