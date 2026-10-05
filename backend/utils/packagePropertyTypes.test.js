const { test } = require('node:test');
const assert = require('node:assert/strict');
const { packagePropertyTypes, assertUniquePackageName } = require('./packagePropertyTypes');

test('a package name an FP already has is refused, whatever its case, spacing or escaping', async () => {
  // Stored the way the security middleware leaves it: HTML-escaped
  const db = { execute: async () => [[{ id: 7, name: 'Lifts &amp; DG &#x2F; Gold' }]] };
  for (const name of ['Lifts & DG / Gold', '  lifts &  dg / GOLD ', 'Lifts &amp; DG &#x2F; Gold']) {
    await assert.rejects(assertUniquePackageName(db, 1, name), err => err.status === 409 && /already exists/.test(err.message), name);
  }
  // A different name, and the same package being saved again under its own name, both pass
  await assertUniquePackageName(db, 1, 'Lifts & DG / Silver');
  await assertUniquePackageName(db, 1, 'Lifts & DG / Gold', 7);
  await assert.rejects(assertUniquePackageName(db, 1, '   '), err => err.status === 400);
});

test('a package accepts several property types and still understands a single legacy value', () => {
  assert.deepEqual(packagePropertyTypes({ property_types: ['GC', 'APT', 'PLOT'] }), ['GC', 'APT', 'PLOT']);
  assert.deepEqual(packagePropertyTypes({ propertyTypes: ['Gated Community', 'Apartment'] }), ['GC', 'APT']);
  // Older callers send one value under either name
  assert.deepEqual(packagePropertyTypes({ property_type: 'VILLA' }), ['VILLA']);
  assert.deepEqual(packagePropertyTypes({ propertyType: 'Flat' }), ['FLAT']);
  // Duplicates and spelling variants collapse to one entry each
  assert.deepEqual(packagePropertyTypes({ property_types: ['APT', 'Apartments', 'apartment', 'GC'] }), ['APT', 'GC']);
  assert.deepEqual(packagePropertyTypes({ property_types: ['gated_community', 'Plots'] }), ['GC', 'PLOT']);
  // A package must apply somewhere, and unsupported types are not accepted
  for (const body of [{}, { property_types: [] }, { property_type: '' }, { property_types: ['Commercial'] }, { property_type: 'IH' }]) {
    assert.throws(() => packagePropertyTypes(body), /at least one property type/i, JSON.stringify(body));
  }
});

test('the frontend package matcher agrees with the stored list', async () => {
  const { getPackagePropertyTypes, getPackagePropertyType, packageMatchesPropertyType } =
    await import('../../admin-portal/src/utils/estimatePackageUtils.js');
  // Stored the way the routes write it: a list plus the first value for older readers
  const multi = { services: JSON.stringify({ property_type: 'GC', property_types: ['GC', 'APT'], serviceRows: [] }) };
  assert.deepEqual(getPackagePropertyTypes(multi), ['GC', 'APT']);
  assert.equal(getPackagePropertyType(multi), 'GC');
  for (const type of ['GC', 'APT', 'Gated Community', 'apartment']) assert.equal(packageMatchesPropertyType(multi, type), true, type);
  for (const type of ['VILLA', 'FLAT', 'PLOT', '', null]) assert.equal(packageMatchesPropertyType(multi, type), false, String(type));

  // A package saved before this change carries only the single value
  const legacy = { services: JSON.stringify({ property_type: 'VILLA', serviceRows: [] }) };
  assert.deepEqual(getPackagePropertyTypes(legacy), ['VILLA']);
  assert.equal(packageMatchesPropertyType(legacy, 'Villas'), true);
  assert.equal(packageMatchesPropertyType(legacy, 'GC'), false);

  // Shapes the various endpoints return
  assert.equal(packageMatchesPropertyType({ propertyTypes: ['FLAT'] }, 'Flat'), true);
  assert.equal(packageMatchesPropertyType({ property_type: 'PLOT' }, 'Plots'), true);
  assert.deepEqual(getPackagePropertyTypes({}), []);
  assert.equal(packageMatchesPropertyType({}, 'GC'), false);
});
