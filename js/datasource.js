// Real-data integration. Every data source, asset and lineage flow the
// platform governs comes from the data source URL configured in setup (or from
// sources entered manually in the wizard) — nothing is simulated or invented
// client-side.
//
// The endpoint must return JSON in one of two shapes:
//   1. An object: { "sources": [...], "assets": [...], "flows": [...] }
//   2. A bare array of asset records.
//
// Asset record:   { id?, name, assetType?, source?, path?, format?, rows?,
//                   classifications?, sensitivity?, risk?, exposure?, glossary?,
//                   playbook?, resolution?, value?, mins?, scanner? }
//                  `source` may be a source id, a name, or an inline source
//                  record.
// Source record:  { id?, name, type?, domain?, owner?, health?, description? }
// Flow record:    { name, stages?, health?, nba? }

import {getDataUrl, getSources} from './setup.js';
import {fetchWithTimeout} from './net.js';

let _flows = [];
let _remoteSources = [];
let _srcSeq = 1;

export const getFlows = () => _flows;

// Sources entered in the setup wizard plus sources from the data source.
export function allSources(){
  const local = getSources();
  const ids = new Set(local.map(s => s.id));
  return local.concat(_remoteSources.filter(s => !ids.has(s.id)));
}

// Adds a source discovered inline on an asset record so the Data Map and
// estate-health metric see it too.
export function registerSource(s){
  if(!_remoteSources.some(x => x.id === s.id)) _remoteSources.push(s);
  return s;
}

export function normalizeSource(s){
  return {
    id:          String(s.id ?? 'SRC-R' + _srcSeq++),
    name:        s.name || 'Unknown source',
    type:        s.type || 'sql',
    domain:      s.domain || 'Unclassified',
    owner:       s.owner || 'Unassigned',
    health:      Math.min(100, Math.max(0, Number(s.health) || 60)),
    description: s.description || ''
  };
}

// Fetches the configured data source and returns its asset records. Sources and
// flows found in the payload are cached for the getters above.
export async function fetchSourceData(){
  const url = getDataUrl();
  if(!url) return [];
  let res;
  try {
    res = await fetchWithTimeout(url, {headers:{'Accept':'application/json'}});
  } catch(e) {
    throw new Error(e.name === 'AbortError'
      ? 'Data source timed out — no response in time.'
      : 'Network error — could not reach the data source.');
  }
  if(!res.ok) throw new Error(`Data source returned HTTP ${res.status}`);
  const data = await res.json().catch(()=>{ throw new Error('Data source did not return valid JSON.'); });
  if(Array.isArray(data)) return data;
  if(Array.isArray(data.sources)){
    // The payload is authoritative, but keep sources registered inline from
    // asset records that the sources array doesn't (or no longer) lists.
    const fetched = data.sources.map(normalizeSource);
    const ids = new Set(fetched.map(s => s.id));
    _remoteSources = fetched.concat(_remoteSources.filter(s => !ids.has(s.id)));
  }
  if(Array.isArray(data.flows)) _flows = data.flows.filter(f => f && f.name);
  return Array.isArray(data.assets) ? data.assets : [];
}
