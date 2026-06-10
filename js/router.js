// Show a view and highlight its sidebar item. `btn` overrides which sidebar
// item is highlighted (used by workstream shortcuts that all map to one view).
export function nav(id, btn){
  btn = btn || document.querySelector(`.sb-item[data-view="${id}"]`);
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='v-'+id));
  document.querySelectorAll('.sb-item').forEach(b=>b.classList.toggle('active', b===btn));
  if(window.innerWidth<=768) document.getElementById('sidebar').classList.remove('open');
}

export function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
}
