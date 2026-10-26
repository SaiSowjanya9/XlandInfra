import { asLocalDate, bucketScale } from './collectionTrend.js';

/**
 * The Estimate Trend's three series — direct, property-based and work-order estimates — counted
 * over the window its dropdown asks for.
 *
 * The buckets used to be months whatever the window was, so "This Week" and "This Month" each
 * collapsed to a single bucket, and a line needs two points: with `dot={false}` that lone point is
 * a path with nothing to stroke, so two of the six dropdown options drew an empty frame over a
 * correct axis — it read as missing data. The single bucket "This Week" did produce was labelled
 * with the whole month ("Oct 2026") while holding only seven days of estimates, so making it
 * visible without rebucketing would have published a wrong figure instead of no figure.
 *
 * The window now decides the bucket: by day where it spans a month or less, by month beyond it.
 * That is the same rule, and the same `bucketScale`, as the Collection Trend and the estimate
 * margin trend, so the three charts bucket and label time identically.
 *
 * Regression test: node --test admin-portal/src/utils/estimateTrend.test.js
 */

/**
 * The lines, and the keys a bucket starts at zero.
 *
 * `other` is the catch-all, and it is what keeps the chart honest: `estimate_type` also allows
 * `custom` (the service-catalog builder writes it), and a value outside the three named ones used
 * to be counted by no line at all while the Total Estimates card counted it — the card and the
 * chart would have disagreed with nothing on screen to explain the difference. The dashboard draws
 * the `other` line only when something lands in it.
 */
export const TREND_SERIES = ['direct', 'property', 'workOrder', 'other'];

/**
 * Where a dropdown period starts. `null` is "All Time", which starts at the earliest estimate.
 *
 * The dashboard's own period filter calls this too, so the two can never disagree: the buckets
 * must span at least what the filter admits, or an estimate is counted in and then dropped for
 * want of a bucket.
 *
 * Deliberately not `RANGE_STARTS` from collectionTrend.js — that one's week is six days and its
 * six-month key is `sixmonths`, where this dashboard reaches seven days back and calls it `half`.
 * Agreeing with the filter beside it matters more than sharing the table.
 */
export const periodStart = (period, now = new Date()) => {
  switch (period) {
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      return start;
    }
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter': return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    case 'half': return new Date(now.getFullYear(), now.getMonth() - 5, 1);
    case 'year': return new Date(now.getFullYear(), 0, 1);
    default: return null;
  }
};

/**
 * `rows` are `{ at, series }`: when the estimate was created, and which line it belongs to — a
 * series outside `TREND_SERIES` (a `custom` catalog estimate, say) is carried by no line and is
 * counted by none.
 *
 * Every bucket in the window is returned, empty ones included, so a quiet day reads as a gap
 * rather than as missing data. No estimates at all is an empty series, which the chart answers
 * with its "No data" panel rather than with a flat line along zero.
 */
export const estimateTrendBuckets = (rows = [], period = 'all', now = new Date()) => {
  const dated = rows
    .map(row => ({ at: asLocalDate(row?.at), series: row?.series }))
    .filter(row => !Number.isNaN(row.at.getTime()));
  if (!dated.length) return [];

  const times = dated.map(row => row.at.getTime());
  const start = periodStart(period, now) ?? new Date(Math.min(...times));
  // To today, or to the latest estimate where that is later: a future-dated estimate belongs on
  // the chart rather than off the end of it.
  const end = new Date(Math.max(now.getTime(), ...times));
  if (end < start) return [];

  const { keyOf, keys } = bucketScale(start, end);
  const zeroes = Object.fromEntries(TREND_SERIES.map(series => [series, 0]));
  const buckets = new Map(keys.map(bucket => [bucket.key, { key: bucket.key, name: bucket.label, ...zeroes }]));
  for (const row of dated) {
    const bucket = buckets.get(keyOf(row.at));
    // A series no line carries is still counted, in `other`: an estimate the dashboard totals and
    // the chart silently drops is the one failure this function exists to prevent
    if (bucket) bucket[TREND_SERIES.includes(row.series) ? row.series : 'other'] += 1;
  }
  return [...buckets.values()];
};
