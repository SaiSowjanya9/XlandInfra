import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METHOD_INPUTS, applyPackageMarkup, packageInternalSummary, packageTotals, quotePropertyType, rowInput, rowPriceWithMarkup } from './packageServicePricing.js';

test('a saved package states the internal figures it was created with', () => {
  // Rs 6,000 of vendor cost sold at Rs 8,400: XLAND keeps Rs 2,400, a 28.57% margin
  const rows = [{ service: 'Lift', vendorCost: 4000 }, { service: 'Cleaning', vendorCost: '2000' }, { service: 'Typed, no cost' }];
  assert.deepEqual(packageInternalSummary(rows, 8400),
    { vendorCost: 6000, operatingCost: 0, customerPrice: 8400, xlandCost: 2400, marginPercent: 28.57 });
  // Saved before rows carried a vendor cost: nothing to report, rather than 100% margin
  assert.equal(packageInternalSummary([{ service: 'Lift' }], 8400), null);
  assert.equal(packageInternalSummary([], 8400), null);
});

/**
 * An AMC package is priced by its services rather than by a figure typed into it, so these are the
 * two things that has to get right: which amount each pricing method needs, and what the rows add up
 * to. A row typed by hand has no configured service behind it, so it contributes no price.
 */

test('a row asks for the amount its pricing method measures', () => {
  assert.deepEqual(rowInput({ pricingMethod: 'quantity_based', unit: 'Lift' }),
    { ...METHOD_INPUTS.quantity_based, unit: 'Lift' });
  assert.equal(rowInput({ pricingMethod: 'area_based', unit: 'Sq Ft' }).key, 'area');
  assert.equal(rowInput({ pricingMethod: 'capacity_slab', unit: 'KVA' }).key, 'capacity');
  assert.equal(rowInput({ pricingMethod: 'manpower', unit: 'Guards' }).key, 'personnel');
  // Fixed Price measures nothing, and a hand-typed row has no method at all
  assert.equal(rowInput({ pricingMethod: 'fixed_price', unit: 'Visit' }), null);
  assert.equal(rowInput({ service: 'Typed by hand' }), null);
});

test('a row is quoted against a property type its own service covers', () => {
  // The quote answers 400 for a type the service does not cover, so a row sent the package's first
  // type was left unpriced whenever no type was ticked or the first one did not match: typing an
  // amount produced no price and said nothing.
  const gcOnly = { applicablePropertyTypes: ['GC', 'APT'] };

  assert.equal(quotePropertyType(gcOnly, []), 'GC', 'no type ticked yet: the service decides');
  assert.equal(quotePropertyType(gcOnly, ['APT', 'GC']), 'APT', 'a ticked type the service covers wins');
  assert.equal(quotePropertyType(gcOnly, ['PLOT', 'APT']), 'APT', 'a ticked type it does not cover is skipped');
  assert.equal(quotePropertyType(gcOnly, ['PLOT']), 'GC', 'nothing in common: still priced from the service');
  // A row from an older package carries no list, so any ticked type is used as before
  assert.equal(quotePropertyType({}, ['VILLA']), 'VILLA');
  assert.equal(quotePropertyType({}, []), '');
});

test('a package markup is XLAND\'s margin on the vendor cost, so a price never falls', () => {
  // A configured row is priced at what the vendor charges, not at what the service sells for
  const configured = { catalogServiceId: 1, price: 1200, vendorCost: 1200, operatingCost: 0 };
  const typed = { service: 'By hand', vendorCost: 50000 };

  // ₹4,000 of vendor cost at 30% earns ₹1,200 and comes to ₹5,200 -- the same arithmetic
  assert.equal(rowPriceWithMarkup({ catalogServiceId: 2, price: 4000, vendorCost: 4000 }, 30), 5200);
  assert.equal(rowPriceWithMarkup(configured, 25), 1500);
  assert.ok(rowPriceWithMarkup(configured, 3) > configured.price, 'a markup only ever raises a price');

  // A hand-typed row has no quote, so its vendor price is what gets marked up -- the same rule
  assert.equal(rowPriceWithMarkup(typed, 25), 62500);

  // A blank markup leaves each row on the price it already had
  assert.equal(rowPriceWithMarkup(configured, ''), 1200);
  assert.equal(rowPriceWithMarkup(configured, null), 1200);
  // Zero is a markup, not a blank, and adds nothing
  assert.equal(rowPriceWithMarkup(configured, 0), 1200);
  // A price typed over the quote is never recalculated: that is what typing over it means
  assert.equal(rowPriceWithMarkup({ ...configured, priceOverridden: true }, 25), 1200);
  // Nothing quoted and no cost either: there is nothing to mark up
  assert.equal(rowPriceWithMarkup({ service: 'Empty' }, 25), undefined);

  assert.deepEqual(applyPackageMarkup([configured, typed], 25).map(row => row.price), [1500, 62500]);

  const totals = packageTotals([configured, typed], 25);
  assert.equal(totals.price, 64000);
  assert.equal(totals.vendorCost, 51200);
  // What XLAND makes is the markup, and cost plus markup is the package price
  assert.equal(totals.xlandCost, 12800);
  assert.equal(totals.vendorCost + totals.xlandCost, totals.price);

  // With no markup a configured row is sold at exactly what it costs, which is why the form says
  // so. The hand-typed row still carries no price of its own, so it adds nothing either way.
  const atCost = packageTotals([configured, typed], '');
  assert.equal(atCost.price, 1200);
  assert.equal(atCost.vendorCost, 1200);
  assert.equal(atCost.xlandCost, 0);
  assert.equal(atCost.marginPercent, 0);
});

test('the package price is what its priced services add up to', () => {
  const rows = [
    { catalogServiceId: 1, service: 'Lift Maintenance', price: 108000, vendorCost: 86400, operatingCost: 0 },
    { catalogServiceId: 2, service: 'Pest Control', price: 90000, vendorCost: 72000, operatingCost: 3000 },
    // Typed by hand: part of the package, but it sets no price
    { service: 'Site visit', description: 'Ad hoc' }
  ];
  assert.deepEqual(packageTotals(rows), {
    price: 198000, vendorCost: 158400, operatingCost: 3000, actualCost: 161400,
    xlandCost: 36600, profit: 36600, marginPercent: 18.48, pricedCount: 2
  });
  // XLAND cost is the markup in rupees, as on the service form: what the vendor charges plus what
  // we make (plus any operating cost) is exactly what the customer pays
  const totals = packageTotals(rows);
  assert.equal(totals.vendorCost + totals.operatingCost + totals.xlandCost, totals.price);

  // Nothing priced yet reports zeroes and no margin, rather than NaN
  assert.deepEqual(packageTotals([{ service: 'Typed by hand' }]), {
    price: 0, vendorCost: 0, operatingCost: 0, actualCost: 0, xlandCost: 0, profit: 0, marginPercent: null, pricedCount: 0
  });
  assert.equal(packageTotals().price, 0);
});
