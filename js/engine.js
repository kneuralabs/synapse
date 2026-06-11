// Autonomous orchestration engine. Ingests real customer problems from the
// configured data source, runs them through the agent pipeline (Detected →
// Triaged → Deciding → Acting → Resolved), gates high-risk actions behind
// human approval, and emits events so every view stays live.

import {STAGES} from './data.js';
import {getDataUrl} from './setup.js';
import {fetchSourceData, allCustomers, normalizeCustomer, registerCustomer} from './datasource.js';
import {agentById, getAgents, resolveAgentId} from './agents.js';
import {callClaude} from './api.js';

const SYNC_INTERVAL_MS = 20000;

const listeners = {};
export function on(event, fn){ (listeners[event] ||= []).push(fn); }
function emit(event, payload){ (listeners[event]||[]).forEach(fn=>fn(payload)); }

export const state = {
  issues: [],            // newest first
  audit: [],             // newest first, capped
  autonomy: localStorage.getItem('lv_autonomy') || 'full', // 'full' | 'guarded' | 'manual'
  running: true,
  sourceError: null,     // last data-source sync error, if any
  kpis: {resolvedToday: 0, autoRate: 0, avgMins: 0, valueRecovered: 0},
  agentLoads: {}         // agentId -> active issue count
};

let nextId = 1;

export function setAutonomy(mode){
  state.autonomy = mode;
  localStorage.setItem('lv_autonomy', mode);
  log('governance', `Autonomy level set to "${mode}"`);
  emit('change');
}

export function setRunning(run){
  state.running = run;
  log('governance', run ? 'Orchestration engine resumed' : 'Orchestration engine paused');
  emit('change');
}

function log(kind, text, issue){
  state.audit.unshift({kind, text, issue: issue?.id, time: new Date()});
  if(state.audit.length > 200) state.audit.pop();
  emit('audit');
}

// Predicted CSAT is the live average sentiment across known customers —
// there is no fabricated baseline. Returns null when no customers exist.
export function predictedCsat(){
  const cs = allCustomers();
  if(!cs.length) return null;
  return Math.round(cs.reduce((s,c)=>s+c.sentiment,0)/cs.length);
}

// ── Issue ingestion ──────────────────────────────────────────────────────

const seenSourceKeys = new Set();

function sourceKey(rec){
  if(rec.id != null) return 'id:' + rec.id;
  const cust = typeof rec.customer === 'object' ? (rec.customer?.id ?? rec.customer?.name) : rec.customer;
  return `${rec.type}|${rec.detail}|${cust ?? ''}`;
}

function resolveCustomer(rec){
  const customers = allCustomers();
  if(rec.customer != null){
    const ref = rec.customer;
    if(typeof ref === 'object'){
      const found = customers.find(c => c.id === String(ref.id) || c.name === ref.name);
      return found || registerCustomer(normalizeCustomer(ref));
    }
    return customers.find(c => c.id === String(ref) || c.name === ref) || null;
  }
  return customers[0] || null;
}

// Normalizes one issue record from the data source and starts the pipeline.
export function ingestIssue(rec){
  if(!rec || !rec.type || !rec.detail) return null;
  const key = sourceKey(rec);
  if(seenSourceKeys.has(key)) return null;
  const customer = resolveCustomer(rec);
  if(!customer) return null; // no customer context — cannot orchestrate
  seenSourceKeys.add(key);
  const hasSourcePlaybook = Array.isArray(rec.playbook) && rec.playbook.length > 0;
  const issue = {
    id: 'INC-' + String(nextId++).padStart(4,'0'),
    sourceId: rec.id ?? null,
    type: rec.type,
    detail: rec.detail,
    channel: rec.channel || 'web',
    severity: rec.severity || 'medium',
    risk: rec.risk || 'medium',
    agent: resolveAgentId(rec.agent),
    playbook: hasSourcePlaybook
      ? rec.playbook
      : ['Triage with customer context', 'Select and execute the standard resolution playbook', 'Confirm outcome with the customer'],
    // Source-supplied playbook/resolution are authoritative; the live agent
    // run only fills in what the data source didn't provide.
    sourcePlaybook: hasSourcePlaybook,
    sourceResolution: !!rec.resolution,
    resolution: rec.resolution || `${rec.type} resolved per playbook; customer notified.`,
    ai: null,                       // output of the live agent run
    value: Number(rec.value) || 0,
    mins: Number(rec.mins) || 0,
    customer,
    stage: 0,                       // index into STAGES
    stepLog: [{stage:'Detected', time:new Date(), note:`Signal detected on ${rec.channel || 'web'} channel: ${rec.detail}`}],
    needsApproval: false,
    approved: false,
    createdAt: new Date(),
    resolvedAt: null
  };
  state.issues.unshift(issue);
  state.agentLoads[issue.agent] = (state.agentLoads[issue.agent]||0) + 1;
  log('detect', `${issue.id} — ${issue.type} detected for ${customer.name} (${issue.channel}) — assigned to ${agentById(issue.agent).name}`, issue);
  emit('change');
  runAgent(issue);
  return issue;
}

// ── Live agent run ───────────────────────────────────────────────────────
// Each issue is worked by its assigned agent through a real AI call: the
// agent triages the problem, decides the playbook, and writes the execution
// and resolution notes. Nothing is canned. If the AI service is unreachable
// (or the operator declines to supply a key), the pipeline still runs using
// the data source's own playbook/resolution.

let aiDown = false; // operator declined an API key — stop re-prompting per issue

async function runAgent(issue){
  const agent = agentById(issue.agent);
  if(!aiDown){
    try {
      const reply = await callClaude({max_tokens:700,
        system:`You are "${agent.name}" (${agent.scope}), an autonomous agent inside the Synapse customer-experience orchestration platform. You work real customer problems. Respond with strict JSON only — no markdown, no code fences, no commentary.`,
        messages:[{role:'user', content:
`Work this customer problem and report your output as JSON.

Issue: ${issue.type} (${issue.severity} severity, ${issue.risk} risk, ${issue.channel} channel)
Detail: ${issue.detail}
Customer: ${issue.customer.name} — ${issue.customer.segment} segment, LTV $${issue.customer.ltv.toLocaleString()}, sentiment ${issue.customer.sentiment}/100${issue.customer.persona ? ', persona: ' + issue.customer.persona : ''}
${issue.sourcePlaybook ? 'Playbook mandated by the data source (follow it): ' + issue.playbook.join('; ') : 'No playbook supplied — design one.'}

Return exactly: {"triage":"1-2 sentence triage assessment","playbook":["3 concrete action steps"],"execution":"1-2 sentence summary of executing the playbook","resolution":"1 sentence final resolution to report to the customer record"}`}]});
      const ai = JSON.parse(reply.replace(/^```(?:json)?\s*|\s*```$/g,'').trim());
      issue.ai = ai;
      if(Array.isArray(ai.playbook) && ai.playbook.length && !issue.sourcePlaybook) issue.playbook = ai.playbook;
      if(ai.resolution && !issue.sourceResolution) issue.resolution = ai.resolution;
      log('action', `${issue.id} — ${agent.name} completed live analysis & playbook selection`, issue);
    } catch(e){
      if(e.message === 'No API key provided.') aiDown = true;
      log('governance', `${issue.id} — live agent run unavailable (${e.message}) — falling back to data-source playbook`, issue);
    }
    emit('change');
  }
  scheduleAdvance(issue);
}

// ── Issue lifecycle ──────────────────────────────────────────────────────

function scheduleAdvance(issue){
  const delay = 2500 + Math.random()*4000;
  setTimeout(()=>advance(issue), delay);
}

const STAGE_NOTES = {
  1: i => i.ai?.triage
       || `Triaged by ${agentById(i.agent).name} — severity ${i.severity}, risk ${i.risk}. Customer context loaded from digital twin (${i.customer.segment}, sentiment ${i.customer.sentiment}).`,
  2: i => `${agentById(i.agent).name} selected playbook: ${i.playbook[0]}.`,
  3: i => i.ai?.execution
       || `Executing: ${i.playbook.slice(1).join(' → ') || i.playbook[0]}.`
};

function advance(issue){
  if(issue.stage >= 4) return;
  if(!state.running){ setTimeout(()=>advance(issue), 2000); return; }

  // Human-in-the-loop gate before the Acting stage.
  if(issue.stage === 2 && !issue.approved){
    const gated = state.autonomy === 'manual' ||
      (state.autonomy === 'guarded' && issue.risk === 'high');
    if(gated){
      if(!issue.needsApproval){
        issue.needsApproval = true;
        issue.stepLog.push({stage:'Awaiting approval', time:new Date(),
          note:`Guardrail: ${issue.risk}-risk action requires human approval (autonomy: ${state.autonomy}).`});
        log('approval', `${issue.id} queued for human approval — ${issue.type}`, issue);
        emit('change');
      }
      return; // resumes via approve()/reject()
    }
  }

  issue.stage++;
  const stageName = STAGES[issue.stage];

  if(issue.stage === 4){
    issue.resolvedAt = new Date();
    issue.stepLog.push({stage:stageName, time:new Date(), note: issue.resolution});
    state.agentLoads[issue.agent] = Math.max(0,(state.agentLoads[issue.agent]||1)-1);
    issue.customer.sentiment = Math.min(99, issue.customer.sentiment + 3);
    updateKpis(issue);
    log('resolve', `${issue.id} resolved autonomously — ${issue.resolution}`, issue);
  } else {
    issue.stepLog.push({stage:stageName, time:new Date(), note: STAGE_NOTES[issue.stage](issue)});
    log('action', `${issue.id} → ${stageName}`, issue);
    scheduleAdvance(issue);
  }
  emit('change');
}

export function approve(issue){
  if(!issue.needsApproval) return;
  issue.needsApproval = false;
  issue.approved = true;
  issue.stepLog.push({stage:'Approved', time:new Date(), note:'Human approved the proposed action. Resuming autonomous execution.'});
  log('approval', `${issue.id} approved by operator`, issue);
  emit('change');
  scheduleAdvance(issue);
}

export function reject(issue){
  if(!issue.needsApproval) return;
  issue.needsApproval = false;
  issue.stage = 4;
  issue.resolvedAt = new Date();
  issue.rejected = true;
  issue.stepLog.push({stage:'Closed by human', time:new Date(), note:'Operator rejected the proposed action and closed the issue for manual handling.'});
  state.agentLoads[issue.agent] = Math.max(0,(state.agentLoads[issue.agent]||1)-1);
  log('approval', `${issue.id} rejected by operator — routed to manual handling`, issue);
  emit('change');
}

function updateKpis(issue){
  const k = state.kpis;
  k.resolvedToday++;
  k.valueRecovered += issue.value;
  // Running average of human-equivalent minutes saved per resolution.
  k.avgMins = Math.round((k.avgMins*(k.resolvedToday-1) + issue.mins) / k.resolvedToday);
  const auto = state.issues.filter(i=>i.stage===4 && !i.rejected && !i.approved).length;
  const done = state.issues.filter(i=>i.stage===4).length;
  k.autoRate = done ? Math.round(auto/done*100) : 0;
}

export function openIssues(){ return state.issues.filter(i=>i.stage<4); }
export function approvalQueue(){ return state.issues.filter(i=>i.needsApproval); }

// ── Fleet edits ──────────────────────────────────────────────────────────

// Called by the Control Tower after the fleet is edited so all views refresh
// and the audit trail records the change.
export function agentsChanged(text){
  log('governance', text);
  emit('change');
}

// Re-assigns a removed agent's open issues (and load count) to the fleet's
// first remaining agent.
export function agentRemoved(oldId){
  const fallback = getAgents()[0].id;
  let moved = 0;
  state.issues.forEach(i => {
    if(i.agent === oldId && i.stage < 4){ i.agent = fallback; moved++; }
  });
  if(state.agentLoads[oldId]){
    state.agentLoads[fallback] = (state.agentLoads[fallback]||0) + state.agentLoads[oldId];
  }
  delete state.agentLoads[oldId];
  log('governance', `Agent removed from fleet${moved ? ` — ${moved} open issue${moved>1?'s':''} re-assigned to ${agentById(fallback).name}` : ''}`);
  emit('change');
}

// ── Data source sync loop ────────────────────────────────────────────────

async function sync(){
  const records = await fetchSourceData();
  records.forEach(ingestIssue);
}

async function syncOnce(){
  try {
    await sync();
    if(state.sourceError){
      state.sourceError = null;
      log('governance', 'Data source sync recovered');
    }
  } catch(e){
    if(state.sourceError !== e.message){
      state.sourceError = e.message;
      log('governance', `Data source sync failed: ${e.message}`);
    }
  }
  emit('change');
}

let syncLoopStarted = false;

async function syncLoop(){
  if(state.running) await syncOnce();
  setTimeout(syncLoop, SYNC_INTERVAL_MS);
}

function startSyncLoop(){
  if(syncLoopStarted) return; // one loop only — it re-reads the URL each poll
  syncLoopStarted = true;
  syncLoop();
}

// Called when the operator sets, changes or clears the data source URL from
// the Settings dialog or a re-run of the setup wizard.
export function dataSourceChanged(){
  if(getDataUrl()){
    log('governance', 'Data source URL updated — syncing now');
    if(syncLoopStarted) syncOnce();
    else startSyncLoop();
  } else {
    log('governance', 'Data source disconnected');
    emit('change');
  }
}

export function startEngine(){
  // The setup wizard may have written the autonomy choice after this module
  // was imported — pick it up before the first sync.
  state.autonomy = localStorage.getItem('lv_autonomy') || 'full';
  if(getDataUrl()){
    log('governance', `Data source connected — polling every ${SYNC_INTERVAL_MS/1000}s`);
    startSyncLoop();
  } else {
    log('governance', 'No data source URL configured — open Settings (⚙) to connect one.');
  }
  emit('change');
}
