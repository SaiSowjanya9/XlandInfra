const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const baseConfig = { service_name: 'Camera Maintenance', category: 'Generator', pricing_method: 'quantity_based', unit: 'Camera',
  applicable_property_types: ['APT', 'VILLA'], default_frequency: 'Quarterly', default_visits_per_year: 4, allow_frequency_override: true,
  allow_manual_visits: false, default_markup_percentage: 35, rate_per_quantity: 250, description: 'Parts&#x2F;labour included' };
const services = [
  { id: 1, scope_id: 0, configuration: JSON.stringify(baseConfig) },
  { id: 2, scope_id: 8, configuration: JSON.stringify(baseConfig) },
  { id: 3, scope_id: 9, configuration: JSON.stringify(baseConfig) }
];
const onboarded = [{ id: 11, franchise_partner_id: 8, entry_type: 'APT', community_name: 'North Apartments', property_id: 'APT-NORTH' },
  { id: 13, franchise_partner_id: 9, entry_type: 'APT', community_name: 'Other FP', property_id: 'APT-OTHER' }];
const regular = [{ id: 11, franchise_partner_id: 8, property_type: 'VILLA', name: 'Regular Villa', property_id: 'VILLA-NORTH' }];
const pool = { execute: async (sql, params = []) => {
  if (sql.includes('FROM fp_employees') || sql.includes('FROM users')) return [[{ id: params[0], is_active: 1, franchise_partner_id: 8 }]];
  if (sql.includes('FROM service_catalog')) return [services.filter(row => {
    const byId = sql.includes('WHERE id = ?');
    if (byId && row.id !== Number(params[0])) return false;
    return !sql.includes('scope_id IN') || row.scope_id === 0 || row.scope_id === Number(params[byId ? 1 : 0]);
  })];
  if (sql.includes('FROM onboarded_properties WHERE id = ?') || sql.includes('FROM properties WHERE id = ?')) {
    const rows = sql.includes('onboarded_properties') ? onboarded : regular;
    return [rows.filter(row => row.id === Number(params[0]) && (!sql.includes('franchise_partner_id = ?') || row.franchise_partner_id === Number(params[1])))];
  }
  // Category and unit sources the dropdowns read; none of them matter here
  if (/admin_categories|service_categories|fp_estimates|fp_amc_packages|service_units/.test(sql)) return [[]];
  throw new Error(`Unexpected SQL: ${sql}`);
} };
require.cache[require.resolve('../config/database')] = { exports: { pool } };
const { authenticate, generateToken } = require('../middleware/auth');
const { attachCoordinatorScope } = require('../middleware/coordinatorScope');
const { createStaffCatalogRouter, validateStaffCatalogEstimate } = require('./staffServiceCatalog');

test('Coordinator catalog is read-only, FP-scoped and decoded; configured services on an estimate are re-priced', async t => {
  const app = express();
  app.use(express.json());
  app.use('/catalog', authenticate, attachCoordinatorScope, createStaffCatalogRouter('coordinator'));
  app.post('/estimates', authenticate, attachCoordinatorScope, validateStaffCatalogEstimate('coordinator'), (req, res) => res.json({ success: true, data: req.body }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = generateToken({ id: 4, username: 'coordinator-test', role: 'coordinator', franchisePartnerId: 8 });
  const request = async (path, method = 'GET', body, auth = token) => {
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, ...(await response.json()) };
  };

  assert.equal((await request('/catalog', 'GET', null, null)).status, 401);
  const listed = await request('/catalog?fpId=all&propertyType=APT');
  assert.deepEqual(listed.data.map(row => row.id), [1, 2], 'shared and own services only');
  assert.equal(listed.data[0].description, 'Parts/labour included', 'text is decoded for the form');
  assert.equal((await request('/catalog?fpId=9')).status, 403);
  assert.equal((await request('/catalog/categories')).canManage, false);
  assert.equal((await request('/catalog/units?pricing_method=quantity_based')).data.some(unit => unit.name === 'Camera'), true);
  for (const [path, method] of [['/catalog', 'POST'], ['/catalog/2', 'PUT'], ['/catalog/2', 'DELETE'], ['/catalog/categories', 'POST'], ['/catalog/units', 'POST']]) {
    assert.equal((await request(path, method, baseConfig)).status, 403, `${method} ${path}`);
  }
  assert.equal((await request('/catalog/3/quote', 'POST', { property_type: 'APT', quantity: 10 })).status, 404);
  const quote = (await request('/catalog/2/quote', 'POST', { property_type: 'APT', quantity: 10 })).data;
  assert.equal(quote.totalPrice, 13500);

  const addon = { addonId: 'CAT-2', catalogServiceId: 2, name: 'Camera Maintenance', totalPrice: quote.totalPrice, pricingInputs: quote.inputs };
  const manual = { addonId: 'CUSTOM-1', customService: true, name: 'Deep cleaning', frequency_type: 'Monthly', frequency_count: 12, totalPrice: 1200, price: 1200 };
  const estimate = { estimate_type: 'property_based', property_code: 'APT-NORTH', property_type: 'APT', catalog_property_id: 11, addons: [addon, manual] };
  const saved = await request('/estimates', 'POST', estimate);
  assert.equal(saved.status, 200, saved.message);
  assert.equal(saved.data.addons.length, 2);
  assert.equal(saved.data.addons[0].totalPrice, 13500);
  assert.ok(saved.data.addons[0].pricingSnapshot, 'stored as the server priced it');
  // Two tables number their rows independently: the property code picks the one meant
  assert.equal((await request('/estimates', 'POST', { ...estimate, property_code: 'VILLA-NORTH', property_type: 'VILLA' })).status, 200);
  assert.equal((await request('/estimates', 'POST', { ...estimate, addons: [{ ...addon, totalPrice: 1 }] })).status, 400, 'a tampered price is refused');
  assert.equal((await request('/estimates', 'POST', { ...estimate, catalog_property_id: 13 })).status, 403, 'another FP\'s property is refused');
  assert.equal((await request('/estimates', 'POST', { ...estimate, addons: [{ ...addon, catalogServiceId: 3, addonId: 'CAT-3' }] })).status, 403);
  assert.equal((await request('/estimates', 'POST', { ...estimate, addons: [addon, addon] })).status, 400, 'a duplicate configured service is refused');
  // An estimate with no configured service passes through untouched
  const plain = await request('/estimates', 'POST', { estimate_type: 'direct', addons: [manual] });
  assert.deepEqual(plain.data.addons, [manual]);
});
