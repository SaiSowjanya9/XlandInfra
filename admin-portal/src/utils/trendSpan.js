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

/**
 * The `dot` a trend series draws — `false` as the rule above asks, except where the whole window
 * is one bucket.
 *
 * A line needs two points. One point is a path that moves the pen and closes ("M10,20Z"), which
 * strokes nothing, so a single-bucket window with dots off is an empty frame over a correct axis:
 * the Estimate Trend did that for "This Week" and "This Month", and every trend still can on the
 * 1st of a month, or on a deployment whose first record is today. The dot comes back for that one
 * case, so the figure can be read; every longer span keeps the clean line.
 */
export const trendDot = (rows) => (rows?.length === 1 ? { r: 3 } : false);
