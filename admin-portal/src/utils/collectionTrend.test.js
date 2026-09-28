import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectionTrendBuckets } from './collectionTrend.js';

/**
 * The chart that showed an empty frame: a fixed last-30-days window of which only the last 15 were
 * drawn, so invoices three weeks old fell off the end of it.
 */

const now = new Date('2026-09-28T10:00:00');
const source = {
  invoices: [{ date: '2026-09-09', amount: 56050 }, { date: '2026-09-09', amount: 8968 }, { date: '2026-06-02', amount: 10000 }],
  payments: [{ date: '2026-09-09', amount: 56050 }]
};

test('all time reaches back to the earliest activity, in months once it spans more than one', () => {
  const buckets = collectionTrendBuckets(source, 'all', now);
  // June through September, none missing
  assert.deepEqual(buckets.map(bucket => bucket.key), ['2026-06', '2026-07', '2026-08', '2026-09']);
  assert.equal(buckets[0].invoiceAmount, 10000);
  assert.equal(buckets[1].invoiceAmount, 0, 'a month with nothing in it is still a bucket');
  assert.equal(buckets[3].invoiceAmount, 65018);
  assert.equal(buckets[3].collectedAmount, 56050);
});

test('a range of a month or less is bucketed by day, and the 9th is one of them', () => {
  const month = collectionTrendBuckets(source, 'month', now);
  assert.equal(month.length, 28, 'the 1st to the 28th');
  assert.equal(month[0].key, '2026-09-01');
  const ninth = month.find(bucket => bucket.key === '2026-09-09');
  assert.equal(ninth.invoiceAmount, 65018, 'the figures that used to fall outside the window');
  assert.equal(ninth.collectedAmount, 56050);
  // Nothing from June leaks into a September range
  assert.equal(month.reduce((total, bucket) => total + bucket.invoiceAmount, 0), 65018);
});

test('this week holds seven days and excludes what came before it', () => {
  const week = collectionTrendBuckets(source, 'week', now);
  assert.equal(week.length, 7);
  assert.deepEqual([week[0].key, week[6].key], ['2026-09-22', '2026-09-28']);
  assert.equal(week.reduce((total, bucket) => total + bucket.invoiceAmount, 0), 0, 'the 9th is not this week');
});

test('month buckets step by month even from a 31st, and the axis covers a future-dated invoice', () => {
  // Stepping from the 31st with setMonth lands in the month after next, dropping a bucket
  const fromThe31st = collectionTrendBuckets(
    { invoices: [{ date: '2026-01-31', amount: 500 }] }, 'all', new Date('2026-04-15T10:00:00'));
  assert.deepEqual(fromThe31st.map(bucket => bucket.key), ['2026-01', '2026-02', '2026-03', '2026-04']);

  const future = collectionTrendBuckets(
    { invoices: [{ date: '2026-12-10', amount: 700 }] }, 'year', new Date('2026-09-28T10:00:00'));
  assert.equal(future[future.length - 1].key, '2026-12');
  assert.equal(future[future.length - 1].invoiceAmount, 700);
});

test('no activity at all is an empty series, and an unparseable date is ignored', () => {
  assert.deepEqual(collectionTrendBuckets({ invoices: [], payments: [] }, 'all', now), []);
  assert.deepEqual(collectionTrendBuckets(undefined, 'all', now), []);
  assert.deepEqual(collectionTrendBuckets({ invoices: [{ date: 'not a date', amount: 5 }] }, 'all', now), []);
});
