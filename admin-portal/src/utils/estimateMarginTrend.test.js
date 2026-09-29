import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateMarginBuckets, estimateMarginSummary, estimatesInRange } from './estimateMarginTrend.js';

/**
 * The panel that was a table: it listed every estimate's margin and could not say whether the
 * margin was improving. These are the figures behind the trend that replaced it.
 */

const now = new Date('2026-09-28T10:00:00');
// Two costed estimates in September, one in July, and one typed entirely by hand (no cost at all)
const rows = [
  { estimateId: 'EST-1', createdAt: '2026-09-09', vendorCost: 108000, operatingCost: 0, actualCost: 108000, customerPrice: 150300 },
  { estimateId: 'EST-2', createdAt: '2026-09-20T16:30:00', vendorCost: 20000, operatingCost: 5000, actualCost: 25000, customerPrice: 40000 },
  { estimateId: 'EST-3', createdAt: '2026-07-04', vendorCost: 10000, operatingCost: 0, actualCost: 10000, customerPrice: 12000 },
  { estimateId: 'EST-4', createdAt: '2026-09-21', vendorCost: 0, operatingCost: 0, actualCost: 0, customerPrice: 10000 }
];

test('the whole set is bucketed by month, and a quiet month is still a bucket', () => {
  const buckets = estimateMarginBuckets(rows, {}, now);
  assert.deepEqual(buckets.map(bucket => bucket.key), ['2026-07', '2026-08', '2026-09']);
  assert.equal(buckets[1].estimateCount, 0, 'August is a gap, not a missing column');
  assert.equal(buckets[1].marginPercent, null, 'a bucket with nothing in it breaks the line');
  assert.equal(buckets[2].vendorCost, 128000);
  assert.equal(buckets[2].operatingCost, 5000);
  assert.equal(buckets[2].customerPrice, 190300);
  assert.equal(buckets[2].profit, 57300);
  assert.equal(buckets[2].marginPercent, 30.11);
});

test('an estimate with no cost behind it is counted but never averaged in', () => {
  const september = estimateMarginBuckets(rows, { from: '2026-09-01', to: '2026-09-30' }, now)
    .find(bucket => bucket.key === '2026-09-21');
  assert.equal(september.estimateCount, 1, 'the hand-typed estimate is still there');
  assert.equal(september.costedCount, 0);
  assert.equal(september.customerPrice, 0, 'a price with no cost would report a 100% margin');
  const summary = estimateMarginSummary(rows);
  assert.equal(summary.estimateCount, 4);
  assert.equal(summary.uncostedCount, 1);
  assert.equal(summary.customerPrice, 202300, 'the ₹10,000 uncosted estimate is left out');
  // ₹2,02,300 sold against ₹1,43,000 of cost
  assert.equal(summary.actualCost, 143000);
  assert.equal(summary.marginPercent, 29.31);
});

test('a calendar range is bucketed by day and holds every day in it', () => {
  const buckets = estimateMarginBuckets(rows, { from: '2026-09-01', to: '2026-09-30' }, now);
  assert.equal(buckets.length, 30);
  assert.equal(buckets[0].key, '2026-09-01');
  assert.equal(buckets.at(-1).key, '2026-09-30', 'the axis runs to the end of the range, not to today');
  assert.equal(buckets.find(bucket => bucket.key === '2026-09-09').customerPrice, 150300);
  // July is outside the range and contributes nothing
  assert.equal(buckets.reduce((total, bucket) => total + bucket.customerPrice, 0), 190300);
});

test('the range keeps an estimate raised late on its last day', () => {
  const inRange = estimatesInRange(rows, { from: '2026-09-20', to: '2026-09-20' });
  assert.deepEqual(inRange.map(row => row.estimateId), ['EST-2'], '16:30 on the closing date is inside it');
  assert.deepEqual(estimatesInRange(rows, { from: '2026-09-10' }).map(row => row.estimateId), ['EST-2', 'EST-4']);
  assert.deepEqual(estimatesInRange(rows, { to: '2026-08-01' }).map(row => row.estimateId), ['EST-3']);
  assert.equal(estimatesInRange(rows, {}).length, 4, 'no calendar means everything');
});

test('nothing to plot is an empty series rather than an empty axis', () => {
  assert.deepEqual(estimateMarginBuckets([], {}, now), []);
  assert.deepEqual(estimateMarginBuckets([{ estimateId: 'X', createdAt: null }], {}, now), []);
  assert.equal(estimateMarginSummary([]).marginPercent, null);
  // A range that ends before it starts draws nothing at all
  assert.deepEqual(estimateMarginBuckets(rows, { from: '2026-09-30', to: '2026-09-01' }, now), []);
});
