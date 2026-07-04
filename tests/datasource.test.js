// normalizeSource is the boundary that turns arbitrary data-source records
// into the shape the whole app assumes — its defaulting/coercion is the thing
// most worth pinning.
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSource} from '../js/datasource.js';

test('fills defaults for a sparse record', () => {
  const s = normalizeSource({name: 'Sales DB'});
  assert.equal(s.name, 'Sales DB');
  assert.equal(s.type, 'sql');
  assert.equal(s.domain, 'Unclassified');
  assert.equal(s.owner, 'Unassigned');
  assert.equal(s.health, 60);
  assert.equal(s.description, '');
  assert.equal(typeof s.id, 'string');
});

test('falls back to a placeholder name when none is supplied', () => {
  assert.equal(normalizeSource({}).name, 'Unknown source');
});

test('coerces and clamps the health field', () => {
  assert.equal(normalizeSource({name: 'A', health: '85'}).health, 85);
  assert.equal(normalizeSource({name: 'A', health: 250}).health, 100);
  assert.equal(normalizeSource({name: 'A', health: -10}).health, 0);
  assert.equal(normalizeSource({name: 'A', health: 'bad'}).health, 60);
});

test('preserves a supplied id, coerced to a string', () => {
  assert.equal(normalizeSource({id: 7, name: 'A'}).id, '7');
});

test('synthesizes a distinct id when none is given', () => {
  const a = normalizeSource({name: 'A'});
  const b = normalizeSource({name: 'B'});
  assert.match(a.id, /^SRC-R\d+$/);
  assert.notEqual(a.id, b.id);
});
