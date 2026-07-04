// Scanner fleet configuration. These are the classification / governance
// engines that work each asset through the pipeline. Fully editable at runtime
// from the Data Map — changes are stored in localStorage so tweaks survive
// reloads.

const KEY = 'snps_scanners';

export const DEFAULT_SCANNERS = [
  {id:'classifier', name:'Classification Scanner', scope:'PII · PHI · PCI detection',            color:'#6C7FFF'},
  {id:'labeler',    name:'Sensitivity Labeler',    scope:'Applies MIP sensitivity labels',       color:'#4FFFB0'},
  {id:'lineage',    name:'Lineage Mapper',         scope:'Discovers upstream / downstream flow', color:'#FFD97D'},
  {id:'dlp',        name:'DLP & Access Governor',  scope:'Over-share & exfiltration control',    color:'#FF6B6B'},
  {id:'lifecycle',  name:'Lifecycle Engine',       scope:'Retention · records · disposition',    color:'#A78BFA'}
];

export function getScanners(){
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) && list.length ? list : DEFAULT_SCANNERS;
  } catch { return DEFAULT_SCANNERS; }
}

function save(list){ localStorage.setItem(KEY, JSON.stringify(list)); }

export function scannerById(id){
  const list = getScanners();
  return list.find(s => s.id === id) || list[0];
}

// Maps a data-source scanner reference (id or display name) to a valid id.
export function resolveScannerId(ref){
  const list = getScanners();
  const s = list.find(x => x.id === ref || x.name === ref) || list[0];
  return s.id;
}

export function addScanner({name, scope, color}){
  const list = getScanners().slice();
  let id = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'scanner';
  while(list.some(s => s.id === id)) id += '-2';
  const scanner = {id, name, scope, color};
  list.push(scanner);
  save(list);
  return scanner;
}

export function updateScanner(id, patch){
  save(getScanners().map(s => s.id === id ? {...s, ...patch, id} : s));
}

// Refuses to remove the last scanner — the pipeline needs one to assign to.
export function removeScanner(id){
  const list = getScanners();
  if(list.length <= 1) return false;
  save(list.filter(s => s.id !== id));
  return true;
}
