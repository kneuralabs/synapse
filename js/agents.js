// Agent fleet configuration. Fully editable at runtime from the Control
// Tower — changes are stored in localStorage so tweaks survive reloads.

const KEY = 'snps_agents';

export const DEFAULT_AGENTS = [
  {id:'service',   name:'Service Agent',   scope:'Issue resolution & support',     color:'#6C7FFF'},
  {id:'sales',     name:'Sales Agent',     scope:'Conversion & retention offers',  color:'#4FFFB0'},
  {id:'care',      name:'Care Agent',      scope:'Sentiment & proactive outreach', color:'#FFD97D'},
  {id:'ops',       name:'Ops Agent',       scope:'Fulfilment & system actions',    color:'#FF6B6B'},
  {id:'marketing', name:'Marketing Agent', scope:'Personalization & campaigns',    color:'#A78BFA'}
];

export function getAgents(){
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) && list.length ? list : DEFAULT_AGENTS;
  } catch { return DEFAULT_AGENTS; }
}

function save(list){ localStorage.setItem(KEY, JSON.stringify(list)); }

export function agentById(id){
  const list = getAgents();
  return list.find(a => a.id === id) || list[0];
}

// Maps a data-source agent reference (id or display name) to a valid agent id.
export function resolveAgentId(ref){
  const list = getAgents();
  const a = list.find(x => x.id === ref || x.name === ref) || list[0];
  return a.id;
}

export function addAgent({name, scope, color}){
  const list = getAgents().slice();
  let id = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'agent';
  while(list.some(a => a.id === id)) id += '-2';
  const agent = {id, name, scope, color};
  list.push(agent);
  save(list);
  return agent;
}

export function updateAgent(id, patch){
  save(getAgents().map(a => a.id === id ? {...a, ...patch, id} : a));
}

// Refuses to remove the last agent — the pipeline needs someone to assign to.
export function removeAgent(id){
  const list = getAgents();
  if(list.length <= 1) return false;
  save(list.filter(a => a.id !== id));
  return true;
}
