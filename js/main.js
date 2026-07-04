import {nav, toggleSidebar} from './router.js';
import {startEngine} from './engine.js';
import {initMap} from './views/tower.js';
import {initRisks} from './views/issues.js';
import {initApprovals} from './views/approvals.js';
import {initLineage} from './views/journeys.js';
import {initCatalog} from './views/customers.js';
import {initChat} from './views/chat.js';
import {initGovernance} from './views/governance.js';
import {initCompliance} from './views/value.js';
import {isSetupDone, runSetupWizard, applyOrgToUI} from './setup.js';
import {initSettings} from './settings.js';

document.getElementById('ham').addEventListener('click', toggleSidebar);

document.getElementById('sidebar').addEventListener('click', e=>{
  const btn = e.target.closest('.sb-item[data-view]');
  if(!btn) return;
  nav(btn.dataset.view, btn);
});

initMap();
initRisks();
initApprovals();
initLineage();
initCatalog();
initChat();
initGovernance();
initCompliance();
initSettings();

if (isSetupDone()) {
  applyOrgToUI();
  startEngine();
} else {
  runSetupWizard(() => startEngine());
}
