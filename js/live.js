// View-lifecycle bridge between the engine event bus and the view layer.
//
// The engine emits `change`/`audit` on every pipeline tick (per issue, every
// few seconds) and every data-source sync. Re-rendering all eight views on
// each tick — including the ones the operator can't see — makes per-tick DOM
// work scale with the number of views rather than with what's on screen.
//
// `liveView` gates a view's full re-render on visibility: it runs the render
// only while its view is active, and once when the operator navigates to it so
// a view hidden during earlier ticks catches up the moment it's shown. This
// keeps rendering proportional to the single visible view, not the whole app.

import {on} from './engine.js';
import {getView, onNav} from './router.js';

// Registers `render` as the live renderer for `viewId`. It runs:
//   • immediately, for the initial paint,
//   • on every engine `event` while `viewId` is the active view,
//   • once whenever the operator navigates to `viewId` (catch-up after being
//     hidden through earlier ticks).
// `event` defaults to the engine's high-frequency `change`; pass `audit` for
// renderers that only track the audit trail.
export function liveView(viewId, render, event = 'change'){
  on(event, () => { if(getView() === viewId) render(); });
  onNav(id => { if(id === viewId) render(); });
  render();
}
