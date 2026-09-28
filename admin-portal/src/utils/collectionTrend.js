/**
 * The Collection Trend series: invoiced and collected amounts, bucketed over the range its dropdown
 * asks for.
 *
 * It used to be a fixed last-30-days window of which only the last 15 were drawn, so a dashboard
 * whose invoices were three weeks old showed an empty frame with an axis -- and the "All Time"
 * dropdown beside it was decorative. The range now decides the window, and the window decides the
 * bucket: by day where it spans a month or less, by month beyond that, so a year is twelve bars
 * rather than three hundred and sixty-five.
 *
 * Every bucket in the range is returned, including empty ones, so a month with no collections reads
 * as a gap rather than as missing data.
 */

/**
 * An invoice date is a calendar date, not an instant. `new Date('2026-09-09')` is UTC midnight, so
 * reading its local day gives the 8th anywhere west of UTC and the invoice lands in the wrong
 * bucket. A date-only string is therefore built as a local date; anything with a time in it is left
 * to the usual parser.
 */
const asLocalDate = (value) => {
  if (value instanceof Date) return value;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  return dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
};

// Month arithmetic has to be done on the first of the month: stepping from the 31st lands in the
// month after next, which silently drops a bucket.
const startOfMonth = (date, offset = 0) => new Date(date.getFullYear(), date.getMonth() + offset, 1);
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const RANGE_STARTS = {
  week: (now) => { const date = new Date(now); date.setDate(date.getDate() - 6); return date; },
  month: (now) => startOfMonth(now),
  quarter: (now) => new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
  sixmonths: (now) => startOfMonth(now, -5),
  year: (now) => new Date(now.getFullYear(), 0, 1)
};

export const collectionTrendBuckets = ({ invoices = [], payments = [] } = {}, range = 'all', now = new Date()) => {
  const entries = [
    ...invoices.map(item => ({ at: asLocalDate(item.date), amount: Number(item.amount) || 0, field: 'invoiceAmount' })),
    ...payments.map(item => ({ at: asLocalDate(item.date), amount: Number(item.amount) || 0, field: 'collectedAmount' }))
  ].filter(item => !Number.isNaN(item.at.getTime()));
  if (!entries.length) return [];

  const earliest = new Date(Math.min(...entries.map(item => item.at.getTime())));
  const start = (RANGE_STARTS[range] || (() => earliest))(now);
  start.setHours(0, 0, 0, 0);
  // The axis runs to today, or to the latest activity where that is later -- a future-dated invoice
  // belongs on the chart rather than off the end of it
  const end = new Date(Math.max(now.getTime(), ...entries.map(item => item.at.getTime())));
  if (end < start) return [];

  const byDay = (end - start) / 86400000 <= 31;
  const keyOf = byDay ? dayKey : monthKey;
  const labelOf = date => (byDay
    ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));

  const buckets = new Map();
  let cursor = byDay ? new Date(start) : startOfMonth(start);
  while (cursor <= end) {
    buckets.set(keyOf(cursor), { key: keyOf(cursor), label: labelOf(cursor), invoiceAmount: 0, collectedAmount: 0 });
    cursor = byDay
      ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
      : startOfMonth(cursor, 1);
  }
  for (const entry of entries) {
    const bucket = buckets.get(keyOf(entry.at));
    if (bucket) bucket[entry.field] += entry.amount;
  }
  return [...buckets.values()];
};
