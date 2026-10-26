import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { monthsSinceEarliest, trendSpanLabel, trendDot } from './trendSpan.js';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const jsxFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? jsxFiles(full) : (entry.name.endsWith('.jsx') ? [full] : []);
});

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

test('a single bucket shows its dot; a longer span keeps the clean line', () => {
  assert.deepEqual(trendDot([{ name: 'Oct 2026' }]), { r: 3 });
  assert.equal(trendDot([{ name: 'Sep 2026' }, { name: 'Oct 2026' }]), false);
  assert.equal(trendDot([]), false);
  assert.equal(trendDot(undefined), false);
});

/**
 * One point is a path that moves the pen and closes -- "M10,20Z" -- which strokes nothing, so a
 * series with dots switched off disappears whenever its window holds a single bucket. The Estimate
 * Trend did that for "This Week" and "This Month"; every trend still can on the 1st of a month or
 * on a deployment whose first record is today. `trendDot` answers `false` for every longer span,
 * so routing the prop through it costs those charts nothing.
 */
test('no chart series hard-codes dot={false}', () => {
  const offenders = jsxFiles(srcDir)
    .filter(file => fs.readFileSync(file, 'utf8').includes('dot={false}'))
    .map(file => path.relative(srcDir, file));
  assert.deepEqual(offenders, [],
    `dot={false} is invisible at one bucket -- pass dot={trendDot(rows)} instead:\n${offenders.join('\n')}`);
});
