import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthsSinceEarliest, trendSpanLabel } from './trendSpan.js';

test('All Time runs from the first record month to the current month', () => {
  const now = new Date(2026, 9, 25);
  assert.equal(monthsSinceEarliest(['2026-05-14T10:00:00Z', '2026-09-01'], now), 6, 'May to Oct');
  assert.equal(monthsSinceEarliest(['2025-12-31T12:00:00'], now), 11, 'across a year boundary');
  assert.equal(monthsSinceEarliest([], now), 6, 'nothing recorded falls back');
  assert.equal(monthsSinceEarliest(['nope', null], now, 3), 3);
  assert.equal(monthsSinceEarliest(['2027-01-01'], now), 1, 'a future record never shrinks the span');
});

test('the chart states its span once, not month by month', () => {
  assert.equal(trendSpanLabel([{ name: 'May 2026' }, { name: 'Jun 2026' }, { name: 'Oct 2026' }]), 'May 2026 – Oct 2026');
  assert.equal(trendSpanLabel([{ label: 'Oct 2026' }], 'label'), 'Oct 2026');
  assert.equal(trendSpanLabel([]), '');
});
