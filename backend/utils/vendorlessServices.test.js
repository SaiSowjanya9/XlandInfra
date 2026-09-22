const { test } = require('node:test');
const assert = require('node:assert/strict');

/**
 * "Do Not Assign Vendor" on a configured service. Switching it on means that service is arranged
 * without a vendor: none is assigned to it and nothing is scheduled for it. The service itself is
 * untouched, which is why nothing here filters services out of a catalog or an estimate.
 */

const rows = [
  // First on purpose: one unreadable configuration must not discard the flags that follow it
  { service_name: 'Broken Config First', scope_id: 0, configuration: '{not json' },
  { service_name: 'Garden Upkeep', scope_id: 0, configuration: JSON.stringify({ service_name: 'Garden Upkeep', skip_vendor_assignment: true }) },
  { service_name: 'Lift Maintenance', scope_id: 0, configuration: JSON.stringify({ service_name: 'Lift Maintenance' }) },
  { service_name: 'FP Only Cleaning', scope_id: 8, configuration: JSON.stringify({ service_name: 'FP Only Cleaning', skip_vendor_assignment: true }) },
  { service_name: 'Other FP Service', scope_id: 9, configuration: JSON.stringify({ service_name: 'Other FP Service', skip_vendor_assignment: true }) },
  // A configuration that cannot be read must not take a service out of scheduling
  { service_name: 'Broken Config', scope_id: 0, configuration: '{not json' }
];

let failQuery = false;
const queries = [];
const pool = { execute: async (sql, params = []) => {
  queries.push({ sql, params });
  if (failQuery) throw new Error('catalog unavailable');
  const scoped = sql.includes('scope_id IN');
  return [rows.filter(row => !scoped || row.scope_id === 0 || row.scope_id === Number(params[0]))];
} };
require.cache[require.resolve('../config/database')] = { exports: { pool } };
const { fetchVendorlessServiceNames, serviceNeedsVendor } = require('./vendorlessServices');
const { mapPendingServices } = require('./pendingProperties');

test('services arranged without a vendor are resolved by name, per scope, and fail open', async () => {
  const all = await fetchVendorlessServiceNames();
  assert.deepEqual([...all].sort(), ['fp only cleaning', 'garden upkeep', 'other fp service']);

  // An FP sees the admin-wide catalog plus its own, never another partner's
  const fp = await fetchVendorlessServiceNames(8);
  assert.deepEqual([...fp].sort(), ['fp only cleaning', 'garden upkeep']);
  assert.ok(queries.at(-1).sql.includes('scope_id IN (0, ?)'));
  assert.deepEqual(queries.at(-1).params, [8]);

  // Matching ignores case and padding, the way the rest of the scheduling module does
  assert.equal(serviceNeedsVendor('  GARDEN UPKEEP ', fp), false);
  assert.equal(serviceNeedsVendor('Lift Maintenance', fp), true);
  assert.equal(serviceNeedsVendor('Broken Config', fp), true);
  assert.equal(serviceNeedsVendor('Anything', null), true);
  assert.equal(serviceNeedsVendor(null, fp), true);

  // A catalog read failure must never hide a service from scheduling
  failQuery = true;
  assert.equal((await fetchVendorlessServiceNames(8)).size, 0);
  failQuery = false;
});

test('pending property rows report which services need a vendor and which do not', async () => {
  const vendorless = await fetchVendorlessServiceNames(8);
  const services = [{ service: 'Garden Upkeep', frequencyCount: 12 }, { service: 'Lift Maintenance', frequencyCount: 4 }];
  const vendorMap = new Map([['7::lift maintenance', { vendorId: 5, vendorName: 'Otis Care' }]]);
  const rows = mapPendingServices(services, 7, vendorMap, vendorless);

  assert.equal(rows[0].vendorRequired, false);
  assert.equal(rows[0].vendorAssigned, false);
  assert.equal(rows[1].vendorRequired, true);
  assert.equal(rows[1].vendorAssigned, true);
  // Nothing is awaiting a vendor: the assigned one has it, the other never needs one
  assert.equal(rows.filter(row => row.vendorRequired && !row.vendorAssigned).length, 0);
  // Without the set every service still needs a vendor, so older callers are unaffected
  assert.deepEqual(mapPendingServices(services, 7, vendorMap).map(row => row.vendorRequired), [true, true]);
});
