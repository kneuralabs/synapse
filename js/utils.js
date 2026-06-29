export function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Escape model output, then render the minimal markdown subset we prompt for.
export function mdLite(text){
  return esc(text).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>');
}

export function toast(msg, dur=3000){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), dur);
}

// ── Display formatters ─────────────────────────────────────────────────────
// Single source of truth for how money and timestamps render across views, so
// formatting stays consistent and null/NaN inputs never reach the DOM.

export function fmtMoney(n){
  return '$' + (Number(n) || 0).toLocaleString();
}

const HH_MM     = {hour:'2-digit', minute:'2-digit'};
const HH_MM_SS  = {hour:'2-digit', minute:'2-digit', second:'2-digit'};

export const fmtTime    = d => d.toLocaleTimeString([], HH_MM);
export const fmtTimeSec = d => d.toLocaleTimeString([], HH_MM_SS);
