import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRowPatches, duplicatePackageName, packageRowForSave, packageRowFromCatalog, packageRowFromDialog, packageRowFromSaved, updatePackageRow } from './packageRows.js';
import { capitalizeFirst, decodeEntities, sameEntry } from './text.js';

const COUNTS = { Monthly: 12, Quarterly: 4, Custom: null };

test('a configured service opens in a package already priceable', () => {
  const base = { id: 9, service_name: 'Lift AMC', description: 'Checks', category: 'Lifts', unit: 'Persons',
    default_frequency: 'Monthly', default_visits_per_year: 12, applicable_property_types: ['GC'], allow_frequency_override: false };
  // One of whatever the method measures, so a quote is asked for straight away
  for (const method of ['quantity_based', 'area_based', 'capacity_based', 'manpower']) {
    assert.equal(packageRowFromCatalog({ ...base, pricing_method: method }, COUNTS).inputValue, 1, method);
  }
  assert.equal(packageRowFromCatalog({ ...base, pricing_method: 'fixed_price' }, COUNTS).inputValue, '');

  // A slab service skips a custom-quote slab, which cannot be quoted, and takes the chosen slab's
  // own schedule: the quote refuses any other on a service that forbids a frequency change
  const slabs = [
    { capacityFrom: 0, capacityTo: null, isCustomQuote: true },
    { capacityFrom: 0, capacityTo: 3, vendorRate: 500, defaultFrequency: 'Quarterly', defaultVisitsPerYear: 4 },
    { capacityFrom: 0, capacityTo: 6, vendorRate: 800 }
  ];
  const row = packageRowFromCatalog({ ...base, pricing_method: 'capacity_slab', capacity_slabs: slabs }, COUNTS);
  assert.equal(row.inputValue, 0);
  assert.equal(row.frequencyType, 'Quarterly');
  assert.equal(row.frequencyCount, 4);
  assert.equal(row.allowFrequencyOverride, false);
  assert.deepEqual(row.capacitySlabs, slabs);
  // Only custom-quote slabs: nothing to price, so the amount waits to be chosen
  assert.equal(packageRowFromCatalog({ ...base, pricing_method: 'capacity_slab', capacity_slabs: [slabs[0]] }, COUNTS).inputValue, '');
});

test('a row update never touches the row objects it was given', () => {
  const rows = [Object.freeze({ service: 'A', frequencyType: 'Monthly', frequencyCount: 12 })];
  const next = updatePackageRow(rows, 0, 'description', 'Covers pumps', COUNTS);
  assert.notEqual(next[0], rows[0]);
  assert.equal(next[0].description, 'Covers pumps');
  assert.equal(updatePackageRow(rows, 0, 'frequencyType', 'Quarterly', COUNTS)[0].frequencyCount, 4);
  // Custom has no count of its own, so the typed one stays
  assert.equal(updatePackageRow(rows, 0, 'frequencyType', 'Custom', COUNTS)[0].frequencyCount, 12);
  assert.deepEqual(updatePackageRow(rows, 0, 'price', '500', COUNTS)[0], { ...rows[0], price: 500, priceOverridden: true });
  assert.equal(updatePackageRow(rows, 0, 'price', '', COUNTS)[0].priceOverridden, false);
});

test('a quote that lands late keeps everything typed while it ran', () => {
  const snapshot = [{ catalogServiceId: 1, service: 'Lift', inputValue: 4, frequencyType: 'Monthly', frequencyCount: 12, description: '' }];
  // The description was typed after the quote was asked for
  const current = [{ ...snapshot[0], description: 'Typed while quoting' }];
  const [row] = applyRowPatches(current, snapshot, [{ price: 900, vendorCost: 900 }]);
  assert.equal(row.description, 'Typed while quoting');
  assert.equal(row.price, 900);
});

test('a quote is not applied to a row whose pricing inputs have since changed', () => {
  const snapshot = [{ catalogServiceId: 1, inputValue: 4, frequencyType: 'Monthly', frequencyCount: 12 }];
  const current = [{ ...snapshot[0], inputValue: 6 }];
  assert.equal(applyRowPatches(current, snapshot, [{ price: 900 }]), current);
});

test('a price typed over the quote stands, and nothing changes when no figure changed', () => {
  const snapshot = [{ catalogServiceId: 1, inputValue: 4, frequencyType: 'Monthly', frequencyCount: 12, price: 750, priceOverridden: true, vendorCost: 500 }];
  assert.equal(applyRowPatches(snapshot, snapshot, [{ price: 900, vendorCost: 600 }])[0].price, 750);
  assert.equal(applyRowPatches(snapshot, snapshot, [{ vendorCost: 500 }]), snapshot);
  assert.equal(applyRowPatches(snapshot, snapshot, [null]), snapshot);
});

test('a hand-typed row is priced at what the vendor charges', () => {
  const row = packageRowFromDialog({ name: ' Deep cleaning ', description: 'Kitchen', category: 'Housekeeping', frequency_type: 'Monthly', frequency_count: 12, quantity: '', price: '1200', vendorRequired: true });
  assert.equal(row.service, 'Deep cleaning');
  assert.equal(row.price, 1200);
  assert.equal(row.vendorCost, 1200);
});

test('a saved row reopens with everything it was saved with', () => {
  const saved = packageRowForSave({ service: 'Lift', description: 'All lifts', frequencyType: 'Monthly', frequencyCount: '12',
    catalogServiceId: 7, pricingMethod: 'quantity_based', unit: 'Lift', inputValue: 4, price: 750, priceOverridden: true, vendorCost: 500, vendorRequired: false });
  const reopened = packageRowFromSaved(saved);
  for (const field of ['service', 'description', 'frequencyType', 'catalogServiceId', 'pricingMethod', 'unit', 'inputValue', 'price', 'priceOverridden', 'vendorCost', 'vendorRequired']) {
    assert.deepEqual(reopened[field], saved[field], field);
  }
  assert.equal(reopened.frequencyCount, 12);
  // Older packages stored snake_case keys
  assert.equal(packageRowFromSaved({ name: 'Old', frequency_type: 'Quarterly', frequency_count: 4 }).frequencyCount, 4);
});

test('package names that differ only in case or spacing are the same package', () => {
  const packages = [{ id: 1, packageName: 'Gold  Package' }, { id: 2, name: 'Silver' }];
  assert.equal(duplicatePackageName(packages, ' gold package ')?.id, 1);
  assert.equal(duplicatePackageName(packages, 'gold package', 1), null);
  assert.equal(duplicatePackageName(packages, 'silver')?.id, 2);
  assert.equal(duplicatePackageName(packages, 'Bronze'), null);
  assert.equal(duplicatePackageName(packages, ''), null);
});

test('text helpers', () => {
  assert.equal(capitalizeFirst('ac servicing'), 'Ac servicing');
  assert.equal(capitalizeFirst('AC servicing'), 'AC servicing');
  assert.equal(capitalizeFirst('  lift'), '  Lift');
  assert.equal(capitalizeFirst(''), '');
  assert.equal(decodeEntities('Parts&amp;#x2F;major'), 'Parts/major');
  assert.equal(sameEntry(' Lift  Repair', 'lift repair'), true);
});
