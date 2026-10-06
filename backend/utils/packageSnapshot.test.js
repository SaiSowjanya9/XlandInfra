const { test } = require('node:test');
const assert = require('node:assert/strict');
const { packageServiceSnapshot, fillPackageServiceDetails } = require('./packageSnapshot');

// A package service as the AMC package form saves it (packageRowForSave)
const liftRow = {
  service: 'Lift Fully Manual', category: 'Lifts', description: 'Inspection and minor adjustment.',
  frequencyType: 'Monthly', frequencyCount: 12, pricingMethod: 'capacity_slab', inputValue: 0, unit: 'KL',
  price: 97200, vendorCost: 64800, operatingCost: 0, catalogServiceId: 7,
  capacitySlabs: [{ name: 'Small', capacityFrom: 0, capacityTo: 3, ratePerVisit: 5400 }, { name: 'Large', capacityFrom: 3, capacityTo: null, ratePerVisit: 9000 }]
};

test('an estimate keeps how each package service is priced and what was entered for it', () => {
  const snap = packageServiceSnapshot(liftRow);
  assert.equal(snap.pricingMethod, 'capacity_slab');
  assert.equal(snap.inputValue, 0, 'a zero amount is kept, not dropped');
  assert.equal(snap.unit, 'KL');
  assert.equal(snap.catalogServiceId, 7);
  assert.equal(snap.vendorCost, 64800);
  assert.deepEqual(snap.capacitySlabs, [{ name: 'Small', capacityFrom: 0, capacityTo: 3 }, { name: 'Large', capacityFrom: 3, capacityTo: null }],
    'slab bands only -- a slab rate is the vendor price');
  assert.equal(snap.price, undefined, 'no per-service price is stored');
  // A hand-typed row has no method or amount, and gains none
  const typed = packageServiceSnapshot({ service: 'Deep Cleaning', frequencyType: 'Monthly', frequencyCount: 12 });
  assert.equal(typed.pricingMethod, undefined);
  assert.equal(typed.inputValue, undefined);
});

test('an estimate saved before that is completed from its package, without overwriting what it saved', async () => {
  const pkg = { services: JSON.stringify({ serviceRows: [liftRow, { service: 'Deep Cleaning', frequencyType: 'Yearly', frequencyCount: 1 }] }) };
  let queries = 0;
  const db = { execute: async (sql, params) => { queries++; assert.match(sql, /FROM fp_amc_packages/); assert.deepEqual(params, [3, 8]); return [[pkg]]; } };
  const older = { package_id: 3, franchise_partner_id: 8,
    package_services: JSON.stringify([{ name: 'lift fully manual', frequencyType: 'Quarterly', frequencyCount: 4 }, { name: 'Deep Cleaning', frequencyType: 'Monthly', frequencyCount: 12 }]) };
  const current = { package_id: 3, franchise_partner_id: 8, package_services: [{ name: 'Lift Fully Manual', pricingMethod: 'capacity_slab', inputValue: 0 }] };
  await fillPackageServiceDetails(db, [older, current, { package_id: null }]);
  assert.equal(queries, 1, 'only an estimate missing details reads its package, once');
  assert.equal(typeof older.package_services, 'string', 'keeps the type it came in');
  const [lift, cleaning] = JSON.parse(older.package_services);
  assert.equal(lift.pricingMethod, 'capacity_slab');
  assert.equal(lift.unit, 'KL');
  assert.equal(lift.frequencyType, 'Quarterly', 'what the estimate saved stands');
  assert.equal(lift.frequencyCount, 4);
  assert.equal(cleaning.pricingMethod, undefined, 'a hand-typed service has nothing to fill');
  assert.equal(cleaning.frequencyType, 'Monthly');
});
