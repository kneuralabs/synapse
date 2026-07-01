// Pure presentation helpers. These run in Node because nothing in utils.js
// touches the DOM at import time (only inside toast/shake bodies, unused here).
import test from 'node:test';
import assert from 'node:assert/strict';
import {esc, mdLite, errorHtml, fmtMoney} from '../js/utils.js';

test('esc escapes HTML-significant characters', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});

test('esc coerces non-strings', () => {
  assert.equal(esc(42), '42');
  assert.equal(esc(null), 'null');
});

test('mdLite renders the prompted markdown subset', () => {
  assert.equal(mdLite('**hi**'), '<strong>hi</strong>');
  assert.equal(mdLite('a\n\nb'), 'a<br><br>b');
  assert.equal(mdLite('a\nb'), 'a<br>b');
});

test('mdLite escapes HTML before applying markdown (no injection)', () => {
  assert.equal(mdLite('<img src=x onerror=1>'), '&lt;img src=x onerror=1&gt;');
  assert.match(mdLite('<script>alert(1)</script>'), /^&lt;script&gt;/);
});

test('fmtMoney prefixes with $ and groups the value', () => {
  const out = fmtMoney(1234);
  assert.ok(out.startsWith('$'));
  assert.equal(out.replace(/[^\d]/g, ''), '1234'); // separator-agnostic
});

test('fmtMoney defends against null/NaN inputs', () => {
  assert.equal(fmtMoney(0), '$0');
  assert.equal(fmtMoney(null), '$0');
  assert.equal(fmtMoney(undefined), '$0');
  assert.equal(fmtMoney('nope'), '$0');
});

test('errorHtml escapes the message so error text can never inject markup', () => {
  assert.equal(errorHtml('<x>'), '<span style="color:var(--accent)">&lt;x&gt;</span>');
});
