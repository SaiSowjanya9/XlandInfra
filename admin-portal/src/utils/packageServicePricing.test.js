import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METHOD_INPUTS, packageTotals, rowInput } from './packageServicePricing.js';

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
