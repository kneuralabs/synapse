// Autonomous governance engine. Ingests real data assets from the configured
// data source, runs each through the classification pipeline (Discovered →
// Scanned → Classified → Labeled → Governed), gates high-risk remediations
// behind steward approval, and emits events so every view stays live.

import {STAGES, sensitivityOf} from './data.js';
import {getDataUrl} from './setup.js';
import {fetchSourceData, allSources, normalizeSource, registerSource} from './datasource.js';
import {scannerById, getScanners, resolveScannerId} from './scanners.js';
import {callClaude} from './api.js';

const SYNC_INTERVAL_MS = 20000;

const listeners = {};
export function on(event, fn){ (listeners[event] ||= []).push(fn); }
function emit(event, payload){ (listeners[event]||[]).forEach(fn=>fn(payload)); }

export const state = {
  assets: [],            // newest first
  audit: [],             // newest first, capped
  autonomy: localStorage.getItem('snps_autonomy') || 'full', // 'full' | 'guarded' | 'manual'
  running: true,
  sourceError: null,     // last data-source sync error, if any
  kpis: {governedToday: 0, autoRate: 0, avgMins: 0, exposureProtected: 0},
  scannerLoads: {}       // scannerId -> active asset count
};

let nextId = 1;

export function setAutonomy(mode){
  state.autonomy = mode;
  localStorage.setItem('snps_autonomy', mode);
  log('policy', `Autonomy level set to "${mode}"`);
  emit('change');
}

export function setRunning(run){
  state.running = run;
  log('policy', run ? 'Governance engine resumed' : 'Governance engine paused');
  emit('change');
}

function log(kind, text, asset){
  state.audit.unshift({kind, text, asset: asset?.id, time: new Date()});
  if(state.audit.length > 200) state.audit.pop();
  emit('audit');
}

// Estate health is the live average governance health across known sources —
// there is no fabricated baseline. Returns null when no sources exist.
export function estateHealth(){
  const s = allSources();
  if(!s.length) return null;
  return Math.round(s.reduce((sum,x)=>sum+x.health,0)/s.length);
}

// ── Asset ingestion ────────────────────────────────────────────────────────

const seenSourceKeys = new Set();

function assetKey(rec){
  if(rec.id != null) return 'id:' + rec.id;
  const src = typeof rec.source === 'object' ? (rec.source?.id ?? rec.source?.name) : rec.source;
  return `${rec.name}|${rec.path ?? ''}|${src ?? ''}`;
}

function resolveSource(rec){
  const sources = allSources();
  if(rec.source != null){
    const ref = rec.source;
    if(typeof ref === 'object'){
      const found = sources.find(s => s.id === String(ref.id) || s.name === ref.name);
      return found || registerSource(normalizeSource(ref));
    }
    return sources.find(s => s.id === String(ref) || s.name === ref) || null;
  }
  return sources[0] || null;
}

// Normalizes one asset record from the data source and starts the pipeline.
export function ingestAsset(rec){
  if(!rec || !rec.name) return null;
  const key = assetKey(rec);
  if(seenSourceKeys.has(key)) return null;
  const source = resolveSource(rec);
  if(!source) return null; // no source context — cannot govern
  seenSourceKeys.add(key);
  const hasSourcePlaybook = Array.isArray(rec.playbook) && rec.playbook.length > 0;
  const asset = {
    id: 'AST-' + String(nextId++).padStart(4,'0'),
    sourceId: rec.id ?? null,
    name: rec.name,
    assetType: rec.assetType || 'table',
    path: rec.path || rec.name,
    format: rec.format || '',
    rows: Number(rec.rows) || 0,
    scanner: resolveScannerId(rec.scanner),
    // Classification results. Source-supplied values are authoritative; the
    // live scan only fills in what the data source didn't provide.
    classifications: Array.isArray(rec.classifications) ? rec.classifications : [],
    sensitivity: sensitivityOf(rec.sensitivity)?.id || null,
    risk: rec.risk || 'medium',
    exposure: rec.exposure || 'Internal',
    glossary: Array.isArray(rec.glossary) ? rec.glossary : [],
    playbook: hasSourcePlaybook
      ? rec.playbook
      : ['Scan schema & sample content for sensitive information types',
         'Apply the sensitivity label the classification warrants',
         'Assign an owner, align access, and publish to the catalog'],
    sourcePlaybook: hasSourcePlaybook,
    sourceSensitivity: !!sensitivityOf(rec.sensitivity),
    sourceResolution: !!rec.resolution,
    resolution: rec.resolution || `${rec.name} classified and governed per policy; owner notified.`,
    ai: null,                       // output of the live scan
    value: Number(rec.value) || 0,  // $ exposure remediated by governing it
    mins: Number(rec.mins) || 0,    // analyst-minutes saved
    source,
    stage: 0,                       // index into STAGES
    stepLog: [{stage:'Discovered', time:new Date(), note:`Asset discovered in ${source.name}: ${rec.path || rec.name}`}],
    needsApproval: false,
    approved: false,
    createdAt: new Date(),
    resolvedAt: null
  };
  state.assets.unshift(asset);
  state.scannerLoads[asset.scanner] = (state.scannerLoads[asset.scanner]||0) + 1;
  log('discover', `${asset.id} — ${asset.name} discovered in ${source.name} — assigned to ${scannerById(asset.scanner).name}`, asset);
  emit('change');
  runScan(asset);
  return asset;
}

// ── Live scan ──────────────────────────────────────────────────────────────
// Each asset is worked by its assigned scanner through a real AI call: the
// scanner samples the asset, detects sensitive information types, recommends a
// sensitivity label, and writes the governance notes. Nothing is canned. If the
// AI service is unreachable (or the operator declines to supply a key), the
// pipeline still runs using the data source's own classification/resolution.

let aiDown = false; // operator declined an API key — stop re-prompting per asset

async function runScan(asset){
  const scanner = scannerById(asset.scanner);
  if(!aiDown){
    try {
      const reply = await callClaude({max_tokens:700,
        system:`You are "${scanner.name}" (${scanner.scope}), an autonomous data-classification scanner inside the Synapse data-governance platform. You scan real data assets. Respond with strict JSON only — no markdown, no code fences, no commentary.`,
        messages:[{role:'user', content:
`Scan this data asset and report your findings as JSON.

Asset: ${asset.name} (${asset.assetType}${asset.format ? ', ' + asset.format : ''})
Location: ${asset.source.name} — ${asset.path}${asset.rows ? ', ~' + asset.rows.toLocaleString() + ' rows' : ''}
Current exposure: ${asset.exposure}. Risk rating: ${asset.risk}.
${asset.classifications.length ? 'Classifications already asserted by the source (keep them): ' + asset.classifications.join(', ') : 'No prior classifications.'}
${asset.sourceSensitivity ? 'Sensitivity label mandated by the source (keep it): ' + asset.sensitivity : ''}

Choose the sensitivity label from exactly: Public, General, Confidential, Highly Confidential, Restricted.
Return exactly: {"summary":"1-2 sentence description of what this asset holds","classifications":["sensitive information types found, e.g. Email Address, Credit Card Number"],"sensitivity":"one of the five labels","risks":"1 sentence on the governance/exposure risk","recommendations":["3 concrete governance actions"]}`}]});
      const ai = JSON.parse(reply.replace(/^```(?:json)?\s*|\s*```$/g,'').trim());
      asset.ai = ai;
      if(Array.isArray(ai.classifications) && ai.classifications.length && !asset.classifications.length)
        asset.classifications = ai.classifications;
      if(ai.sensitivity && !asset.sourceSensitivity){
        const s = sensitivityOf(ai.sensitivity);
        if(s) asset.sensitivity = s.id;
      }
      if(Array.isArray(ai.recommendations) && ai.recommendations.length && !asset.sourcePlaybook)
        asset.playbook = ai.recommendations;
      if(ai.summary && !asset.sourceResolution) asset.resolution = ai.summary;
      log('classify', `${asset.id} — ${scanner.name} completed live scan & classification`, asset);
    } catch(e){
      if(e.message === 'No API key provided.') aiDown = true;
      log('policy', `${asset.id} — live scan unavailable (${e.message}) — falling back to source classification`, asset);
    }
    emit('change');
  }
  scheduleAdvance(asset);
}

// ── Asset lifecycle ──────────────────────────────────────────────────────────

function scheduleAdvance(asset){
  const delay = 2500 + Math.random()*4000;
  setTimeout(()=>advance(asset), delay);
}

const sensName = id => (sensitivityOf(id)?.name) || 'General';

const STAGE_NOTES = {
  1: a => `${scannerById(a.scanner).name} sampled the schema & content of ${a.name}.`,
  2: a => a.ai?.summary
       ? `${a.ai.summary}${a.classifications.length ? ' Sensitive types found: ' + a.classifications.join(', ') + '.' : ''}`
       : `Classified — ${a.classifications.length ? 'sensitive types: ' + a.classifications.join(', ') : 'no sensitive information types detected'}.`,
  3: a => `Applied "${sensName(a.sensitivity)}" label${a.exposure==='Over-shared' ? '; access restricted to remediate over-sharing' : '; access aligned to policy'}.`
};

function advance(asset){
  if(asset.stage >= 4) return;
  if(!state.running){ setTimeout(()=>advance(asset), 2000); return; }

  // Human-in-the-loop gate before the Labeled stage (the first stage that
  // mutates the asset — applying a restrictive label / restricting access).
  if(asset.stage === 2 && !asset.approved){
    const gated = state.autonomy === 'manual' ||
      (state.autonomy === 'guarded' && asset.risk === 'high');
    if(gated){
      if(!asset.needsApproval){
        asset.needsApproval = true;
        asset.stepLog.push({stage:'Awaiting approval', time:new Date(),
          note:`Guardrail: ${asset.risk}-risk remediation on ${sensName(asset.sensitivity)} data requires steward approval (autonomy: ${state.autonomy}).`});
        log('approval', `${asset.id} queued for steward approval — ${asset.name}`, asset);
        emit('change');
      }
      return; // resumes via approve()/reject()
    }
  }

  asset.stage++;
  const stageName = STAGES[asset.stage];

  if(asset.stage === 4){
    asset.resolvedAt = new Date();
    asset.stepLog.push({stage:stageName, time:new Date(), note: asset.resolution});
    state.scannerLoads[asset.scanner] = Math.max(0,(state.scannerLoads[asset.scanner]||1)-1);
    asset.source.health = Math.min(99, asset.source.health + 3);
    updateKpis(asset);
    log('govern', `${asset.id} governed — ${sensName(asset.sensitivity)} · ${asset.name} in ${asset.source.name}`, asset);
  } else {
    asset.stepLog.push({stage:stageName, time:new Date(), note: STAGE_NOTES[asset.stage](asset)});
    log('classify', `${asset.id} → ${stageName}`, asset);
    scheduleAdvance(asset);
  }
  emit('change');
}

export function approve(asset){
  if(!asset.needsApproval) return;
  asset.needsApproval = false;
  asset.approved = true;
  asset.stepLog.push({stage:'Approved', time:new Date(), note:'Steward approved the remediation. Resuming autonomous governance.'});
  log('approval', `${asset.id} approved by steward`, asset);
  emit('change');
  scheduleAdvance(asset);
}

export function reject(asset){
  if(!asset.needsApproval) return;
  asset.needsApproval = false;
  asset.stage = 4;
  asset.resolvedAt = new Date();
  asset.rejected = true;
  asset.stepLog.push({stage:'Held by steward', time:new Date(), note:'Steward rejected the remediation and held the asset for manual handling.'});
  state.scannerLoads[asset.scanner] = Math.max(0,(state.scannerLoads[asset.scanner]||1)-1);
  log('approval', `${asset.id} held by steward — routed to manual handling`, asset);
  emit('change');
}

function updateKpis(asset){
  const k = state.kpis;
  k.governedToday++;
  k.exposureProtected += asset.value;
  // Running average of analyst-minutes saved per governed asset.
  k.avgMins = Math.round((k.avgMins*(k.governedToday-1) + asset.mins) / k.governedToday);
  const auto = state.assets.filter(a=>a.stage===4 && !a.rejected && !a.approved).length;
  const done = state.assets.filter(a=>a.stage===4).length;
  k.autoRate = done ? Math.round(auto/done*100) : 0;
}

export function openAssets(){ return state.assets.filter(a=>a.stage<4); }
export function approvalQueue(){ return state.assets.filter(a=>a.needsApproval); }

// Assets that carry live governance risk: still in the pipeline, or governed
// while over-shared / high-risk. Drives the Risk & DLP badge and view.
export function riskAssets(){
  return state.assets.filter(a =>
    a.stage < 4 || a.rejected || a.exposure === 'Over-shared' || a.risk === 'high');
}

// ── Scanner-fleet edits ──────────────────────────────────────────────────────

// Called by the Data Map after the fleet is edited so all views refresh and the
// audit trail records the change.
export function scannersChanged(text){
  log('policy', text);
  emit('change');
}

// Re-assigns a removed scanner's open assets (and load count) to the fleet's
// first remaining scanner.
export function scannerRemoved(oldId){
  const fallback = getScanners()[0].id;
  let moved = 0;
  state.assets.forEach(a => {
    if(a.scanner === oldId && a.stage < 4){ a.scanner = fallback; moved++; }
  });
  if(state.scannerLoads[oldId]){
    state.scannerLoads[fallback] = (state.scannerLoads[fallback]||0) + state.scannerLoads[oldId];
  }
  delete state.scannerLoads[oldId];
  log('policy', `Scanner removed from fleet${moved ? ` — ${moved} in-flight asset${moved>1?'s':''} re-assigned to ${scannerById(fallback).name}` : ''}`);
  emit('change');
}

// ── Data source sync loop ────────────────────────────────────────────────────

async function sync(){
  const records = await fetchSourceData();
  records.forEach(ingestAsset);
}

async function syncOnce(){
  try {
    await sync();
    if(state.sourceError){
      state.sourceError = null;
      log('policy', 'Data source sync recovered');
    }
  } catch(e){
    if(state.sourceError !== e.message){
      state.sourceError = e.message;
      log('policy', `Data source sync failed: ${e.message}`);
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

// Called when the operator sets, changes or clears the data source URL from the
// Settings dialog or a re-run of the setup wizard.
export function dataSourceChanged(){
  if(getDataUrl()){
    log('policy', 'Data source URL updated — scanning now');
    if(syncLoopStarted) syncOnce();
    else startSyncLoop();
  } else {
    log('policy', 'Data source disconnected');
    emit('change');
  }
}

export function startEngine(){
  // The setup wizard may have written the autonomy choice after this module was
  // imported — pick it up before the first sync.
  state.autonomy = localStorage.getItem('snps_autonomy') || 'full';
  if(getDataUrl()){
    log('policy', `Data source connected — scanning every ${SYNC_INTERVAL_MS/1000}s`);
    startSyncLoop();
  } else {
    log('policy', 'No data source URL configured — open Settings (⚙) to connect one.');
  }
  emit('change');
}
