import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceInput, getServiceMethodLabel, getServiceRate } from './estimatePackageUtils.js';

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

/**
 * The rate line under the measured amount, in the internal table only: it is what the vendor is paid,
 * so the customer-safe table never renders it.
 */
test('a service states the rate it was priced at, per pricing method', () => {
  const rate = (service) => getServiceRate(service);
  assert.equal(rate({ pricing_method: 'quantity_based', unit: 'Lift', pricingSnapshot: { rate_per_quantity: 1800 } }), '₹1,800 / Lift / Visit');
  // A fractional rate keeps its paise; a whole one is not padded with them
  assert.equal(rate({ pricing_method: 'area_based', unit: 'Sq Ft', pricingSnapshot: { rate_per_unit: 0.8 } }), '₹0.80 / Sq Ft / Visit');
  assert.equal(rate({ pricing_method: 'capacity_based', unit: 'KL', pricingSnapshot: { rate_per_capacity: 300 } }), '₹300 / KL / Visit');
  assert.equal(rate({ pricing_method: 'fixed_price', unit: 'Visit', pricingSnapshot: { fixed_price: 1500 } }), '₹1,500 / Visit');
  assert.equal(rate({ pricing_method: 'manpower', unit: 'Guards', pricingSnapshot: { manpower_basis: 'monthly', monthly_rate: 18000 } }), '₹18,000 / Month');
  assert.equal(rate({ pricing_method: 'manpower', unit: 'Guards', pricingSnapshot: { manpower_basis: 'per_visit', rate_per_person: 900 } }), '₹900 / Person / Visit');

  // Capacity Slab names the slab that decided the price rather than a rate
  const slabs = [{ capacityFrom: 0, capacityTo: 100, vendorRate: 2000 }, { capacityFrom: 101, capacityTo: 200, vendorRate: 4000 }];
  assert.equal(rate({ pricing_method: 'capacity_slab', unit: 'KVA', pricingInputs: { capacity: 125 }, pricingSnapshot: { capacity_slabs: slabs } }), 'Slab: 101 - 200 KVA');
  const openEnded = [{ capacityFrom: 201, capacityTo: null, vendorRate: 6000 }];
  assert.equal(rate({ pricing_method: 'capacity_slab', unit: 'KVA', pricingInputs: { capacity: 500 }, pricingSnapshot: { capacity_slabs: openEnded } }), 'Slab: 201 - above KVA');

  // No rate card in the snapshot: the per-visit vendor rate still says it, and a typed row says nothing
  assert.equal(rate({ pricing_method: 'custom_quote', pricingSnapshot: { vendorRatePerVisit: 2500 } }), '₹2,500 / Visit');
  assert.equal(rate({ customService: true, name: 'Hand entered', quantity: 2 }), '');
});

test('a customer document drops the method, Primary Input and category from a service description', async () => {
  const { customerServiceDetails } = await import('./estimatePackageUtils.js');
  assert.equal(customerServiceDetails('Inspection, lubrication.\nCapacity Slab | Primary Input: Lift Fully Manual Capacity', 'Lifts'), 'Inspection, lubrication.');
  assert.equal(customerServiceDetails('Lifts | Area: 10 Sq Ft | Property Types: GC, APT', 'Lifts'), 'Area: 10 Sq Ft');
});
