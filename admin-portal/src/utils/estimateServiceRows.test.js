import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateServiceRows } from './estimatePackageUtils.js';

/**
 * The services an estimate covers, as the vendor-assignment screens read them. The bug this guards:
 * a custom or direct estimate keeps every service in `addons`, so a reader that looked only at the
 * package fields reported "No services found in estimate" for an estimate that plainly had them.
 */

test('every service on an estimate is listed, whichever way it was added', () => {
  // A custom estimate: no package at all, services in addons -- the case that found nothing
  const custom = estimateServiceRows({
    estimate_type: 'direct', package_services: null, services_data: null,
    addons: [
      { addonId: 'CUSTOM-1', customService: true, name: 'Test Service', category: 'Generator', frequency_type: 'Every 4 Months', frequency_count: 3 },
      { catalogServiceId: 4, name: 'Drainage Maintenance', frequencyType: 'Monthly', frequencyCount: 12 }
    ]
  });
  assert.deepEqual(custom, [
    { serviceType: 'Test Service', frequencyType: 'Every 4 Months', frequencyCount: 3 },
    { serviceType: 'Drainage Maintenance', frequencyType: 'Monthly', frequencyCount: 12 }
  ]);

  // Saved as a JSON string, which is how the column comes back
  assert.deepEqual(estimateServiceRows({ addons_data: JSON.stringify([{ service: 'Tank Cleaning', frequencyType: 'Half Yearly', visits: 2 }]) }),
    [{ serviceType: 'Tank Cleaning', frequencyType: 'Half Yearly', frequencyCount: 2 }]);

  // A package estimate with services added beside it lists both, and no service twice
  const mixed = estimateServiceRows({
    package_services: JSON.stringify([{ service: 'Housekeeping', frequencyType: 'Monthly', frequencyCount: 12 }]),
    packageServices: JSON.stringify([{ service: 'Housekeeping', frequencyType: 'Monthly', frequencyCount: 12 }]),
    addons: [{ name: 'Pest Control', frequency_type: 'Quarterly', frequency_count: 4 }]
  });
  assert.deepEqual(mixed.map(row => row.serviceType), ['Housekeeping', 'Pest Control']);

  // A service the estimate says needs no vendor is not work awaiting one
  assert.deepEqual(estimateServiceRows({ addons: [
    { name: 'Garden Upkeep', skip_vendor_assignment: true, frequency_count: 12 },
    { name: 'Lift Maintenance', skip_vendor_assignment: false, frequency_count: 4 }
  ] }).map(row => row.serviceType), ['Lift Maintenance']);

  // Shapes that carry nothing usable are skipped rather than listed as "Service"
  assert.deepEqual(estimateServiceRows({ addons: [{ price: 100 }, { name: '   ' }] }), []);
  assert.deepEqual(estimateServiceRows({}), []);
  assert.deepEqual(estimateServiceRows({ addons_data: '{not json' }), []);

  // On Request means no visits, and that zero is kept rather than read as one
  assert.equal(estimateServiceRows({ addons: [{ name: 'Ad hoc Repair', frequencyType: 'On Request', frequencyCount: 0 }] })[0].frequencyCount, 0);
  // Nothing stated at all still counts as one visit
  assert.equal(estimateServiceRows({ addons: [{ name: 'Painting' }] })[0].frequencyCount, 1);

  // {serviceRows: [...]} and {services: [...]} wrappers are both read
  for (const wrapper of ['serviceRows', 'services']) {
    assert.deepEqual(estimateServiceRows({ package_services: JSON.stringify({ [wrapper]: [{ service: 'Security', frequencyCount: 52 }] }) }),
      [{ serviceType: 'Security', frequencyType: 'Monthly', frequencyCount: 52 }]);
  }
});
