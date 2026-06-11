import {nav, toggleSidebar} from './router.js';
import {startEngine} from './engine.js';
import {initTower} from './views/tower.js';
import {initIssues} from './views/issues.js';
import {initApprovals} from './views/approvals.js';
import {initJourneys} from './views/journeys.js';
import {initCustomers} from './views/customers.js';
import {initChat} from './views/chat.js';
import {initGovernance} from './views/governance.js';
import {initValue} from './views/value.js';

document.getElementById('ham').addEventListener('click', toggleSidebar);

document.getElementById('sidebar').addEventListener('click', e=>{
  const btn = e.target.closest('.sb-item[data-view]');
  if(!btn) return;
  nav(btn.dataset.view, btn);
});

initTower();
initIssues();
initApprovals();
initJourneys();
initCustomers();
initChat();
initGovernance();
initValue();

startEngine();
