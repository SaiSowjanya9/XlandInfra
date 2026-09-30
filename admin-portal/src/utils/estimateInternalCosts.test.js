import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateInternalCosts, getServiceActualCost, getServiceMarginPercent, getServiceOperatingCost, getServiceVendorCost, getServiceXlandCost } from './estimatePackageUtils.js';

/**
 * What an estimate cost XLAND, for the Internal Cost & Profit Summary the Admin, Ops Manager, FP and
 * Manager screens show. The figures come from the snapshot written when the service was priced, so
 * they report what it was costed at rather than what the catalog says today.
 */

const catalogService = {
  catalogServiceId: 4, name: 'Lift Maintenance', totalPrice: 136800, frequency_count: 12,
  pricingSnapshot: { vendorCost: 86400, operatingCost: 21600, actualCost: 108000, totalPrice: 136800, marginPercentage: 21.05 }
};
const manualService = { customService: true, name: 'Hand entered', totalPrice: 24000, frequency_count: 12 };

test('a configured service reports what it cost, a hand-entered one has no vendor behind it', () => {
  assert.equal(getServiceVendorCost(catalogService), 86400);
  assert.equal(getServiceOperatingCost(catalogService), 21600);
  assert.equal(getServiceActualCost(catalogService), 108000);
  assert.equal(getServiceMarginPercent(catalogService), 21.05);
  // XLAND cost is the markup in rupees -- the price less what it cost -- not the operating-cost
  // field, and cost plus markup is exactly the price
  assert.equal(getServiceXlandCost(catalogService), 28800);
  assert.equal(getServiceActualCost(catalogService) + getServiceXlandCost(catalogService), 136800);

  // Null, not zero: nothing was quoted for it, which is not the same as costing nothing
  assert.equal(getServiceVendorCost(manualService), null);
  assert.equal(getServiceOperatingCost(manualService), null);
  assert.equal(getServiceActualCost(manualService), null);
  assert.equal(getServiceXlandCost(manualService), null);
  assert.equal(getServiceMarginPercent(manualService), null);

  // A typed row CAN carry the vendor's cost and the markup it was priced at, and where it does the
  // same figures a catalog service reports derive from them: ₹4,000 at 30% sells for ₹5,200, makes
  // ₹1,200 and keeps a 23.08% margin
  const costedManual = { customService: true, name: 'Priced by hand', totalPrice: 5200, frequency_count: 4,
    vendorCost: 4000, markup_percentage: 30 };
  assert.equal(getServiceVendorCost(costedManual), 4000);
  assert.equal(getServiceOperatingCost(costedManual), null);
  assert.equal(getServiceActualCost(costedManual), 4000);
  assert.equal(getServiceXlandCost(costedManual), 1200);
  assert.equal(getServiceMarginPercent(costedManual), 23.08);

  // An older row without an actual cost or margin still reports both, derived from what it has
  const older = { catalogServiceId: 9, totalPrice: 10000, pricingSnapshot: { vendorCost: 6000, operatingCost: 2000 } };
  assert.equal(getServiceActualCost(older), 8000);
  assert.equal(getServiceMarginPercent(older), 20);
});

test('an estimate totals its costs and reports the profit in its own selling price', () => {
  // Subtotal is what the customer was quoted, package included, so it is the selling price
  const withPackage = estimateInternalCosts(
    { subtotal: 196800, package_price: 60000, addons: [catalogService, manualService] }
  );
  assert.deepEqual(withPackage, {
    vendorCost: 86400, operatingCost: 21600, actualCost: 108000,
    servicesPrice: 160800, packagePrice: 60000, sellingPrice: 196800,
    xlandCost: 88800, profit: 88800, marginPercent: 45.12
  });
  // The panel's four figures add up: what the vendor charges, what XLAND makes, what is paid
  assert.equal(withPackage.vendorCost + withPackage.operatingCost + withPackage.xlandCost, withPackage.sellingPrice);

  // No subtotal: the services and any package price stand in for it
  const withoutSubtotal = estimateInternalCosts({ addons: [catalogService] });
  assert.equal(withoutSubtotal.sellingPrice, 136800);
  assert.equal(withoutSubtotal.profit, 28800);

  // Rows can be passed directly, as the expanded detail panel does
  const fromRows = estimateInternalCosts({ subtotal: 136800 }, [catalogService]);
  assert.equal(fromRows.actualCost, 108000);
  assert.equal(fromRows.marginPercent, 21.05);

  // An estimate with nothing priced reports zeroes rather than NaN
  const empty = estimateInternalCosts({ addons: [] });
  assert.deepEqual(empty, { vendorCost: 0, operatingCost: 0, actualCost: 0, servicesPrice: 0,
    packagePrice: 0, sellingPrice: 0, xlandCost: 0, profit: 0, marginPercent: null });
});
