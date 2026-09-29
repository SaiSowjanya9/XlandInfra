// The extension is required: these utils are run directly by `node --test`, which does not resolve
// a bare specifier the way Vite does
import { asLocalDate, bucketScale } from './collectionTrend.js';

/**
 * What the property-based estimates cost and make, over time.
 *
 * The panel used to be a table: one row per estimate, in no order but newest first, which answers
 * "what did this estimate make" and never "is the margin improving". The same figures are bucketed
 * here by the date each estimate was raised, over whatever range the calendar asks for, so the
 * question the panel exists for is the one it answers.
 *
 * The rows come from `GET /api/payments/property-estimate-margins`, which has already decided what
 * counts: property-based estimates that are neither archived nor rejected, priced from the snapshot
 * saved with each service. Nothing is re-priced here -- this only filters by date and adds up.
 */

const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const amount = value => (Number.isFinite(Number(value)) ? Number(value) : 0);

// `new Date(null)` is the epoch, not an invalid date, so an estimate with no date would land in
// 1970 and stretch the axis over six hundred months. Nothing is a date here.
const dateOf = value => (value ? asLocalDate(value) : new Date(NaN));
const isDate = date => !Number.isNaN(date.getTime());

// The end of a day, so an estimate raised at 4pm falls inside a range that ends on that date
const endOfDay = value => {
  const date = dateOf(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

/** The estimates raised within the calendar's range. An open end is left open. */
export const estimatesInRange = (rows = [], { from, to } = {}) => {
  const start = from ? dateOf(from) : null;
  const end = to ? endOfDay(to) : null;
  return rows.filter(row => {
    const at = dateOf(row?.createdAt);
    // An estimate with no usable date belongs to no range, but is still part of "all time"
    if (!isDate(at)) return !start && !end;
    return (!start || at >= start) && (!end || at <= end);
  });
};

/**
 * The headline figures for a set of estimates.
 *
 * **XLAND cost is the markup, not the `operating_cost` field.** ₹4,000 of vendor cost at 30% earns
 * ₹1,200 and the customer pays ₹5,200 -- that ₹1,200 is what the service form has always called
 * XLAND's cost, and what this panel showed instead was `operating_cost`, a separate overhead input
 * that no property-based estimate carries. So it read ₹0 beside a margin of 28%, two figures that
 * cannot both be true. It is derived here, never entered:
 *
 *   xlandCost = customerPrice − vendorCost − operatingCost
 *
 * which is the profit, so margin is `xlandCost / customerPrice` and the three figures add up:
 * vendor cost plus XLAND cost (plus any operating cost) is exactly the customer price.
 *
 * Only estimates that carry a cost are added up, which is the same rule the server applies to its
 * own totals: an estimate whose services were all typed by hand has a price and no cost, so
 * including it reports a margin approaching 100% and makes the panel read as profit we have no
 * evidence for. They are counted as `uncostedCount` rather than hidden.
 */
export const estimateMarginSummary = (rows = []) => {
  const costed = rows.filter(row => amount(row?.actualCost) > 0);
  const sum = field => round2(costed.reduce((total, row) => total + amount(row?.[field]), 0));
  const vendorCost = sum('vendorCost');
  const operatingCost = sum('operatingCost');
  const customerPrice = sum('customerPrice');
  const actualCost = round2(vendorCost + operatingCost);
  const xlandCost = round2(customerPrice - actualCost);
  return {
    estimateCount: rows.length,
    costedCount: costed.length,
    uncostedCount: rows.length - costed.length,
    vendorCost, operatingCost, actualCost, customerPrice, xlandCost,
    // The same number under the name the rest of the dashboard uses for it
    profit: xlandCost,
    marginPercent: customerPrice ? round2(xlandCost / customerPrice * 100) : null
  };
};

/**
 * One bucket per day or per month, every bucket in the range, so a quiet month reads as a gap
 * rather than as missing data. The axis runs across the calendar's range where one is set, and
 * across the estimates themselves where it is not.
 */
export const estimateMarginBuckets = (rows = [], { from, to } = {}, now = new Date()) => {
  const dated = rows
    .map(row => ({ row, at: dateOf(row?.createdAt) }))
    .filter(entry => isDate(entry.at));
  if (!dated.length) return [];

  const start = from ? dateOf(from) : new Date(Math.min(...dated.map(entry => entry.at.getTime())));
  start.setHours(0, 0, 0, 0);
  // Without an end date the axis runs to today, or to the latest estimate where that is later
  const end = to ? endOfDay(to) : new Date(Math.max(now.getTime(), ...dated.map(entry => entry.at.getTime())));
  if (end < start) return [];

  const { keyOf, keys } = bucketScale(start, end);
  const buckets = new Map(keys.map(bucket => [bucket.key, {
    ...bucket, vendorCost: 0, operatingCost: 0, customerPrice: 0, estimateCount: 0, costedCount: 0
  }]));
  for (const { row, at } of dated) {
    const bucket = buckets.get(keyOf(at));
    if (!bucket) continue;
    bucket.estimateCount += 1;
    // The same rule as the summary: an estimate with no cost behind it is counted, not added up
    if (amount(row.actualCost) <= 0) continue;
    bucket.costedCount += 1;
    bucket.vendorCost = round2(bucket.vendorCost + amount(row.vendorCost));
    bucket.operatingCost = round2(bucket.operatingCost + amount(row.operatingCost));
    bucket.customerPrice = round2(bucket.customerPrice + amount(row.customerPrice));
  }
  return [...buckets.values()].map(bucket => {
    // What XLAND makes on top of what the vendor charges -- the markup, in rupees. Stacked on the
    // vendor cost it comes to exactly the customer price, which is what the chart draws.
    const xlandCost = round2(bucket.customerPrice - bucket.vendorCost - bucket.operatingCost);
    return {
      ...bucket, xlandCost, profit: xlandCost,
      // A bucket with nothing costed in it has no margin. It is null rather than 0: a quiet month
      // is not a month where we made nothing, and the chart bridges the gap instead of diving to
      // the floor and back
      marginPercent: bucket.customerPrice ? round2(xlandCost / bucket.customerPrice * 100) : null
    };
  });
};
