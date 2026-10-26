import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTrendBuckets, periodStart } from './estimateTrend.js';

/**
 * The chart that drew an empty frame: "This Week" and "This Month" bucketed by month like every
 * other period, so each was a single point — and a line between one point is nothing at all.
 *
 * The assertions are on `key`, not on `name`: a day's label comes from `toLocaleDateString`, which
 * is the host's ICU to format, not ours to pin.
 */

const now = new Date('2026-10-26T12:00:00');
const rows = [
  { at: '2026-09-15T11:57:55', series: 'property' },
  { at: '2026-10-20T09:00:00', series: 'direct' },
  { at: '2026-10-26T08:30:00', series: 'direct' },
  { at: '2026-10-26T09:30:00', series: 'workOrder' },
  // A catalog estimate: its type is on none of the three named lines
  { at: '2026-10-26T10:30:00', series: 'custom' }
];

test('all time runs from the earliest estimate, by month once it spans more than one', () => {
  const buckets = estimateTrendBuckets(rows, 'all', now);
  assert.deepEqual(buckets.map(bucket => bucket.key), ['2026-09', '2026-10']);
  assert.equal(buckets[1].name, 'Oct 2026');
  assert.deepEqual(
    [buckets[0].property, buckets[0].direct, buckets[0].workOrder, buckets[0].other], [1, 0, 0, 0]);
  assert.deepEqual(
    [buckets[1].direct, buckets[1].workOrder, buckets[1].property, buckets[1].other], [2, 1, 0, 1],
    'the custom estimate is counted as other, never dropped');
});

test('every estimate lands somewhere, whatever its type', () => {
  const odd = [
    { at: '2026-10-20T09:00:00', series: 'custom' },
    { at: '2026-10-20T09:00:00', series: undefined },
    { at: '2026-10-20T09:00:00', series: 'a type nobody has added a line for' }
  ];
  const buckets = estimateTrendBuckets(odd, 'all', now);
  const counted = buckets.reduce((total, bucket) =>
    total + bucket.direct + bucket.property + bucket.workOrder + bucket.other, 0);
  assert.equal(counted, odd.length, 'the chart must total what the summary card totals');
});

test('this week is seven days of buckets, not one point labelled with the month', () => {
  const week = estimateTrendBuckets(rows, 'week', now);
  assert.equal(week.length, 8, 'the 19th through the 26th');
  assert.deepEqual([week[0].key, week[7].key], ['2026-10-19', '2026-10-26']);
  assert.equal(week.find(bucket => bucket.key === '2026-10-20').direct, 1);
  assert.equal(week.find(bucket => bucket.key === '2026-10-26').direct, 1);
  assert.equal(week.reduce((total, bucket) => total + bucket.property, 0), 0, 'September is not this week');
});

test('this month is a bucket a day from the 1st', () => {
  const month = estimateTrendBuckets(rows, 'month', now);
  assert.equal(month.length, 26);
  assert.deepEqual([month[0].key, month[25].key], ['2026-10-01', '2026-10-26']);
  assert.equal(month.reduce((total, bucket) => total + bucket.direct, 0), 2);
});

test('a quarter stays monthly and a year starts in January, not thirteen months back', () => {
  assert.deepEqual(estimateTrendBuckets(rows, 'quarter', now).map(bucket => bucket.key),
    ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(estimateTrendBuckets(rows, 'half', now).map(bucket => bucket.key),
    ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  assert.deepEqual(estimateTrendBuckets(rows, 'year', now).map(bucket => bucket.key),
    ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
      '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
});

test('an estimate on the window edge still has a bucket to land in', () => {
  // The dashboard filter admits `created_at >= start`, so the scale has to reach back that far or
  // the estimate is counted in and then dropped
  const edge = [{ at: new Date(2026, 9, 19, 12, 0, 0), series: 'direct' }];
  const week = estimateTrendBuckets(edge, 'week', now);
  assert.equal(week[0].key, '2026-10-19');
  assert.equal(week[0].direct, 1);
});

test('nothing in the window is an empty series, and an unparseable date is ignored', () => {
  assert.deepEqual(estimateTrendBuckets([], 'all', now), []);
  assert.deepEqual(estimateTrendBuckets(undefined, 'week', now), []);
  assert.deepEqual(estimateTrendBuckets([{ at: 'not a date', series: 'direct' }], 'all', now), []);
});

test('the period start mirrors the dashboard filter exactly', () => {
  assert.equal(periodStart('all', now), null);
  assert.equal(periodStart('anything else', now), null);
  assert.deepEqual(periodStart('month', now), new Date(2026, 9, 1));
  assert.deepEqual(periodStart('quarter', now), new Date(2026, 7, 1));
  assert.deepEqual(periodStart('half', now), new Date(2026, 4, 1));
  assert.deepEqual(periodStart('year', now), new Date(2026, 0, 1));
  assert.equal(Math.round((now - periodStart('week', now)) / 86400000), 7);
});
