import {callClaude} from '../api.js';
import {esc, mdLite} from '../utils.js';

const chatHistory = [];
let chatBusy = false;

const SYSTEM_PROMPT = `You are Levitate AI, the intelligent assistant embedded in the Levitate Experience Intelligence Platform. You help consultants and enterprise clients with:
- Transformation strategy across 6 workstreams: Ecosystem Orchestration, Business Transformation, Digital Products & Platforms, Marketing & Content, Commerce, Learning
- Workstream fit analysis and recommendations
- KPI frameworks and measurement
- Client engagement planning and proposal drafting
- Interpreting data and documents

Active projects: GlobalBank DX (Financial Services, 68% complete), RetailCo Commerce (Retail, 41%), MediHealth Learning (Healthcare, 15%), GovNext Platform (Government, 90%).

Be sharp, specific, consulting-grade. Use concrete examples. Keep responses focused and useful. Format with clear sections when helpful.`;

export function preFillChat(text){
  document.getElementById('chat-input').value = text;
}

async function sendChat(){
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text || chatBusy) return; // a pending request would interleave chatHistory
  chatBusy = true;
  input.value = '';

  appendMsg('user', esc(text));
  chatHistory.push({role:'user',content:text});

  const thinkingEl = appendMsg('ai', '<div class="loading-row"><div class="spinner"></div> Thinking…</div>');

  try {
    const reply = await callClaude({max_tokens:1000, system:SYSTEM_PROMPT, messages:chatHistory});
    chatHistory.push({role:'assistant',content:reply});
    thinkingEl.querySelector('.msg-bubble').innerHTML = mdLite(reply);
  } catch(e) {
    chatHistory.pop(); // drop the unanswered user turn so a retry resends cleanly
    thinkingEl.querySelector('.msg-bubble').innerHTML = `<span style="color:var(--accent)">${esc(e.message)}</span>`;
  } finally {
    chatBusy = false;
  }

  const msgs = document.getElementById('chat-msgs');
  msgs.scrollTop = msgs.scrollHeight;
}

function appendMsg(role, html){
  const msgs = document.getElementById('chat-msgs');
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.innerHTML = `<div class="msg-av">${role==='ai'?'L':'K'}</div><div class="msg-bubble">${html}</div>`;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

export function initChat(){
  document.getElementById('chat-input').addEventListener('keydown', e=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}
  });
  document.getElementById('chat-send').addEventListener('click', sendChat);
  document.getElementById('chat-suggestions').addEventListener('click', e=>{
    const chip = e.target.closest('.sug-chip');
    if(!chip) return;
    preFillChat(chip.textContent);
    sendChat();
    document.getElementById('chat-suggestions').style.display='none';
  });
}
