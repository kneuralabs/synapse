// View router. Owns which view is on screen and lets other modules react to
// navigation — the view-lifecycle bridge (live.js) uses this so hidden views
// can skip rendering until the operator brings them on screen.

let currentView = 'map'; // matches the .view.active element in index.html
const navListeners = [];

export const getView = () => currentView;

// Subscribe to navigation. `fn` is called with the newly-active view id every
// time the operator switches views.
export function onNav(fn){ navListeners.push(fn); }

// Show a view and highlight its sidebar item. `btn` overrides which sidebar
// item is highlighted (used by workstream shortcuts that all map to one view).
export function nav(id, btn){
  btn = btn || document.querySelector(`.sb-item[data-view="${id}"]`);
  currentView = id;
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='v-'+id));
  document.querySelectorAll('.sb-item').forEach(b=>b.classList.toggle('active', b===btn));
  if(window.innerWidth<=768) document.getElementById('sidebar').classList.remove('open');
  navListeners.forEach(fn=>fn(id));
}

export function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
}
