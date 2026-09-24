const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const baseConfig = { service_name: 'Camera Maintenance', category: 'Generator', pricing_method: 'quantity_based', unit: 'Camera',
  applicable_property_types: ['APT', 'VILLA'], default_frequency: 'Quarterly', default_visits_per_year: 4, allow_frequency_override: true,
  allow_manual_visits: false, default_markup_percentage: 35, rate_per_quantity: 250, description: 'Saved service description' };
const slabConfig = { ...baseConfig, service_name: 'Generator Slabs', pricing_method: 'capacity_slab', unit: 'KVA',
  capacity_slabs: [{ capacityFrom: 0, capacityTo: 25, vendorRate: 2000, isCustomQuote: false, defaultFrequency: 'Quarterly', defaultVisitsPerYear: 4 },
    { capacityFrom: 26, capacityTo: null, vendorRate: null, isCustomQuote: true, defaultFrequency: 'Quarterly', defaultVisitsPerYear: 4 }] };
const services = [
  { id: 1, scope_id: 0, configuration: JSON.stringify(baseConfig) },
  { id: 2, scope_id: 8, configuration: JSON.stringify(baseConfig) },
  { id: 3, scope_id: 9, configuration: JSON.stringify(baseConfig) },
  { id: 4, scope_id: 8, configuration: JSON.stringify(slabConfig) }
];
const inserts = [];
const updates = [];
const pool = { execute: async (sql, params = []) => {
  if (sql.startsWith('INSERT INTO service_catalog')) {
    if (params[0] === 'Duplicate') throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
    inserts.push(params);
    return [{ insertId: 100 + inserts.length }];
  }
  if (sql.startsWith('UPDATE service_catalog')) {
    updates.push(params);
    return [{ affectedRows: 1 }];
  }
  if (sql.includes('FROM admin_categories')) return [[]];
  if (sql.includes('JSON_EXTRACT(configuration')) return [[{ name: 'Rope Access' }]];
  if (sql.includes('FROM franchise_partners')) return [[{ id: params[0], is_active: 1 }]];
  if (sql.includes('FROM fp_employees')) return [[{ id: params[0], is_active: 1, franchise_partner_id: 8 }]];
  if (sql.includes('FROM users')) return [[{ id: params[0], is_active: 1 }]];
  if (sql.includes('FROM fp_amc_packages')) return [[...(Number(params[0]) === 20 && Number(params[1]) === 8 ? [{ id: 20, price: 1000 }] : [])]];
  if (sql.includes('FROM fp_addons')) return [[...(Number(params[0]) === 21 && Number(params[1]) === 8 ? [{ id: 21, price: 500, service_name: 'Legacy Service', description: 'Legacy description', frequency_type: 'Monthly', frequency_count: 12 }] : [])]];
  if (sql.includes('FROM service_catalog')) {
    const byId = sql.includes('WHERE id = ?');
    return [services.filter(row => (!byId || row.id === Number(params[0])) &&
      (!sql.includes('scope_id IN') || row.scope_id === 0 || row.scope_id === Number(params[byId ? 1 : 0])))];
  }
  throw new Error(`Unexpected SQL: ${sql}`);
} };
require.cache[require.resolve('../config/database')] = { exports: { pool } };
const { authenticate, generateToken } = require('../middleware/auth');
const { attachFPScope } = require('../middleware/fpScope');
const router = require('./fpServiceCatalog');

test('FPs configure services in their own scope only, and estimates are re-priced on save', async t => {
  const app = express();
  app.use(express.json());
  app.use('/catalog', authenticate, attachFPScope, router);
  app.post('/fp-estimate', authenticate, attachFPScope, router.validatePackageEstimate, (req, res) => res.json({ success: true, data: req.body }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const tokens = {
    fp: generateToken({ id: 8, username: 'fp-test', role: 'franchise_partner' }),
    employee: generateToken({ id: 2, username: 'fp-manager', role: 'manager', franchisePartnerId: 8 }),
    noFp: generateToken({ id: 5, username: 'admin-test', role: 'admin' })
  };
  const request = async (path, method = 'GET', body, actor = 'fp') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${tokens[actor]}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, ...(await response.json()) };
  };

  assert.equal((await request('/catalog', 'GET', null, null)).status, 401);
  assert.equal((await request('/catalog', 'GET', null, 'noFp')).status, 403);
  assert.deepEqual((await request('/catalog?fpId=all')).data.map(row => row.id), [1, 2, 4]);
  assert.deepEqual((await request('/catalog?propertyType=Apartment')).data.map(row => row.id), [1, 2, 4]);
  assert.deepEqual((await request('/catalog?propertyType=PLOT')).data, []);
  assert.equal((await request('/catalog?fpId=9')).status, 403);
  const suggestions = (await request('/catalog/categories')).data.map(category => category.name);
  assert.ok(suggestions.includes('Generator'), 'the shared categories are offered');
  assert.ok(suggestions.includes('Rope Access'), 'a category typed on a saved service comes back as a suggestion');
  assert.equal(new Set(suggestions.map(name => name.toLowerCase())).size, suggestions.length, 'suggestions are de-duplicated');
  // FPs author their own services; staff and other scopes cannot
  const created = await request('/catalog', 'POST', baseConfig);
  assert.equal(created.status, 201);
  assert.equal(created.data.franchise_partner_id, 8);
  assert.equal(inserts[0][1], 8, 'the service is stored against the signed-in FP, never global');
  assert.equal((await request('/catalog', 'POST', { ...baseConfig, franchise_partner_id: 9 })).status, 403);
  assert.equal((await request('/catalog', 'POST', baseConfig, 'employee')).status, 403);
  assert.equal((await request('/catalog', 'POST', baseConfig, 'noFp')).status, 403);
  assert.equal((await request('/catalog', 'POST', { ...baseConfig, service_name: 'Blank Category', category: '   ' })).status, 400, 'a blank category is still refused');
  const custom = await request('/catalog', 'POST', { ...baseConfig, service_name: 'Custom Category Service', category: 'Rope Access' });
  assert.equal(custom.status, 201, 'a typed category is accepted');
  assert.equal(custom.data.category, 'Rope Access');
  assert.equal((await request('/catalog', 'POST', { ...baseConfig, pricing_method: 'custom_quote', unit: 'Quote' })).status, 400);
  assert.equal((await request('/catalog', 'POST', { ...baseConfig, service_name: 'Duplicate' })).status, 409);
  assert.equal((await request('/catalog/2', 'PUT', baseConfig)).status, 200);
  assert.equal(updates.at(-1)[2], '2');
  assert.equal((await request('/catalog/1', 'PUT', baseConfig)).status, 403, 'admin-owned global services stay read-only');
  assert.equal((await request('/catalog/3', 'PUT', baseConfig)).status, 403);
  assert.equal((await request('/catalog/99', 'PUT', baseConfig)).status, 404);
  assert.equal((await request('/catalog/2', 'PUT', baseConfig, 'employee')).status, 403);
  assert.equal((await request('/catalog/3/quote', 'POST', { property_type: 'APT', quantity: 10 })).status, 404);
  const quoted = await request('/catalog/2/quote', 'POST', { property_type: 'APT', quantity: 10 });
  assert.equal(quoted.data.totalPrice, 13500);
  assert.equal(quoted.data.vendorCost, 10000);
  assert.equal((await request('/catalog/2/quote', 'POST', { property_type: 'PLOT', quantity: 10 })).status, 400);
  // Above-range slab capacities need a custom quote, which stays with admins and managers
  assert.equal((await request('/catalog/4/quote', 'POST', { property_type: 'APT', capacity: 30 })).data.requiresCustomQuote, true);
  assert.equal((await request('/catalog/4/quote', 'POST', { property_type: 'APT', capacity: 30, custom_quote: 5000 })).status, 400);
  assert.equal((await request('/catalog/4/quote', 'POST', { property_type: 'APT', capacity: 20 })).data.totalPrice, 10800);
  assert.equal((await request('/catalog/2/quote', 'POST', { property_type: 'APT', quantity: 10 }, 'employee')).data.totalPrice, 13500);

  const estimate = { estimate_type: 'property_based', property_type: 'APT', package_id: 20, package_price: 1,
    addons: [{ id: 21, price: 1 }, { addonId: 'CAT-2', catalogServiceId: 2, totalPrice: 13500, pricingInputs: { quantity: 10 } }],
    subtotal: 15000, discount_percent: 10, gst_percent: 18, total_amount: 15930 };
  const saved = await request('/fp-estimate', 'POST', estimate);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.package_price, 1000);
  assert.equal(saved.data.addons[0].price, 500);
  assert.equal(saved.data.addons[0].name, 'Legacy Service');
  assert.equal(saved.data.addons[1].price, 13500);
  assert.equal(saved.data.addons[1].name, 'Camera Maintenance');
  assert.equal(saved.data.addons[1].frequency_type, 'Quarterly');
  assert.equal(saved.data.addons[1].frequency_count, 4);
  assert.equal(saved.data.addons[1].pricingSnapshot.vendorCost, 10000);
  assert.equal(saved.data.addons[1].pricingInputs.quantity, 10);
  assert.equal(saved.data.subtotal, 15000);
  assert.equal(saved.data.discount_amount, 1500);
  assert.equal(saved.data.gst_amount, 2430);
  assert.equal(saved.data.total_amount, 15930);

  assert.equal((await request('/fp-estimate', 'POST', { ...estimate, total_amount: 1 })).status, 400);
  assert.equal((await request('/fp-estimate', 'POST', { ...estimate, subtotal: 1 })).status, 400);
  assert.equal((await request('/fp-estimate', 'POST', { ...estimate, package_id: 99 })).status, 403);
  assert.equal((await request('/fp-estimate', 'POST', { ...estimate, gst_percent: 120 })).status, 400);
  assert.equal((await request('/fp-estimate', 'POST', { ...estimate,
    addons: [{ addonId: 'CAT-2', catalogServiceId: 2, totalPrice: 1, pricingInputs: { quantity: 10 } }], subtotal: 1001, total_amount: 1062.18 })).status, 400);
  assert.equal((await request('/fp-estimate', 'POST', { ...estimate,
    addons: [{ addonId: 'CAT-3', catalogServiceId: 3, totalPrice: 13500, pricingInputs: { quantity: 10 } }] })).status, 403);
  assert.equal((await request('/fp-estimate', 'POST', { ...estimate,
    addons: [estimate.addons[1], { ...estimate.addons[1] }] })).status, 400);
  assert.equal((await request('/fp-estimate', 'POST', { ...estimate, addons: [{ id: 21, price: 500 }] })).data.addons[0].price, 500);
  // Legacy-only estimates keep their own totals untouched
  const legacyOnly = await request('/fp-estimate', 'POST', { ...estimate, addons: [{ id: 21, price: 500 }], subtotal: 1500, total_amount: 1593 });
  assert.equal(legacyOnly.data.subtotal, 1500);
  assert.equal(legacyOnly.data.package_price, 1);
  assert.equal((await request('/fp-estimate', 'POST', estimate, 'noFp')).status, 403);

  // A custom estimate: no package, services typed in by hand. Their prices are the creator's, so
  // they are kept as entered, but the estimate's totals are still added up on the server.
  const manual = { addonId: 'CUSTOM-1', customService: true, name: 'Facade Cleaning', description: '4 Lifts',
    frequency_type: 'Quarterly', frequency_count: 4, totalPrice: 8000, price: 8000 };
  const customOnly = await request('/fp-estimate', 'POST', { estimate_type: 'direct', property_type: 'APT',
    addons: [manual], subtotal: 8000, discount_percent: 0, gst_percent: 18, total_amount: 9440 });
  assert.equal(customOnly.status, 200);
  assert.equal(customOnly.data.subtotal, 8000, 'a hand-entered service counts towards the subtotal');
  assert.equal(customOnly.data.addons[0].name, 'Facade Cleaning');
  assert.equal(customOnly.data.addons[0].frequency_count, 4);
  assert.equal(customOnly.data.addons[0].services[0].price, 2000, 'the per-visit price is derived from the visits');
  assert.equal(customOnly.data.gst_amount, 1440);
  // Mixed with a configured service: the catalog one is re-priced, the hand-entered one is not
  const mixed = await request('/fp-estimate', 'POST', { ...estimate,
    addons: [estimate.addons[1], manual], subtotal: 22500, discount_percent: 0, gst_percent: 0, total_amount: 22500 });
  assert.equal(mixed.status, 200);
  assert.equal(mixed.data.addons[1].price, 8000);
  assert.equal(mixed.data.subtotal, 22500);
  assert.equal((await request('/fp-estimate', 'POST', { estimate_type: 'direct', property_type: 'APT',
    addons: [{ ...manual, name: '  ' }], subtotal: 8000, total_amount: 8000 })).status, 400, 'a nameless service is refused');
  assert.equal((await request('/fp-estimate', 'POST', { estimate_type: 'direct', property_type: 'APT',
    addons: [{ ...manual, totalPrice: -5, price: -5 }], subtotal: -5, total_amount: -5 })).status, 400, 'a negative price is refused');
  assert.equal((await request('/fp-estimate', 'POST', { estimate_type: 'direct', property_type: 'APT',
    addons: [manual], subtotal: 1, total_amount: 1 })).status, 400, 'a total that does not add up is refused');
});
