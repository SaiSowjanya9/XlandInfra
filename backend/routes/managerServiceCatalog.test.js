const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const baseConfig = { service_name: 'Camera Maintenance', category: 'Generator', pricing_method: 'quantity_based', unit: 'Camera',
  applicable_property_types: ['APT', 'VILLA'], default_frequency: 'Quarterly', default_visits_per_year: 4, allow_frequency_override: true,
  allow_manual_visits: false, default_markup_percentage: 35, rate_per_quantity: 250, description: 'Saved service description' };
const services = [
  { id: 1, scope_id: 0, configuration: JSON.stringify(baseConfig) },
  { id: 2, scope_id: 8, configuration: JSON.stringify(baseConfig) },
  { id: 3, scope_id: 9, configuration: JSON.stringify(baseConfig) }
];
const properties = [
  { id: 11, franchise_partner_id: 8, entry_type: 'APT', community_name: 'North Apartments', zone: 'North', created_by: 'other', property_id: 'APT-NORTH', customer_name: 'Customer', status: 'active' },
  { id: 12, franchise_partner_id: 8, entry_type: 'APT', community_name: 'South Apartments', zone: 'South', created_by: 'other', status: 'active' },
  { id: 13, franchise_partner_id: 9, entry_type: 'APT', community_name: 'Other FP', zone: 'North', status: 'active' },
  { id: 14, franchise_partner_id: 8, entry_type: 'APT', community_name: 'Inactive', zone: 'North', status: 'inactive' },
  { id: 15, franchise_partner_id: 8, entry_type: 'APT', community_name: 'Own Property', zone: 'South', created_by: 'manager-test', status: 'active' }
];
const regular = [{ id: 11, franchise_partner_id: 8, property_type: 'VILLA', name: 'Regular Villa', zone_id: 'North', property_id: 'VILLA-NORTH', status: 'active', contact_person: 'Villa Customer' }];
const vendors = [{ id: 4, franchise_partner_id: 8, name: 'North Vendor', zone: 'North', status: 'active' },
  { id: 5, franchise_partner_id: 8, name: 'South Vendor', zone: 'South', status: 'active' },
  { id: 6, franchise_partner_id: 9, name: 'Other FP Vendor', zone: 'North', status: 'active' }];
const inserts = [];
const visible = (rows, sql, params, alias) => {
  assert.ok(sql.includes(`${alias}.franchise_partner_id = ?`));
  return rows.filter(row => row.franchise_partner_id === Number(params[0]) && row.status === 'active' &&
    (!sql.includes(`${alias}.created_by`) || params.includes(row.zone || row.zone_id) || params.includes(row.created_by)));
};
const pool = { execute: async (sql, params = []) => {
  if (sql.includes('FROM fp_employees')) return [[{ id: params[0], is_active: 1, franchise_partner_id: 8 }]];
  if (sql.includes('FROM users')) return [[{ id: params[0], is_active: 1 }]];
  if (sql.includes('FROM fp_employee_zones')) return [[{ zone_name: params[0] === 7 ? 'all' : 'North' }]];
  if (sql.includes('FROM fp_amc_packages')) return [[...(Number(params[0]) === 20 && Number(params[1]) === 8 ? [{ id: 20, price: 1000 }] : [])]];
  if (sql.includes('FROM fp_addons')) return [[...(Number(params[0]) === 21 && Number(params[1]) === 8 ? [{ id: 21, price: 500, service_name: 'Legacy Service', frequency_type: 'Monthly', frequency_count: 12 }] : [])]];
  if (sql.includes('FROM service_catalog')) return [services.filter(row => {
    const byId = sql.includes('WHERE id = ?');
    if (byId && row.id !== Number(params[0])) return false;
    return !sql.includes('scope_id IN') || row.scope_id === 0 || row.scope_id === Number(params[byId ? 1 : 0]);
  })];
  if (sql.includes('FROM onboarded_properties p') || sql.includes('FROM properties p')) {
    const records = sql.includes('FROM onboarded_properties p') ? properties : regular;
    return [visible(records, sql, params, 'p').filter(row => !sql.includes('AND p.id = ?') || row.id === Number(params[1]))];
  }
  if (sql.includes('FROM onboarded_vendors v')) {
    const idCount = sql.match(/AND v.id IN \(([^)]+)\)/)?.[1].split(',').length;
    return [visible(vendors, sql, params, 'v').filter(row => !idCount || params.slice(1, 1 + idCount).includes(row.id))];
  }
  if (sql.includes('FROM onboarded_vendors WHERE id = ?')) return [vendors.filter(row => row.id === Number(params[0]))];
  if (sql.startsWith('INSERT INTO fp_estimates')) {
    assert.equal((sql.match(/\?/g) || []).length, params.length);
    inserts.push(params);
    return [{ insertId: inserts.length }];
  }
  throw new Error(`Unexpected SQL: ${sql}`);
} };
require.cache[require.resolve('../config/database')] = { exports: { pool } };
const { authenticate, generateToken } = require('../middleware/auth');
const { attachManagerScope } = require('../middleware/managerScope');
const router = require('./managerServiceCatalog');

test('Manager catalog is read-only and estimate operations enforce FP, property-source and zone scope', async t => {
  const app = express();
  app.use(express.json());
  app.use('/catalog', authenticate, attachManagerScope, router);
  app.post('/catalog-package', authenticate, attachManagerScope, router.validatePackageEstimate, (req, res) => res.json({ success: true, data: req.body }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/catalog`;
  const tokens = {
    manager: generateToken({ id: 2, username: 'manager-test', role: 'manager', franchisePartnerId: 8 }),
    supervisor: generateToken({ id: 3, role: 'supervisor', franchisePartnerId: 8 }),
    standalone: generateToken({ id: 6, username: 'standalone', role: 'manager' }),
    allZones: generateToken({ id: 7, username: 'all-zones', role: 'manager', franchisePartnerId: 8 }),
    staleScope: generateToken({ id: 2, username: 'manager-test', role: 'manager', franchisePartnerId: 9 })
  };
  const request = async (path = '', method = 'GET', body, actor = 'manager') => {
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${tokens[actor]}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, ...(await response.json()) };
  };
  assert.equal((await request('', 'GET', null, null)).status, 401);
  assert.equal((await request('', 'GET', null, 'supervisor')).status, 403);
  assert.deepEqual((await request('?fpId=all')).data.map(row => row.id), [1, 2]);
  assert.equal((await request('?fpId=9')).status, 403);
  assert.equal((await request('', 'GET', null, 'staleScope')).status, 403);
  assert.equal((await request('', 'POST', baseConfig)).status, 403);
  assert.equal((await request('/2', 'PUT', baseConfig)).status, 403);
  assert.equal((await request('/3/quote', 'POST', { property_type: 'APT', quantity: 10 })).status, 404);
  assert.equal((await request('/2/quote', 'POST', { property_type: 'APT', quantity: 10 })).data.totalPrice, 13500);
  const options = await request('/estimate-options');
  assert.equal(options.status, 200);
  assert.deepEqual(options.data.properties.map(row => `${row.source_table}:${row.id}`), ['onboarded_properties:11', 'onboarded_properties:15', 'properties:11']);
  assert.deepEqual(options.data.vendors.map(row => row.id), [4]);
  const body = { property_id: 11, property_source: 'onboarded_properties', rows: [{ service_id: 2, vendor_id: 4, inputs: { quantity: 10 } }], discount_percentage: 0, gst_percentage: 0, notes: '' };
  for (const changed of [{ property_id: 12 }, { property_id: 13 }, { property_id: 14 }, { fpId: 9 }, { rows: [{ ...body.rows[0], vendor_id: 5 }] }, { rows: [{ ...body.rows[0], vendor_id: 6 }] }]) {
    assert.equal((await request('/custom-estimates/quote', 'POST', { ...body, ...changed })).status, 403);
  }
  assert.equal((await request('/custom-estimates/quote', 'POST', { ...body, property_source: 'users' })).status, 400);
  assert.equal((await request('/custom-estimates/quote', 'POST', { ...body, rows: [{ ...body.rows[0], service_id: 3 }] })).status, 400);
  const quoted = await request('/custom-estimates/quote', 'POST', body);
  assert.equal(quoted.data.summary.total, 13500);
  const saved = await request('/custom-estimates', 'POST', { ...body, property_source: 'properties', total: 1 });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.property.community_name, 'Regular Villa');
  assert.equal(saved.data.summary.total, 13500);
  assert.equal(inserts[0][1], 8);
  assert.equal(inserts[0][21], 2);
  const addons = JSON.parse(inserts[0][19]);
  assert.equal(addons[0].propertySnapshot.source_table, 'properties');
  assert.equal(addons[0].propertySnapshot.property_id, 'VILLA-NORTH');
  assert.equal(addons[0].pricingInputs.quantity, 10);
  assert.deepEqual((await request('', 'GET', null, 'standalone')).data.map(row => row.id), [1]);
  assert.equal((await request('/estimate-options', 'GET', null, 'standalone')).status, 403);
  assert.equal((await request('/custom-estimates', 'POST', body, 'standalone')).status, 403);
  const unrestricted = await request('/estimate-options', 'GET', null, 'allZones');
  assert.ok(unrestricted.data.properties.some(row => row.id === 12));
  assert.ok(!unrestricted.data.properties.some(row => row.franchise_partner_id === 9));
  const packageEstimate = { estimate_type: 'property_based', property_type: 'APT', catalog_property_id: 11, catalog_property_source: 'onboarded_properties',
    package_id: 20, package_price: 1, addons: [{ id: 21, price: 500 }, { catalogServiceId: 2, totalPrice: 13500, pricingInputs: { quantity: 10 } }],
    subtotal: 15000, discount_percent: 10, gst_percent: 18, total_amount: 15930 };
  const validated = await request('-package', 'POST', packageEstimate);
  assert.equal(validated.status, 200);
  assert.equal(validated.data.package_price, 1000);
  assert.equal(validated.data.property_id, 11);
  assert.equal(validated.data.property_code, 'APT-NORTH');
  assert.equal(validated.data.addons[1].pricingSnapshot.vendorCost, 10000);
  assert.equal(validated.data.discount_amount, 1500);
  assert.equal(validated.data.gst_amount, 2430);
  assert.equal((await request('-package', 'POST', { ...packageEstimate, total_amount: 1 })).status, 400);
  assert.equal((await request('-package', 'POST', { ...packageEstimate, catalog_property_id: 12 })).status, 403);
  assert.equal((await request('-package', 'POST', { ...packageEstimate, package_id: 99 })).status, 403);
  assert.equal((await request('-package', 'POST', packageEstimate, 'supervisor')).status, 403);
  // A custom estimate: no package, services typed in by hand, totals still added up on the server
  const manual = { addonId: 'CUSTOM-1', customService: true, name: 'Facade Cleaning', description: '4 Lifts',
    frequency_type: 'Quarterly', frequency_count: 4, totalPrice: 8000, price: 8000 };
  const customOnly = await request('-package', 'POST', { estimate_type: 'direct', property_type: 'APT',
    addons: [manual], subtotal: 8000, discount_percent: 0, gst_percent: 18, total_amount: 9440 });
  assert.equal(customOnly.status, 200, 'a custom estimate saves without a package');
  assert.equal(customOnly.data.addons[0].name, 'Facade Cleaning');
  assert.equal(customOnly.data.subtotal, 8000);
  assert.equal((await request('-package', 'POST', { estimate_type: 'direct', property_type: 'APT',
    addons: [{ ...manual, name: '' }], subtotal: 8000, total_amount: 8000 })).status, 400, 'a nameless service is refused');
});
