// Network layer. A single, timeout-guarded wrapper around `fetch` shared by
// every outbound request (the data-source poller and the Claude API client).
//
// Why this exists: `fetch` has no built-in timeout. A connection that opens
// but never responds — a dead endpoint behind a load balancer, a hung proxy,
// a throttled network — leaves the returned promise pending forever. That is
// not a hypothetical here:
//   • the engine's sync loop `await`s each poll before scheduling the next, so
//     one hung request stalls ingestion permanently, with no recovery;
//   • the AI chat / deep-dive leave their spinner running and (for chat) keep
//     `chatBusy` latched, blocking all further input.
// Bounding every request with an AbortController turns those silent hangs into
// a normal, surfaced error the callers already know how to report.

export const DEFAULT_TIMEOUT_MS = 15000;

// Runs `fetch(url, options)` but aborts it after `timeoutMs`. On timeout the
// promise rejects with an AbortError (`err.name === 'AbortError'`), which
// callers can distinguish from other network faults to tailor their message.
//
// The timeout covers connection + response headers (it is cleared the moment
// `fetch` resolves), matching the standard AbortSignal-timeout pattern; reading
// the body is the caller's concern.
export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {...options, signal: controller.signal});
  } finally {
    clearTimeout(timer);
  }
}
