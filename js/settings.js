// Settings dialog (⚙ in the topbar). Lets the operator input or change the
// data source URL and AI service URL at any time — not just during the
// first-run setup wizard — and re-run the wizard itself.

import {getDataUrl, setDataUrl, getApiProxy, setApiProxy, runSetupWizard, applyOrgToUI} from './setup.js';
import {dataSourceChanged} from './engine.js';
import {toast} from './utils.js';

const overlay = () => document.getElementById('settings-overlay');

function open(){
  document.getElementById('set-data-url').value = getDataUrl();
  document.getElementById('set-api-url').value = getApiProxy();
  overlay().classList.add('active');
}

function close(){ overlay().classList.remove('active'); }

function save(){
  const prev = getDataUrl();
  const url = document.getElementById('set-data-url').value.trim();
  setDataUrl(url);
  setApiProxy(document.getElementById('set-api-url').value.trim());
  close();
  if(url !== prev) dataSourceChanged(); // starts/refreshes the sync immediately
  toast(url ? 'Settings saved — data feed scanning.' : 'Settings saved.');
}

export function initSettings(){
  document.getElementById('btn-settings').addEventListener('click', open);
  document.getElementById('set-cancel').addEventListener('click', close);
  document.getElementById('set-save').addEventListener('click', save);
  overlay().addEventListener('click', e => { if(e.target === overlay()) close(); });
  document.getElementById('set-rerun').addEventListener('click', ()=>{
    close();
    runSetupWizard(()=>{ applyOrgToUI(); dataSourceChanged(); });
  });
}
