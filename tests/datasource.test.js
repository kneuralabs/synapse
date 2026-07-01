// normalizeCustomer is the boundary that turns arbitrary data-source records
// into the shape the whole app assumes — its defaulting/coercion is the thing
// most worth pinning.
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCustomer} from '../js/datasource.js';

test('fills defaults for a sparse record', () => {
  const c = normalizeCustomer({name: 'Jane'});
  assert.equal(c.name, 'Jane');
  assert.equal(c.segment, 'Standard');
  assert.equal(c.ltv, 0);
  assert.equal(c.tenure, '—');
  assert.equal(c.channelPref, 'web');
  assert.equal(c.journey, 'Support');
  assert.equal(c.sentiment, 70);
  assert.equal(c.persona, '');
  assert.equal(typeof c.id, 'string');
});

test('falls back to a placeholder name when none is supplied', () => {
  assert.equal(normalizeCustomer({}).name, 'Unknown customer');
});

test('coerces and clamps numeric fields', () => {
  assert.equal(normalizeCustomer({name: 'A', ltv: '2500'}).ltv, 2500);
  assert.equal(normalizeCustomer({name: 'A', sentiment: 250}).sentiment, 100);
  assert.equal(normalizeCustomer({name: 'A', sentiment: -10}).sentiment, 0);
  assert.equal(normalizeCustomer({name: 'A', sentiment: 'bad'}).sentiment, 70);
});

test('preserves a supplied id, coerced to a string', () => {
  assert.equal(normalizeCustomer({id: 7, name: 'A'}).id, '7');
});

test('synthesizes a distinct id when none is given', () => {
  const a = normalizeCustomer({name: 'A'});
  const b = normalizeCustomer({name: 'B'});
  assert.match(a.id, /^C-R\d+$/);
  assert.notEqual(a.id, b.id);
});
