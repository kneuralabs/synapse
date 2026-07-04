// Shared presentation helpers for data assets — the sensitivity label pill,
// asset-type glyph and classification chips are rendered in several views, so
// they live here as the single source of truth.

import {esc} from './utils.js';
import {sensitivityOf} from './data.js';

const ASSET_ICONS = {
  table:'🗃️', file:'📄', dataset:'📊', report:'📈',
  stream:'📡', model:'🤖', view:'🔎'
};

export const assetIcon = type => ASSET_ICONS[type] || '📦';

export const sensName = id => (sensitivityOf(id)?.name) || 'Unclassified';

// A colored sensitivity-label pill. Renders a muted "Unclassified" chip when
// the asset hasn't been labeled yet.
export function sensPill(id){
  const s = sensitivityOf(id);
  const cls = s ? 'sl-' + s.id : 'sl-none';
  return `<span class="slabel ${cls}">${esc(s ? s.name : 'Unclassified')}</span>`;
}

// Renders a list of sensitive-information-type classifications as chips.
export function classChips(list){
  if(!Array.isArray(list) || !list.length) return '';
  return `<div class="proj-ws">${list.map(c=>`<span class="ws-pill">${esc(c)}</span>`).join('')}</div>`;
}
