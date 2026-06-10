import {API_PROXY, MODEL} from './config.js';

function getApiKey(){
  let key = localStorage.getItem('anthropic_api_key');
  if(!key){
    key = window.prompt('Enter your Anthropic API key.\nIt is stored only in this browser (localStorage) and sent only to api.anthropic.com.');
    if(key) localStorage.setItem('anthropic_api_key', key.trim());
  }
  return key ? key.trim() : null;
}

export async function callClaude(body){
  const url = API_PROXY || 'https://api.anthropic.com/v1/messages';
  const headers = {'Content-Type':'application/json'};
  if(!API_PROXY){
    const key = getApiKey();
    if(!key) throw new Error('No API key provided.');
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
    // Required for browser-origin requests; the name is a deliberate warning
    // that keys in browsers are visible to end users — use API_PROXY in prod.
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  let res;
  try {
    res = await fetch(url, {method:'POST', headers, body:JSON.stringify({model:MODEL, ...body})});
  } catch(e) {
    throw new Error('Network error — could not reach the AI service.');
  }
  const data = await res.json().catch(()=>null);
  if(!res.ok){
    if(res.status===401) localStorage.removeItem('anthropic_api_key'); // bad key — re-prompt next time
    throw new Error(data?.error?.message || `AI service error (HTTP ${res.status})`);
  }
  const text = data?.content?.find(b=>b.type==='text')?.text;
  if(!text) throw new Error('The model returned an empty response.');
  return text;
}
