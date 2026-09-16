const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const mysql = require('mysql2/promise');
const { validateService, calculateServiceQuote } = require('./servicePricing');

test('local MySQL migration is idempotent and service configuration survives a database round trip', { skip: process.env.RUN_LOCAL_MYSQL_TESTS !== '1' }, async () => {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.LOCAL_DB_HOST));
  assert.equal(process.env.LOCAL_DB_NAME, 'customer_portal_local');
  const connection = await mysql.createConnection({
    host: process.env.LOCAL_DB_HOST, port: process.env.LOCAL_DB_PORT || 3306,
    user: process.env.LOCAL_DB_USER, password: process.env.LOCAL_DB_PASSWORD,
    database: process.env.LOCAL_DB_NAME
  });
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../database/migrations/schema_v32_service_catalog.sql'), 'utf8');
    await connection.execute(sql);
    await connection.execute(sql);
    await connection.beginTransaction();
    const config = validateService({
      service_name: `Service catalog transaction test ${Date.now()}`, category: 'Generator', pricing_method: 'capacity_slab', unit: 'KVA',
      applicable_property_types: ['APT', 'GC', 'IH'], default_frequency: 'Every 2 Months', default_visits_per_year: 6,
      allow_frequency_override: true, allow_manual_visits: true, default_markup_percentage: 50,
      description: 'Round-trip validation',
      capacity_slabs: [{ capacityFrom: 0, capacityTo: 25, vendorRate: 2000.75, isCustomQuote: false }, { capacityFrom: 26, capacityTo: null, vendorRate: null, isCustomQuote: true }]
    });
    const [insert] = await connection.execute('INSERT INTO service_catalog (service_name, scope_id, configuration, created_by) VALUES (?, 0, ?, 1)', [config.service_name, JSON.stringify(config)]);
    const [rows] = await connection.execute('SELECT * FROM service_catalog WHERE id = ?', [insert.insertId]);
    const stored = typeof rows[0].configuration === 'string' ? JSON.parse(rows[0].configuration) : rows[0].configuration;
    assert.deepEqual(stored, config);
    assert.equal(calculateServiceQuote(stored, { property_type: 'APT', capacity: 25 }, 'admin').totalPrice, 18006.75);
    assert.equal(calculateServiceQuote(stored, { property_type: 'APT', capacity: 26 }, 'admin').requiresCustomQuote, true);
    await assert.rejects(connection.execute('INSERT INTO service_catalog (service_name, scope_id, configuration, created_by) VALUES (?, 0, ?, 1)', [config.service_name, JSON.stringify(config)]), { code: 'ER_DUP_ENTRY' });
    const suffix = Date.now();
    const [property] = await connection.execute(
      `INSERT INTO onboarded_properties (property_id, entry_type, category, zone, area_name, division, property_type, community_name, status)
       VALUES (?, 'APT', 'residential', 'Test Zone', 'Test Area', 'Test Division', 'Apartment', 'Transaction Test Apartments', 'active')`, [`TEST-PROP-${suffix}`]
    );
    const [vendor] = await connection.execute(
      `INSERT INTO onboarded_vendors (vendor_id, service_type, owner_name, status) VALUES (?, 'Generator', 'Transaction Test Vendor', 'active')`, [`TEST-VENDOR-${suffix}`]
    );
    const [admins] = await connection.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    assert.ok(admins.length, 'The local database must have a seeded admin user.');
    require.cache[require.resolve('../config/database')] = { exports: { pool: connection } };
    const express = require('express');
    const { generateToken } = require('../middleware/auth');
    const { router } = require('../routes/serviceCatalog');
    const app = express();
    app.use(express.json());
    app.use('/catalog', router);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/catalog/custom-estimates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${generateToken({ id: admins[0].id, role: 'admin' })}` },
        body: JSON.stringify({ property_id: property.insertId, fpId: 'all', notes: 'Transactional test', rows: [{ service_id: insert.insertId, vendor_id: vendor.insertId, inputs: { capacity: 25, operating_cost: 1800, markup_percentage: 35 } }] })
      });
      const result = await response.json();
      assert.equal(response.status, 201, result.message);
      const [saved] = await connection.execute('SELECT addons, total, estimate_type, status FROM estimates WHERE estimate_id = ?', [result.data.estimateId]);
      assert.equal(saved.length, 1);
      const addons = typeof saved[0].addons === 'string' ? JSON.parse(saved[0].addons) : saved[0].addons;
      assert.equal(addons[0].pricingSnapshot.vendor_id, vendor.insertId);
      assert.equal(addons[0].pricingSnapshot.operatingCost, 1800);
      assert.equal(addons[0].pricingSnapshot.actualCost, 13804.5);
      assert.equal(Number(saved[0].total), result.data.summary.total);
      assert.equal(saved[0].estimate_type, 'custom');
      assert.equal(saved[0].status, 'Draft');
    } finally { await new Promise(resolve => server.close(resolve)); }
  } finally {
    await connection.rollback();
    await connection.end();
  }
});
