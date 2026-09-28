import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceInput, getServiceMethodLabel } from './estimatePackageUtils.js';

/**
 * The Method and Input / Details columns every portal's view modal shows for a saved service. What
 * they must never carry is a cost: the amount measured at the property is the customer's own figure,
 * while the rate behind it is the vendor's.
 */

test('a saved service names its pricing method and the amount measured at the property', () => {
  const quantity = { pricing_method: 'quantity_based', unit: 'Lift', pricingInputs: { quantity: 4, markup_percentage: 20 } };
  assert.equal(getServiceMethodLabel(quantity), 'Quantity Based');
  assert.equal(getServiceInput(quantity), '4 Lift');

  // A large area is grouped the Indian way, the same as every figure on these screens
  assert.equal(getServiceInput({ pricing_method: 'area_based', unit: 'Sq Ft', pricingInputs: { area: 15000 } }), '15,000 Sq Ft');
  assert.equal(getServiceInput({ pricing_method: 'capacity_slab', unit: 'KVA', inputs: { capacity: 125 } }), '125 KVA');
  assert.equal(getServiceInput({ pricing_method: 'manpower', unit: 'Guards', pricingInputs: { personnel: 4 } }), '4 Guards');

  // The method and inputs of an older row live in its snapshot
  const snapshot = { pricingSnapshot: { pricing_method: 'capacity_based', unit: 'KL', inputs: { capacity: 20 } } };
  assert.equal(getServiceMethodLabel(snapshot), 'Capacity Based');
  assert.equal(getServiceInput(snapshot), '20 KL');

  // Fixed Price measures nothing, so it states nothing rather than inventing an amount
  assert.equal(getServiceMethodLabel({ pricing_method: 'fixed_price', unit: 'Visit' }), 'Fixed Price');
  assert.equal(getServiceInput({ pricing_method: 'fixed_price', unit: 'Visit' }), '');

  // A retired method still names itself so an estimate saved under one reads correctly
  assert.equal(getServiceMethodLabel({ pricing_method: 'fixed_visit_custom' }), 'Fixed Visit + Custom Work');

  // A hand-entered row has no configured method; its quantity is the only detail it carries
  const manual = { customService: true, name: 'Hand entered', quantity: 2 };
  assert.equal(getServiceMethodLabel(manual), '');
  assert.equal(getServiceInput(manual), 'Qty 2');
  assert.equal(getServiceInput({ customService: true, name: 'No quantity' }), '');
});
