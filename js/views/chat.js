import {callClaude} from '../api.js';
import {esc, mdLite, errorHtml} from '../utils.js';
import {state, openAssets, approvalQueue, estateHealth} from '../engine.js';
import {sensName} from '../labels.js';
import {getScanners} from '../scanners.js';

const chatHistory = [];
let chatBusy = false;

// Built fresh per message so the assistant always sees live platform state.
function systemPrompt(){
  const open = openAssets().map(a=>`${a.id} ${a.name} (${a.assetType}, ${sensName(a.sensitivity)}, ${a.exposure}) in ${a.source.name}`).join('; ') || 'none';
  const held = approvalQueue().map(a=>`${a.id} ${a.name} (risk ${a.risk}, ${sensName(a.sensitivity)})`).join('; ') || 'none';
  const governed = state.assets.filter(a=>a.stage===4).slice(0,8).map(a=>`${a.id} ${a.name} → ${sensName(a.sensitivity)}`).join('; ') || 'none yet';
  const fleet = getScanners().map(s=>`${s.name} (${s.scope})`).join(', ');
  return `You are Synapse AI, the assistant inside the Synapse Unified Data Governance, Security & Compliance platform. The platform's autonomous scanners — ${fleet} — discover, classify, label and govern data assets across databases, data lakes, warehouses, SaaS apps, file shares, event streams and AI/Copilot surfaces, with steward approval for high-risk remediations.

LIVE PLATFORM STATE
- Autonomy mode: ${state.autonomy}
- Assets in the pipeline: ${open}
- Awaiting steward approval: ${held}
- Governed this session: ${state.kpis.governedToday} (auto-classification rate ${state.kpis.autoRate}%, exposure remediated $${state.kpis.exposureProtected}, estate health ${estateHealth() ?? 'n/a'}%)
- Recently governed: ${governed}

Help the steward understand and act on this state: summarize scans, explain classifications, flag over-shared or high-risk assets, assess exposure to regulations (GDPR, HIPAA, PCI-DSS, ISO 27001, SOC 2, NIST), draft DPIAs and policies, and advise on guardrail tuning. Be sharp, specific and concise. Use **bold** sparingly for emphasis; plain paragraphs otherwise.`;
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
    thinkingEl.querySelector('.msg-bubble').innerHTML = errorHtml(e.message);
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
  el.innerHTML = `<div class="msg-av">${role==='ai'?'S':'K'}</div><div class="msg-bubble">${html}</div>`;
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
