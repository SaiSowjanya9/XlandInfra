const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const rows = [];
const estimateInserts = [];
const properties = [{ id: 3, property_id: 'PROP-TEST', entry_type: 'APT', community_name: 'Test Apartments', zone: 'Test Zone', address: 'Test Address', franchise_partner_id: 8, customer_name: 'Test Customer' }];
const vendors = [{ id: 4, name: 'Test Vendor', franchise_partner_id: 8 }, { id: 5, name: 'Other FP Vendor', franchise_partner_id: 9 }];
const pool = { execute: async (sql, params = []) => {
  if (sql.includes('FROM onboarded_properties p')) return [sql.includes('WHERE p.id = ?') ? properties.filter(property => property.id === Number(params[0])) : properties];
  if (sql.includes('FROM onboarded_vendors')) return [sql.includes('WHERE id = ?') ? vendors.filter(vendor => vendor.id === Number(params[0])) : vendors];
  if (sql.startsWith('INSERT INTO estimates')) { assert.equal((sql.match(/\?/g) || []).length, params.length); estimateInserts.push(params); return [{ insertId: estimateInserts.length }]; }
  if (sql.startsWith('UPDATE service_catalog')) {
    const row = rows.find(row => row.id === Number(params[2]));
    row.service_name = params[0]; row.configuration = params[1];
    return [{ affectedRows: 1 }];
  }
  if (sql.includes('FROM users')) return [[{ id: 1, is_active: 1 }]];
  if (sql.includes('FROM franchise_partners')) return [[{ id: params[0] }]];
  if (sql.includes('FROM admin_categories')) return [[]];
  if (sql.startsWith('INSERT INTO service_catalog')) {
    if (rows.some(row => row.service_name === params[0] && row.scope_id === params[1])) throw Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' });
    const id = rows.length + 1;
    rows.push({ id, service_name: params[0], scope_id: params[1], configuration: params[2], created_by: params[3] });
    return [{ insertId: id }];
  }
  if (sql.includes('FROM service_catalog WHERE id = ?')) return [rows.filter(row => row.id === Number(params[0]))];
  if (sql.includes('FROM service_catalog')) return [rows.filter(row => !params.length || row.scope_id === 0 || row.scope_id === Number(params[0]))];
  throw new Error(`Unexpected query: ${sql}`);
} };
require.cache[require.resolve('../config/database')] = { exports: { pool } };
const { generateToken } = require('../middleware/auth');
const { router, validateCatalogEstimate } = require('./serviceCatalog');

const config = {
  service_name: 'Generator Maintenance', category: 'Generator', pricing_method: 'quantity_based', unit: 'Lifts',
  applicable_property_types: ['APT', 'GC'], default_frequency: 'Monthly', default_visits_per_year: 12,
  allow_frequency_override: true, allow_manual_visits: false, default_markup_percentage: 50,
  description: 'Saved description', rate_per_quantity: 125.5
};

test('catalog API permissions, persistence contract, quoting and estimate validation', async t => {
  const app = express();
  app.use(express.json());
  app.use('/catalog', router);
  app.post('/estimates', validateCatalogEstimate, (req, res) => res.json({ success: true, data: req.body }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const tokens = Object.fromEntries(['admin', 'operations_manager', 'supervisor'].map(role => [role, generateToken({ id: 1, role })]));
  const request = async (path, method = 'GET', body, role = 'admin') => {
    const response = await fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, ...(await response.json()) };
  };
  await t.test('unauthenticated and unauthorized users cannot create or quote services', async () => {
    assert.equal((await request('/catalog', 'POST', config, null)).status, 401);
    assert.equal((await request('/catalog', 'POST', config, 'supervisor')).status, 403);
    assert.equal((await request('/catalog', 'POST', config, 'operations_manager')).status, 403);
    assert.equal((await request('/catalog/1/quote', 'POST', {}, 'operations_manager')).status, 403);
  });
  await t.test('create persists selected method fields and rejects duplicate/invalid requests', async () => {
    const created = await request('/catalog', 'POST', config);
    assert.equal(created.status, 201);
    assert.equal(created.data.rate_per_quantity, 125.5);
    assert.equal(created.data.fixed_price, undefined);
    assert.equal((await request('/catalog', 'POST', config)).status, 409);
    assert.equal((await request('/catalog', 'POST', { ...config, service_name: 'Invalid', category: 'Does not exist' })).status, 400);
    assert.equal((await request('/catalog', 'POST', { ...config, service_name: 'Invalid', default_visits_per_year: 8 })).status, 400);
  });
  await t.test('fresh list returns saved settings and honors property and FP filtering', async () => {
    await request('/catalog', 'POST', { ...config, service_name: 'FP-only', franchise_partner_id: 9 });
    assert.equal((await request('/catalog?fpId=8&propertyType=Apartment')).data.length, 1);
    assert.equal((await request('/catalog?fpId=9')).data.length, 2);
    assert.equal((await request('/catalog?propertyType=PLOT')).data.length, 0);
    const list = await request('/catalog');
    assert.equal(list.data[0].description, 'Saved description');
    assert.equal(list.data[0].allow_manual_visits, false);
  });
  await t.test('quote applies inputs, respects service scope, and rejects unknown service', async () => {
    const result = await request('/catalog/1/quote', 'POST', { property_type: 'APT', quantity: 3 });
    assert.equal(result.data.totalPrice, 6777);
    assert.equal((await request('/catalog/2/quote', 'POST', { property_type: 'APT', quantity: 1, fpId: 8 })).status, 400);
    assert.equal((await request('/catalog/999/quote', 'POST', { property_type: 'APT' })).status, 404);
  });
  await t.test('custom estimates support multiple service rows, selected vendors and operating costs without a package', async () => {
    const body = { fpId: 8, property_id: 3, rows: [
      { service_id: 1, vendor_id: 4, inputs: { quantity: 3, operating_cost: 1800, markup_percentage: 35 } },
      { service_id: 1, vendor_id: 4, inputs: { quantity: 1, frequency: 'Yearly', operating_cost: 0 } }
    ], discount_percentage: 0, gst_percentage: 18, notes: 'Test estimate' };
    const quoted = await request('/catalog/custom-estimates/quote', 'POST', body);
    assert.equal(quoted.status, 200);
    assert.equal(quoted.data.rows[0].actualCost, 6318);
    assert.equal(quoted.data.rows[0].totalPrice, 8529.3);
    assert.equal(quoted.data.summary.subtotal, 8717.55);
    const saved = await request('/catalog/custom-estimates', 'POST', { ...body, total: 1 });
    assert.equal(saved.status, 201);
    assert.equal(saved.data.summary.subtotal, 8717.55);
    assert.equal(JSON.parse(estimateInserts[0][11])[0].pricingSnapshot.vendor_name, 'Test Vendor');
    assert.equal(JSON.parse(estimateInserts[0][11])[0].pricingSnapshot.operatingCost, 1800);
    assert.equal((await request('/catalog/custom-estimates', 'POST', body, 'operations_manager')).status, 403);
    assert.equal((await request('/catalog/custom-estimates/quote', 'POST', { ...body, fpId: 9 })).status, 400);
    assert.equal((await request('/catalog/custom-estimates/quote', 'POST', { ...body, rows: [{ ...body.rows[0], vendor_id: 5 }] })).status, 400);
    assert.equal((await request('/catalog/custom-estimates/quote', 'POST', { ...body, rows: [{ ...body.rows[0], service_id: 2 }] })).status, 400);
    assert.equal((await request('/catalog/custom-estimates/quote', 'POST', { ...body, rows: [] })).status, 400);
    assert.equal((await request('/catalog/custom-estimates/quote', 'POST', { ...body, discount_percentage: 101 })).status, 400);
    assert.equal((await request('/catalog/custom-estimates/quote', 'POST', { ...body, discount_percentage: 90 })).status, 200);
  });
  await t.test('service edit reloads configuration and remains restricted to admins', async () => {
    assert.equal((await request('/catalog/1', 'PUT', config, 'operations_manager')).status, 403);
    const updated = await request('/catalog/1', 'PUT', { ...config, description: 'Updated description' });
    assert.equal(updated.status, 200);
    assert.equal((await request('/catalog')).data[0].description, 'Updated description');
    assert.equal((await request('/catalog/999', 'PUT', config)).status, 404);
  });
  const estimate = {
    propertyType: 'APT', packageRate: 1000, subTotal: 7777, gst: 0, totalPrice: 7777,
    addons: [{ addonId: 'CAT-1', catalogServiceId: 1, totalPrice: 6777, pricingInputs: { quantity: 3 }, services: [{ name: 'Tampered name', price: 1 }] }]
  };
  await t.test('saved estimate is rebuilt from server settings and retains an auditable snapshot', async () => {
    const saved = await request('/estimates', 'POST', estimate);
    assert.equal(saved.status, 200);
    assert.equal(saved.data.addons[0].name, config.service_name);
    assert.equal(saved.data.addons[0].services[0].frequency, 12);
    assert.equal(saved.data.addons[0].pricingSnapshot.vendorCost, 4518);
  });
  await t.test('tampered totals, unauthorized save and duplicates fail; discounts have no margin policy', async () => {
    assert.equal((await request('/estimates', 'POST', estimate, null)).status, 401);
    assert.equal((await request('/estimates', 'POST', { ...estimate, totalPrice: 1 })).status, 400);
    assert.equal((await request('/estimates', 'POST', { ...estimate, addons: [{ ...estimate.addons[0], totalPrice: 1 }] })).status, 400);
    assert.equal((await request('/estimates', 'POST', { ...estimate, discount: 1000, totalPrice: 6777 })).status, 200);
    assert.equal((await request('/estimates', 'POST', { ...estimate, addons: [estimate.addons[0], estimate.addons[0]] })).status, 400);
  });
});
