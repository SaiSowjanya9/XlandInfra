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

test('a package markup prices every row from what it costs, the way the service form does', () => {
  const configured = { catalogServiceId: 1, price: 108000, vendorCost: 80000, operatingCost: 20000 };
  const typed = { service: 'By hand', vendorCost: 50000 };

  // price = (vendor + operating) × (1 + markup/100)
  assert.equal(rowPriceWithMarkup(configured, 25), 125000);
  assert.equal(rowPriceWithMarkup(typed, 25), 62500);
  // A blank markup leaves each row on the price it already had -- the quote, or what was typed
  assert.equal(rowPriceWithMarkup(configured, ''), 108000);
  assert.equal(rowPriceWithMarkup(configured, null), 108000);
  // A price typed over the quote is never recalculated: that is what typing over it means
  assert.equal(rowPriceWithMarkup({ ...configured, priceOverridden: true }, 25), 108000);
  // A row with no cost behind it has nothing to mark up, so it keeps its own figure
  assert.equal(rowPriceWithMarkup({ service: 'Typed price only', price: 4000 }, 25), 4000);
  // Zero is a markup, not a blank: the price falls back to cost
  assert.equal(rowPriceWithMarkup(configured, 0), 100000);

  assert.deepEqual(applyPackageMarkup([configured, typed], 25).map(row => row.price), [125000, 62500]);

  const totals = packageTotals([configured, typed], 25);
  assert.equal(totals.customerPrice ?? totals.price, 187500);
  assert.equal(totals.vendorCost, 130000);
  assert.equal(totals.actualCost, 150000);
  assert.equal(totals.profit, 37500);
  assert.equal(totals.marginPercent, 20, 'a 25% markup is a 20% margin');
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
