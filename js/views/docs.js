import {callClaude} from '../api.js';
import {esc} from '../utils.js';

let docs = [];
let docIdCounter = 0;

function handleFiles(files){
  const added = [...files].map(f=>{
    const id = ++docIdCounter;
    docs.push({id, name:f.name, size:(f.size/1024).toFixed(0)+'KB', type:f.type, file:f});
    return id;
  });
  renderDocs();
  added.forEach(analyzeDocById);
}

function renderDocs(){
  const icons = {'application/pdf':'📄','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'📝','text/plain':'📃'};
  document.getElementById('doc-list').innerHTML = docs.map(d=>`
    <div class="doc-item">
      <div class="doc-icon">${icons[d.type]||'📄'}</div>
      <div><div class="doc-name">${esc(d.name)}</div><div class="doc-meta">${d.size}</div></div>
      <div class="doc-actions">
        <button class="doc-btn" data-action="analyze" data-id="${d.id}">Analyze</button>
        <button class="doc-btn" data-action="remove" data-id="${d.id}">Remove</button>
      </div>
    </div>`).join('');
}

function analyzeDocById(id){
  const doc = docs.find(d=>d.id===id);
  if(doc) analyzeDoc(doc.file);
}

async function analyzeDoc(file){
  const panel = document.getElementById('doc-analysis');
  const status = document.getElementById('analysis-status');
  const grid = document.getElementById('insight-grid');
  const prose = document.getElementById('analysis-prose');
  panel.classList.add('show');
  status.textContent = `Analyzing ${file.name}…`;
  grid.innerHTML=''; prose.innerHTML='';

  // Only plain-text formats can be read meaningfully in the browser; PDFs and
  // DOCX read via readAsText produce binary garbage that misleads the model.
  const isTextFile = /^text\//.test(file.type) || /\.(txt|md|csv|json)$/i.test(file.name);
  const text = isTextFile ? await new Promise(res=>{
    const r = new FileReader();
    r.onload = e => res((e.target.result||'').substring(0,3000)||'[Empty file]');
    r.onerror = () => res('[Could not read file]');
    r.readAsText(file);
  }) : '[Binary document — content could not be extracted in the browser. Base your analysis on the filename and say so in the summary.]';

  try {
    const raw0 = await callClaude({
      max_tokens:1000,
      messages:[{role:'user',content:`Analyze this document for a consulting engagement. Extract key insights, identify transformation opportunities, and map to Levitate workstreams (Ecosystem Orchestration, Business Transformation, Digital Products, Marketing & Content, Commerce, Learning).

Filename: ${file.name}
Content preview: ${text.substring(0,1500)}

Respond ONLY with valid JSON (no markdown, no backticks):
{"summary":"2-3 sentence summary","sentiment":"Positive|Neutral|Concern","complexity":"Low|Medium|High","workstreams":["ws1","ws2"],"insights":["insight1","insight2","insight3"],"opportunities":["opp1","opp2"],"risks":["risk1"]}`}]
    });
    const raw = raw0.replace(/```json|```/g,'').trim();
    const j = JSON.parse(raw.substring(raw.indexOf('{'), raw.lastIndexOf('}')+1));

    status.textContent = `Analysis complete — ${file.name}`;
    grid.innerHTML = `
      <div class="insight-card"><div class="insight-label">Summary</div><div class="insight-val">${esc(j.summary||'—')}</div></div>
      <div class="insight-card"><div class="insight-label">Sentiment</div><div class="insight-val">${esc(j.sentiment||'—')}</div></div>
      <div class="insight-card"><div class="insight-label">Complexity</div><div class="insight-val">${esc(j.complexity||'—')}</div></div>
      <div class="insight-card"><div class="insight-label">Relevant Workstreams</div><div class="insight-val">${esc((j.workstreams||[]).join(', ')||'—')}</div></div>`;

    const section = (label, color, items, dotStyle) => items?.length ? `
      <div style="margin-bottom:16px"><div class="section-eyebrow" style="color:${color}">${label}</div>
      ${items.map(t=>`<div class="activity-item"><div class="act-dot" style="${dotStyle}"></div><div class="act-body">${esc(t)}</div></div>`).join('')}</div>` : '';

    prose.innerHTML =
      section('Key Insights','var(--periwinkle)',j.insights,'') +
      section('Opportunities','var(--green)',j.opportunities,'background:var(--green)') +
      section('Risks to Address','var(--accent)',j.risks,'background:var(--accent)');
  } catch(e) {
    status.textContent = 'Analysis error.';
    prose.innerHTML = `<div style="color:var(--accent);font-size:.82rem">${esc(e.message)}</div>`;
  }
}

export function initDocs(){
  const zone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  zone.addEventListener('click', ()=>fileInput.click());
  zone.addEventListener('dragover', e=>{e.preventDefault();zone.classList.add('drag');});
  zone.addEventListener('dragleave', ()=>zone.classList.remove('drag'));
  zone.addEventListener('drop', e=>{
    e.preventDefault();
    zone.classList.remove('drag');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', ()=>handleFiles(fileInput.files));
  document.getElementById('doc-list').addEventListener('click', e=>{
    const btn = e.target.closest('.doc-btn');
    if(!btn) return;
    const id = Number(btn.dataset.id);
    if(btn.dataset.action==='analyze') analyzeDocById(id);
    else { docs = docs.filter(d=>d.id!==id); renderDocs(); }
  });
}
