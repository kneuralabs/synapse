// The timeout guard is the whole point of net.js, so it gets the most coverage.
// globalThis.fetch is stubbed per-test and restored, so nothing hits the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWithTimeout, DEFAULT_TIMEOUT_MS} from '../js/net.js';

test('exposes a positive default timeout', () => {
  assert.equal(typeof DEFAULT_TIMEOUT_MS, 'number');
  assert.ok(DEFAULT_TIMEOUT_MS > 0);
});

test('resolves with the response and hands fetch an un-aborted signal', async () => {
  const orig = globalThis.fetch;
  let seenSignal;
  globalThis.fetch = async (url, opts) => { seenSignal = opts.signal; return {ok: true, status: 200, url}; };
  try {
    const res = await fetchWithTimeout('https://x.test/feed', {headers: {Accept: 'application/json'}}, 1000);
    assert.equal(res.ok, true);
    assert.equal(res.url, 'https://x.test/feed');
    assert.ok(seenSignal instanceof AbortSignal);
    assert.equal(seenSignal.aborted, false);
  } finally {
    globalThis.fetch = orig;
  }
});

test('rejects with AbortError when the request outlasts the timeout', async () => {
  const orig = globalThis.fetch;
  // A fetch that only settles when its signal aborts — models a hung endpoint.
  globalThis.fetch = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener('abort', () => {
      const err = new Error('The operation was aborted.');
      err.name = 'AbortError';
      reject(err);
    });
  });
  try {
    await assert.rejects(
      fetchWithTimeout('https://x.test/hang', {}, 20),
      err => err.name === 'AbortError'
    );
  } finally {
    globalThis.fetch = orig;
  }
});

test('a fast response is not aborted by the timer', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({ok: true, status: 204});
  try {
    const res = await fetchWithTimeout('https://x.test/ok', {}, 50);
    assert.equal(res.status, 204);
  } finally {
    globalThis.fetch = orig;
  }
});
