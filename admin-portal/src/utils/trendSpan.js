/**
 * Trend charts read as one continuous line from the first record to today, not as a row of
 * individually labelled months: the axis carries no per-month ticks, and the chart states its
 * span once ("May 2026 – Oct 2026") underneath. Hovering a point still names its month.
 */

/**
 * How many monthly buckets an "All Time" trend needs: from the month of the earliest record to
 * the current month, inclusive. Without any record it falls back to `fallback`.
 */
export const monthsSinceEarliest = (dates, now = new Date(), fallback = 6) => {
  const times = dates.filter(Boolean).map(value => new Date(value).getTime()).filter(Number.isFinite);
  if (!times.length) return fallback;
  const earliest = new Date(Math.min(...times, now.getTime()));
  return (now.getFullYear() - earliest.getFullYear()) * 12 + now.getMonth() - earliest.getMonth() + 1;
};

/** "May 2026 – Oct 2026" from the first and last bucket's label. */
export const trendSpanLabel = (rows = [], key = 'name') => {
  if (!rows.length) return '';
  const first = rows[0][key];
  const last = rows[rows.length - 1][key];
  return first === last ? String(first) : `${first} – ${last}`;
};

/** XAxis props for a trend chart: the axis line stays, the per-bucket labels go. */
export const TREND_X_AXIS = { tick: false, tickLine: false, height: 8 };
