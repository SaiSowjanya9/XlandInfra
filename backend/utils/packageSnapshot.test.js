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

test('each package service carries its share of the package price, and a cost where one can be known', () => {
  const { packageShares } = require('./packageSnapshot');
  // Rows priced at the vendor's figure (4000, 2000), a 40% markup, and a price typed over (1000):
  // 5600 + 2800 + 1000 = 9400, scaled to the 9400 the package sells for
  assert.deepEqual(packageShares([{ price: 4000 }, { price: 2000 }, { price: 1000, priceOverridden: true }], 40, 9400), [5600, 2800, 1000]);
  // Scaled so the shares add up to what the package sells for
  assert.deepEqual(packageShares([{ price: 100 }, { price: 300 }], 0, 800), [200, 600]);
  assert.deepEqual(packageShares([{ service: 'typed, no price' }], 0, 500), [null]);
  // A row saved without a vendor cost cost what it was priced at -- unless its price was typed over
  assert.equal(packageServiceSnapshot({ service: 'Lift', price: 97200 }).vendorCost, 97200);
  assert.equal(packageServiceSnapshot({ service: 'Lift', price: 97200, priceOverridden: true }).vendorCost, undefined);
  assert.equal(packageServiceSnapshot({ service: 'Lift', price: 97200 }, 136080).packageShare, 136080);
});

test('a configured service saved on the package with no price still states its cost, and what the package loses on it', async () => {
  const lift = { pricing_method: 'capacity_slab', applicable_property_types: ['GC', 'VILLA', 'APT'], unit: 'Persons', default_markup_percentage: 35,
    default_frequency: 'Monthly', default_visits_per_year: 12, allow_frequency_override: true, allow_manual_visits: true,
    capacity_slabs: [{ name: 'Small', capacityFrom: 0, capacityTo: 3, vendorRate: 6000, isCustomQuote: false }, { name: 'Large', capacityFrom: 3, capacityTo: null, vendorRate: 8000, isCustomQuote: false }] };
  const stored = { markup_percentage: 35, property_types: ['GC', 'VILLA', 'PLOT', 'FLAT', 'APT'], serviceRows: [
    { service: 'Lift Fully Manual', catalogServiceId: 7, pricingMethod: 'capacity_slab', inputValue: 0, frequencyType: 'Monthly', frequencyCount: 12, price: '' },
    { service: 'Deep Cleaning', catalogServiceId: 8, pricingMethod: 'area_based', inputValue: 1000, frequencyType: 'Yearly', frequencyCount: 1, price: 4000, vendorCost: 4000 }
  ] };
  const db = { execute: async (sql, params) => {
    if (sql.includes('FROM fp_amc_packages')) return [[{ services: JSON.stringify(stored), price: 5400 }]];
    if (sql.includes('FROM service_catalog')) { assert.deepEqual(params, [7]); return [[{ id: 7, configuration: JSON.stringify(lift), scope_id: 0 }]]; }
    throw new Error(`Unexpected SQL: ${sql}`);
  } };
  const estimate = { package_id: 3, franchise_partner_id: 8, package_price: 5400,
    package_services: [{ name: 'Lift Fully Manual' }, { name: 'Deep Cleaning' }] };
  await fillPackageServiceDetails(db, [estimate]);
  const [liftRow, cleaning] = estimate.package_services;
  assert.equal(liftRow.vendorCost, 72000, '6,000 a visit, 12 visits, from the catalog');
  assert.equal(liftRow.packageShare, 0, 'the package price does not include it');
  assert.equal(cleaning.packageShare, 5400, 'the package price is all Deep Cleaning\'s');
  assert.equal(cleaning.vendorCost, 4000);
});
