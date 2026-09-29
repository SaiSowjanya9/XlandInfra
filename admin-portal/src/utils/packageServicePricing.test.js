import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METHOD_INPUTS, applyPackageMarkup, packageTotals, quotePropertyType, rowInput, rowPriceWithMarkup } from './packageServicePricing.js';

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

test('a package markup is added on top of what a row already comes to, so a price never falls', () => {
  const configured = { catalogServiceId: 1, price: 1560, vendorCost: 1200, operatingCost: 0 };
  const typed = { service: 'By hand', vendorCost: 50000 };

  // The quote stands and the markup is the package's own margin on top of it
  assert.equal(rowPriceWithMarkup(configured, 3), 1606.8);
  assert.equal(rowPriceWithMarkup(configured, 25), 1950);
  // The service is configured at 30%, so 3% used to drop 1,560 to 1,236 -- it cannot now
  assert.ok(rowPriceWithMarkup(configured, 3) > configured.price, 'a markup only ever raises a price');

  // A hand-typed row has no quote, so its vendor price is what gets marked up
  assert.equal(rowPriceWithMarkup(typed, 25), 62500);

  // A blank markup leaves each row on the price it already had
  assert.equal(rowPriceWithMarkup(configured, ''), 1560);
  assert.equal(rowPriceWithMarkup(configured, null), 1560);
  // Zero is a markup, not a blank, and adds nothing
  assert.equal(rowPriceWithMarkup(configured, 0), 1560);
  // A price typed over the quote is never recalculated: that is what typing over it means
  assert.equal(rowPriceWithMarkup({ ...configured, priceOverridden: true }, 25), 1560);
  // Nothing quoted and no cost either: there is nothing to mark up
  assert.equal(rowPriceWithMarkup({ service: 'Empty' }, 25), undefined);

  assert.deepEqual(applyPackageMarkup([configured, typed], 25).map(row => row.price), [1950, 62500]);

  const totals = packageTotals([configured, typed], 25);
  assert.equal(totals.customerPrice ?? totals.price, 64450);
  assert.equal(totals.vendorCost, 51200);
  assert.equal(totals.profit, 13250);
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
    profit: 36600, marginPercent: 18.48, pricedCount: 2
  });

  // Nothing priced yet reports zeroes and no margin, rather than NaN
  assert.deepEqual(packageTotals([{ service: 'Typed by hand' }]), {
    price: 0, vendorCost: 0, operatingCost: 0, actualCost: 0, profit: 0, marginPercent: null, pricedCount: 0
  });
  assert.equal(packageTotals().price, 0);
});
