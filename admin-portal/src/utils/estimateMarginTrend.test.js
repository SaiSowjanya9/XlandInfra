import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateMarginChartRows, estimateMarginSummary, estimatesInRange } from './estimateMarginTrend.js';

/**
 * The panel that was a table: it listed every estimate's margin one line at a time and never put
 * the three figures against each other. These are the figures behind the chart that replaced it.
 */

// Two costed estimates in September, one in July, and one typed entirely by hand (no cost at all)
const rows = [
  { estimateId: 'EST-1', propertyName: 'Green Valley', createdAt: '2026-09-09', vendorCost: 108000, operatingCost: 0, actualCost: 108000, customerPrice: 150300 },
  { estimateId: 'EST-2', propertyName: 'Lake View', createdAt: '2026-09-20T16:30:00', vendorCost: 20000, operatingCost: 5000, actualCost: 25000, customerPrice: 40000 },
  { estimateId: 'EST-3', propertyName: 'Hilltop', createdAt: '2026-07-04', vendorCost: 10000, operatingCost: 0, actualCost: 10000, customerPrice: 12000 },
  { estimateId: 'EST-4', propertyName: 'Sai Residency', createdAt: '2026-09-21', vendorCost: 0, operatingCost: 0, actualCost: 0, customerPrice: 10000 }
];

test('the chart plots one group per estimate, oldest first', () => {
  const plotted = estimateMarginChartRows(rows);
  assert.deepEqual(plotted.map(row => row.estimateId), ['EST-3', 'EST-1', 'EST-2', 'EST-4'],
    'left to right is forwards in time, whatever order the server sent');
  assert.deepEqual(plotted.map(row => row.property), ['Hilltop', 'Green Valley', 'Lake View', 'Sai Residency']);

  const green = plotted.find(row => row.estimateId === 'EST-1');
  assert.equal(green.vendorCost, 108000);
  assert.equal(green.xlandCost, 42300, 'the markup in rupees, derived rather than stored');
  assert.equal(green.customerPrice, 150300);
  assert.equal(green.vendorCost + green.operatingCost + green.xlandCost, green.customerPrice);
  assert.equal(green.marginPercent, 28.14);
});

test('an estimate with no cost behind it is plotted, and left out of the totals', () => {
  // It has a price and no margin, which is worth seeing on the chart...
  const uncosted = estimateMarginChartRows(rows).find(row => row.estimateId === 'EST-4');
  assert.equal(uncosted.customerPrice, 10000);
  assert.equal(uncosted.vendorCost, 0);
  assert.equal(uncosted.xlandCost, 10000, 'all of it looks like margin, which is exactly the trap');
  assert.equal(uncosted.marginPercent, 100);

  // ...and exactly why the headline totals leave it out
  const summary = estimateMarginSummary(rows);
  assert.equal(summary.estimateCount, 4);
  assert.equal(summary.uncostedCount, 1);
  assert.equal(summary.customerPrice, 202300, 'the ₹10,000 uncosted estimate is left out');
  // ₹2,02,300 sold against ₹1,43,000 of cost
  assert.equal(summary.actualCost, 143000);
  assert.equal(summary.xlandCost, 59300);
  assert.equal(summary.marginPercent, 29.31);
});

test('XLAND cost is the markup in rupees, on a row as in the totals', () => {
  // ₹4,000 of vendor cost marked up 30% earns ₹1,200 and the customer pays ₹5,200
  const marked = [{ estimateId: 'EST-M', createdAt: '2026-09-09', vendorCost: 4000, operatingCost: 0, actualCost: 4000, customerPrice: 5200 }];
  const summary = estimateMarginSummary(marked);
  assert.equal(summary.xlandCost, 1200);
  assert.equal(summary.vendorCost + summary.xlandCost, summary.customerPrice, 'the two shares are the whole price');
  // 30% markup on cost is a 23.08% margin on price -- the two are not the same number
  assert.equal(summary.marginPercent, 23.08);

  const [plotted] = estimateMarginChartRows(marked);
  assert.equal(plotted.xlandCost, 1200);
  assert.equal(plotted.marginPercent, 23.08);
});

test('the calendar decides which estimates are plotted at all', () => {
  const inRange = estimatesInRange(rows, { from: '2026-09-20', to: '2026-09-20' });
  assert.deepEqual(inRange.map(row => row.estimateId), ['EST-2'], '16:30 on the closing date is inside it');
  assert.deepEqual(estimatesInRange(rows, { from: '2026-09-10' }).map(row => row.estimateId), ['EST-2', 'EST-4']);
  assert.deepEqual(estimatesInRange(rows, { to: '2026-08-01' }).map(row => row.estimateId), ['EST-3']);
  assert.equal(estimatesInRange(rows, {}).length, 4, 'no calendar means everything');
  // The chart is drawn from whatever the range left
  assert.deepEqual(estimateMarginChartRows(estimatesInRange(rows, { from: '2026-09-01', to: '2026-09-30' }))
    .map(row => row.estimateId), ['EST-1', 'EST-2', 'EST-4']);
});

test('nothing to plot is an empty series, and a dateless estimate sorts last', () => {
  assert.deepEqual(estimateMarginChartRows([]), []);
  assert.equal(estimateMarginSummary([]).marginPercent, null);
  // `new Date(null)` is the epoch, so a dateless estimate would otherwise lead the chart from 1970
  const undated = estimateMarginChartRows([{ estimateId: 'NO-DATE', createdAt: null }, rows[0]]);
  assert.deepEqual(undated.map(row => row.estimateId), ['EST-1', 'NO-DATE']);
  assert.equal(undated[1].marginPercent, 0, 'nothing priced is no margin, not a division by zero');
});
