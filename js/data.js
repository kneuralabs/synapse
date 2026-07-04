// Static reference data for Synapse — Unified Data Governance, Security &
// Compliance. Everything the platform *governs* (assets, sources, classifications)
// comes from the connected data source; this file holds only the fixed
// vocabulary the engine and views classify against.

// Kinds of system an asset can live in. `icon` is used on the Data Map source
// grid and in the catalog; `id` is what a data-source record's `type` maps to.
export const SOURCE_TYPES = [
  {id:'sql',       name:'Azure SQL',    icon:'🗄️'},
  {id:'lake',      name:'Data Lake',    icon:'🌊'},
  {id:'warehouse', name:'Warehouse',    icon:'🏛️'},
  {id:'saas',      name:'SaaS App',     icon:'☁️'},
  {id:'files',     name:'File Share',   icon:'📁'},
  {id:'stream',    name:'Event Stream', icon:'📡'},
  {id:'ai',        name:'AI / Copilot', icon:'✦'}
];

// The governance pipeline every asset flows through. Indexes are load-bearing:
// the human-in-the-loop gate sits before "Labeled" (the first stage that
// mutates the asset — applying a restrictive label or restricting access).
export const STAGES = ['Discovered','Scanned','Classified','Labeled','Governed'];

// Microsoft-Information-Protection-style sensitivity labels, most → least
// sensitive. `rank` orders them; the engine never down-labels below what a
// scan warrants.
export const SENSITIVITY = [
  {id:'restricted',        name:'Restricted',          rank:4},
  {id:'confidential-high', name:'Highly Confidential', rank:3},
  {id:'confidential',      name:'Confidential',        rank:2},
  {id:'general',           name:'General',             rank:1},
  {id:'public',            name:'Public',              rank:0}
];

const SENS_BY_ID   = new Map(SENSITIVITY.map(s => [s.id, s]));
const SENS_BY_NAME = new Map(SENSITIVITY.map(s => [s.name.toLowerCase(), s]));

// Resolves a label reference (id or display name, any case) to a canonical
// sensitivity record, or null when it matches nothing we know.
export function sensitivityOf(ref){
  if(!ref) return null;
  return SENS_BY_ID.get(ref) || SENS_BY_NAME.get(String(ref).toLowerCase()) || null;
}

// Sensitive information types the classifiers look for inside an asset.
export const SIT = [
  'Email Address','Person Name','Phone Number','National ID','Passport Number',
  'Credit Card Number','Bank Account','IP Address','Health Record','API Key / Secret'
];

// Governance policies the engine enforces (the Purview "policy" analog). These
// are the guardrails shown on Audit & Policy and the reason high-risk
// remediations are held for a steward.
export const POLICIES = [
  {name:'Auto-restrict over-shared Highly Confidential data', policy:'Steward approval required'},
  {name:'Records disposition & purge',                        policy:'Steward approval required'},
  {name:'PII masked in every catalog preview',                policy:'Zero-trust — always enforced'},
  {name:'Cross-border transfer of regulated data',            policy:'Blocked pending DPIA'},
  {name:'DSPM for AI — sensitive data in Copilot prompts',    policy:'Scanned & logged on every access'},
  {name:'Payment data (PCI-DSS scope)',                       policy:'Tokenized · quarterly access review'}
];

// Compliance frameworks scored on the Compliance view. Readiness is derived
// live from how much in-scope data is actually governed — see views/value.js.
export const FRAMEWORKS = [
  {id:'gdpr',  name:'GDPR',       full:'EU General Data Protection Regulation'},
  {id:'hipaa', name:'HIPAA',      full:'US Health data protection'},
  {id:'pci',   name:'PCI-DSS',    full:'Payment Card Industry Data Security Standard'},
  {id:'iso',   name:'ISO 27001',  full:'Information Security Management'},
  {id:'soc2',  name:'SOC 2',      full:'Service Organization Control 2'},
  {id:'nist',  name:'NIST 800-53',full:'US federal security controls'}
];
