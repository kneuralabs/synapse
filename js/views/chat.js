import {callClaude} from '../api.js';
import {esc, mdLite} from '../utils.js';
import {state, openIssues, approvalQueue, predictedCsat} from '../engine.js';

const chatHistory = [];
let chatBusy = false;

// Built fresh per message so the assistant always sees live platform state.
function systemPrompt(){
  const open = openIssues().map(i=>`${i.id} ${i.type} (${i.severity}, ${i.channel}) for ${i.customer.name} [${i.customer.segment}, sentiment ${i.customer.sentiment}]`).join('; ') || 'none';
  const held = approvalQueue().map(i=>`${i.id} ${i.type} (risk ${i.risk})`).join('; ') || 'none';
  const resolved = state.issues.filter(i=>i.stage===4).slice(0,8).map(i=>`${i.id} ${i.type} → ${i.resolution}`).join('; ') || 'none yet';
  return `You are Levitate AI, the assistant inside the Levitate Autonomous Experience Orchestration Platform. The platform's AI agents (Service, Sales, Care, Ops, Marketing) automatically detect and resolve customer problems across web, mobile, email, social, contact center, in-store and partner channels, with human-in-the-loop approval for high-risk actions.

LIVE PLATFORM STATE
- Autonomy mode: ${state.autonomy}
- Issues in flight: ${open}
- Awaiting human approval: ${held}
- Resolved this session: ${state.kpis.resolvedToday} (auto rate ${state.kpis.autoRate}%, value recovered $${state.kpis.valueRecovered}, predicted CSAT ${predictedCsat() ?? 'n/a'}%)
- Recent resolutions: ${resolved}

Help the operator understand and act on this state: summarize operations, explain agent decisions, flag churn risks, draft customer communications, and advise on guardrail tuning. Be sharp, specific and concise. Use **bold** sparingly for emphasis; plain paragraphs otherwise.`;
}

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
    const reply = await callClaude({max_tokens:1000, system:systemPrompt(), messages:chatHistory});
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
