// The extension is required: these utils are run directly by `node --test`, which does not resolve
// a bare specifier the way Vite does
import { asLocalDate } from './collectionTrend.js';

/**
 * What the property-based estimates cost and make.
 *
 * The panel used to be a table: one row per estimate, newest first, which answers "what did this
 * estimate make" one line at a time and never shows the three figures against each other. It is a
 * chart now -- vendor cost, XLAND cost and customer price side by side per estimate, with the
 * margin those make as a line across them -- over whatever range the calendar asks for.
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
 * The estimates the chart plots: one column group each, oldest first, so reading left to right is
 * also reading forwards in time.
 *
 * Every estimate in the range is plotted, including one with no cost behind it -- it has a
 * customer price and a margin of nothing, which is worth seeing rather than hiding. That differs
 * from `estimateMarginSummary`, which leaves such an estimate out of the totals precisely so it
 * cannot flatter them.
 */
export const estimateMarginChartRows = (rows = []) => [...rows]
  .sort((first, second) => {
    const [a, b] = [dateOf(first?.createdAt), dateOf(second?.createdAt)];
    // An estimate with no usable date sorts last rather than to 1970
    if (!isDate(a) || !isDate(b)) return isDate(a) ? -1 : isDate(b) ? 1 : 0;
    return a - b;
  })
  .map(row => {
    const vendorCost = amount(row?.vendorCost);
    const operatingCost = amount(row?.operatingCost);
    const customerPrice = amount(row?.customerPrice);
    // What XLAND makes on top of what the vendor charges -- the markup, in rupees
    const xlandCost = round2(customerPrice - vendorCost - operatingCost);
    return {
      estimateId: row?.estimateId || '',
      property: row?.propertyName || row?.clientName || '',
      propertyCode: row?.propertyCode || '',
      createdAt: row?.createdAt ?? null,
      vendorCost: round2(vendorCost), operatingCost: round2(operatingCost),
      customerPrice: round2(customerPrice), xlandCost,
      marginPercent: customerPrice ? round2(xlandCost / customerPrice * 100) : 0
    };
  });
