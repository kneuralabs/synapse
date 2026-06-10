import {nav, toggleSidebar} from './router.js';
import {selectWS} from './views/strategy.js';
import {initDashboard} from './views/dashboard.js';
import {initStrategy} from './views/strategy.js';
import {initProjects} from './views/projects.js';
import {initChat} from './views/chat.js';
import {initDocs} from './views/docs.js';

document.getElementById('ham').addEventListener('click', toggleSidebar);

document.getElementById('sidebar').addEventListener('click', e=>{
  const btn = e.target.closest('.sb-item[data-view]');
  if(!btn) return;
  nav(btn.dataset.view, btn);
  if(btn.dataset.ws) selectWS(btn.dataset.ws);
});

initDashboard();
initStrategy();
initProjects();
initChat();
initDocs();
