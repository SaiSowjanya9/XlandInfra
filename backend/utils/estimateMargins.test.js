const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estimateMargin, estimateMarginTotals } = require('./estimateMargins');

/**
 * The payments dashboard's margin panel. The figures come from the pricing snapshot saved with each
 * service, so an estimate reports what it was costed at rather than what the catalog says today.
 */

const priced = {
  estimate_id: 'EST-1', client_name: 'Sai', property_name: 'Sunrise', property_type: 'GC',
  status: 'sent', subtotal: 198000, package_price: 0, created_at: '2026-09-09 10:15:00',
  addons_data: JSON.stringify([
    { name: 'Lift', totalPrice: 108000, pricingSnapshot: { vendorCost: 86400, operatingCost: 0 } },
    { name: 'Pest', totalPrice: 90000, pricingSnapshot: { vendorCost: 72000, operatingCost: 3000 } }
  ])
};

test('an estimate reports the cost, price and margin its services were saved with', () => {
  assert.deepEqual(estimateMargin(priced), {
    estimateId: 'EST-1', clientName: 'Sai', propertyName: 'Sunrise', propertyCode: undefined,
    propertyType: 'GC', status: 'sent', createdAt: '2026-09-09 10:15:00', fpName: null, serviceCount: 2,
    vendorCost: 158400, operatingCost: 3000, actualCost: 161400,
    customerPrice: 198000, profit: 36600, marginPercent: 18.48
  });

  // Already-parsed JSON from the driver, a package price and no subtotal, and rows on `addons`
  const fromObject = estimateMargin({
    estimate_id: 'EST-2', package_price: 60000, subtotal: 0,
    addons: [{ totalPrice: 40000, vendorCost: 30000 }]
  });
  assert.equal(fromObject.customerPrice, 100000);
  assert.equal(fromObject.vendorCost, 30000);

  // The dashboard plots these over time, so the date travels with the row -- and its absence is
  // null rather than undefined, which `new Date()` would read as the epoch
  assert.equal(fromObject.createdAt, null);

  // Nothing priced: zeroes and no margin rather than NaN
  const empty = estimateMargin({ estimate_id: 'EST-3', addons_data: null });
  assert.equal(empty.customerPrice, 0);
  assert.equal(empty.marginPercent, null);
  assert.equal(empty.serviceCount, 0);

  // Unparseable JSON is treated as no services, never thrown
  assert.equal(estimateMargin({ estimate_id: 'EST-4', addons_data: '{not json' }).serviceCount, 0);
});

test('the panel totals every estimate and keeps each one for the table', () => {
  const totals = estimateMarginTotals([priced, { estimate_id: 'EST-5', subtotal: 2000, addons_data: JSON.stringify([{ totalPrice: 2000, vendorCost: 500 }]) }]);
  assert.equal(totals.estimateCount, 2);
  assert.equal(totals.costedCount, 2);
  assert.equal(totals.vendorCost, 158900);
  assert.equal(totals.operatingCost, 3000);
  assert.equal(totals.actualCost, 161900);
  assert.equal(totals.customerPrice, 200000);
  assert.equal(totals.profit, 38100);
  assert.equal(totals.marginPercent, 19.05);
  assert.deepEqual(totals.estimates.map(row => row.estimateId), ['EST-1', 'EST-5']);

  // An estimate with a price and no recorded cost is counted too -- every estimate's value is in
  // the totals -- and uncostedCount flags how many of them lift the margin with no cost behind it
  const withLegacy = estimateMarginTotals([priced, { estimate_id: 'EST-OLD', subtotal: 500000, addons_data: JSON.stringify([{ name: 'Typed by hand', totalPrice: 500000 }]) }]);
  assert.equal(withLegacy.estimateCount, 2);
  assert.equal(withLegacy.costedCount, 1);
  assert.equal(withLegacy.uncostedCount, 1);
  assert.equal(withLegacy.customerPrice, 698000, 'the uncosted estimate\'s price counts');
  assert.equal(withLegacy.marginPercent, 76.88, 'its missing cost reads as margin, flagged above');
  assert.equal(withLegacy.estimates.length, 2, 'both are still listed');

  // No estimates at all: a panel of zeroes, not a crash
  assert.deepEqual(estimateMarginTotals([]), {
    estimateCount: 0, costedCount: 0, uncostedCount: 0, vendorCost: 0, operatingCost: 0,
    actualCost: 0, customerPrice: 0, profit: 0, marginPercent: null, estimates: []
  });
});
