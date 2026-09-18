const { test } = require('node:test');
const assert = require('node:assert/strict');
const { packagePropertyTypes } = require('./packagePropertyTypes');

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
