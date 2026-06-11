// Autonomous orchestration engine. Ingests real customer problems from the
// configured data source, runs them through the agent pipeline (Detected →
// Triaged → Deciding → Acting → Resolved), gates high-risk actions behind
// human approval, and emits events so every view stays live.

import {STAGES} from './data.js';
import {getDataUrl} from './setup.js';
import {fetchSourceData, allCustomers, normalizeCustomer, registerCustomer} from './datasource.js';

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
  const issue = {
    id: 'INC-' + String(nextId++).padStart(4,'0'),
    sourceId: rec.id ?? null,
    type: rec.type,
    detail: rec.detail,
    channel: rec.channel || 'web',
    severity: rec.severity || 'medium',
    risk: rec.risk || 'medium',
    agent: rec.agent || 'service',
    playbook: Array.isArray(rec.playbook) && rec.playbook.length
      ? rec.playbook
      : ['Triage with customer context', 'Select and execute the standard resolution playbook', 'Confirm outcome with the customer'],
    resolution: rec.resolution || `${rec.type} resolved per playbook; customer notified.`,
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
  log('detect', `${issue.id} — ${issue.type} detected for ${customer.name} (${issue.channel})`, issue);
  emit('change');
  scheduleAdvance(issue);
  return issue;
}

// ── Issue lifecycle ──────────────────────────────────────────────────────

function scheduleAdvance(issue){
  const delay = 2500 + Math.random()*4000;
  setTimeout(()=>advance(issue), delay);
}

const STAGE_NOTES = {
  1: i => `Triaged by ${i.agent} agent — severity ${i.severity}, risk ${i.risk}. Customer context loaded from digital twin (${i.customer.segment}, sentiment ${i.customer.sentiment}).`,
  2: i => `Decision engine selected playbook: ${i.playbook[0]}.`,
  3: i => `Executing: ${i.playbook.slice(1).join(' → ') || i.playbook[0]}.`
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

// ── Data source sync loop ────────────────────────────────────────────────

async function sync(){
  const records = await fetchSourceData();
  records.forEach(ingestIssue);
}

async function syncLoop(){
  if(state.running){
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
  setTimeout(syncLoop, SYNC_INTERVAL_MS);
}

export function startEngine(){
  // The setup wizard may have written the autonomy choice after this module
  // was imported — pick it up before the first sync.
  state.autonomy = localStorage.getItem('lv_autonomy') || 'full';
  if(getDataUrl()){
    log('governance', `Data source connected — polling every ${SYNC_INTERVAL_MS/1000}s`);
    syncLoop();
  } else {
    log('governance', 'No data source URL configured — re-run setup to connect one.');
  }
  emit('change');
}
