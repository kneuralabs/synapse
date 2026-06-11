// Autonomous orchestration engine. Detects customer problems, runs them
// through the agent pipeline (Detected → Triaged → Deciding → Acting →
// Resolved) on timers, gates high-risk actions behind human approval, and
// emits events so every view stays live. Runs fully client-side.

import {STAGES} from './data.js';
import {getCustomers, getActiveTemplates} from './setup.js';

const listeners = {};
export function on(event, fn){ (listeners[event] ||= []).push(fn); }
function emit(event, payload){ (listeners[event]||[]).forEach(fn=>fn(payload)); }

export const state = {
  issues: [],            // newest first
  audit: [],             // newest first, capped
  autonomy: localStorage.getItem('lv_autonomy') || 'full', // 'full' | 'guarded' | 'manual'
  running: true,
  kpis: {resolvedToday: 0, autoRate: 0, avgMins: 0, valueRecovered: 0, csat: 91},
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

function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// ── Issue lifecycle ──────────────────────────────────────────────────────

export function spawnIssue(template){
  const templates = getActiveTemplates();
  const customers = getCustomers();
  if (!templates.length || !customers.length) return null;
  const t = template || rand(templates);
  const customer = rand(customers);
  const issue = {
    id: 'INC-' + String(nextId++).padStart(4,'0'),
    ...t,
    customer,
    stage: 0,                       // index into STAGES
    stepLog: [{stage:'Detected', time:new Date(), note:`Signal detected on ${t.channel} channel: ${t.detail}`}],
    needsApproval: false,
    approved: false,
    createdAt: new Date(),
    resolvedAt: null
  };
  state.issues.unshift(issue);
  state.agentLoads[t.agent] = (state.agentLoads[t.agent]||0) + 1;
  log('detect', `${issue.id} — ${t.type} detected for ${customer.name} (${t.channel})`, issue);
  emit('change');
  scheduleAdvance(issue);
  return issue;
}

function scheduleAdvance(issue){
  const delay = 2500 + Math.random()*4000;
  setTimeout(()=>advance(issue), delay);
}

const STAGE_NOTES = {
  1: i => `Triaged by ${i.agent} agent — severity ${i.severity}, risk ${i.risk}. Customer context loaded from digital twin (${i.customer.segment}, sentiment ${i.customer.sentiment}).`,
  2: i => `Decision engine selected playbook: ${i.playbook[0]}.`,
  3: i => `Executing: ${i.playbook.slice(1).join(' → ')}.`
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
  k.csat = Math.min(99, 88 + Math.round(k.resolvedToday/3));
}

export function openIssues(){ return state.issues.filter(i=>i.stage<4); }
export function approvalQueue(){ return state.issues.filter(i=>i.needsApproval); }

// ── Detection loop ───────────────────────────────────────────────────────

function detectLoop(){
  if(state.running && openIssues().length < 7) spawnIssue();
  setTimeout(detectLoop, 7000 + Math.random()*8000);
}

export function startEngine(){
  // The setup wizard may have written the autonomy choice after this module
  // was imported — pick it up before the first issue spawns.
  state.autonomy = localStorage.getItem('lv_autonomy') || 'full';
  spawnIssue();
  spawnIssue();
  setTimeout(()=>spawnIssue(), 1800);
  setTimeout(()=>spawnIssue(), 4200);
  setTimeout(detectLoop, 9000);
}
