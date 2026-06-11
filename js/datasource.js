// Real-data integration. All customers, issues and journeys come from the
// data source URL configured in setup (or from customers entered manually in
// the wizard) — nothing is simulated or invented client-side.
//
// The endpoint must return JSON in one of two shapes:
//   1. An object: { "customers": [...], "issues": [...], "journeys": [...] }
//   2. A bare array of issue records.
//
// Issue record:    { id?, type, detail, channel?, severity?, risk?, agent?,
//                    playbook?, resolution?, value?, mins?, customer? }
//                  `customer` may be a customer id, a name, or an inline
//                  customer record.
// Customer record: { id?, name, segment?, ltv?, tenure?, channelPref?,
//                    journey?, sentiment?, persona? }
// Journey record:  { name, stages?, health?, nba? }

import {getDataUrl, getCustomers} from './setup.js';

let _journeys = [];
let _remoteCustomers = [];
let _custSeq = 1;

export const getJourneys = () => _journeys;

// Customers entered in the setup wizard plus customers from the data source.
export function allCustomers(){
  const local = getCustomers();
  const ids = new Set(local.map(c => c.id));
  return local.concat(_remoteCustomers.filter(c => !ids.has(c.id)));
}

// Adds a customer discovered inline on an issue record so Customer 360 and
// CSAT see them too.
export function registerCustomer(c){
  if(!_remoteCustomers.some(x => x.id === c.id)) _remoteCustomers.push(c);
  return c;
}

export function normalizeCustomer(c){
  return {
    id:          String(c.id ?? 'C-R' + _custSeq++),
    name:        c.name || 'Unknown customer',
    segment:     c.segment || 'Standard',
    ltv:         Number(c.ltv) || 0,
    tenure:      c.tenure || '—',
    channelPref: c.channelPref || 'web',
    journey:     c.journey || 'Support',
    sentiment:   Math.min(100, Math.max(0, Number(c.sentiment) || 70)),
    persona:     c.persona || ''
  };
}

// Fetches the configured data source and returns its issue records.
// Customers and journeys found in the payload are cached for the getters above.
export async function fetchSourceData(){
  const url = getDataUrl();
  if(!url) return [];
  let res;
  try {
    res = await fetch(url, {headers:{'Accept':'application/json'}});
  } catch {
    throw new Error('Network error — could not reach the data source.');
  }
  if(!res.ok) throw new Error(`Data source returned HTTP ${res.status}`);
  const data = await res.json().catch(()=>{ throw new Error('Data source did not return valid JSON.'); });
  if(Array.isArray(data)) return data;
  if(Array.isArray(data.customers)){
    // The payload is authoritative, but keep customers registered inline from
    // issue records that the customers array doesn't (or no longer) lists.
    const fetched = data.customers.map(normalizeCustomer);
    const ids = new Set(fetched.map(c => c.id));
    _remoteCustomers = fetched.concat(_remoteCustomers.filter(c => !ids.has(c.id)));
  }
  if(Array.isArray(data.journeys))  _journeys = data.journeys.filter(j => j && j.name);
  return Array.isArray(data.issues) ? data.issues : [];
}
