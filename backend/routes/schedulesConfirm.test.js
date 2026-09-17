const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

/**
 * POST /api/schedules/confirm is what the "Review & Confirm" button saves through.
 * These checks run the real route against the local database and roll everything back.
 */
test('confirming a schedule saves its series and every visit, and re-confirming replaces them', { skip: process.env.RUN_LOCAL_MYSQL_TESTS !== '1' }, async () => {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.LOCAL_DB_HOST));
  assert.equal(process.env.LOCAL_DB_NAME, 'customer_portal_local');
  const connection = await require('mysql2/promise').createConnection({
    host: process.env.LOCAL_DB_HOST, port: process.env.LOCAL_DB_PORT || 3306,
    user: process.env.LOCAL_DB_USER, password: process.env.LOCAL_DB_PASSWORD, database: process.env.LOCAL_DB_NAME
  });
  require.cache[require.resolve('../config/database')] = { exports: { pool: connection } };
  const express = require('express');
  const { generateToken } = require('../middleware/auth');
  const router = require('./schedules');
  const app = express();
  app.use(express.json());
  app.use('/api/schedules', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));

  try {
    await connection.beginTransaction();
    const suffix = Date.now();
    const [admin] = await connection.execute(
      `INSERT INTO users (username, email, password_hash, role, first_name, last_name)
       VALUES (?, ?, 'x', 'admin', 'Schedule', 'Tester')`,
      [`schedule-test-${suffix}`, `schedule-test-${suffix}@example.test`]
    );
    const [property] = await connection.execute(
      `INSERT INTO onboarded_properties (property_id, entry_type, category, zone, area_name, division, property_type, community_name, status)
       VALUES (?, 'GC', 'residential', 'Zone A', 'Test Area', 'Test Division', 'Gated Community', 'Confirm Test Community', 'active')`,
      [`TEST-CONFIRM-${suffix}`]
    );
    const [vendor] = await connection.execute(
      `INSERT INTO onboarded_vendors (vendor_id, service_type, owner_name, company_name, status) VALUES (?, 'HVAC', 'Confirm Vendor', 'Confirm Vendor Co', 'active')`,
      [`TEST-VENDOR-${suffix}`]
    );
    const token = generateToken({ id: admin.insertId, role: 'admin', username: 'schedule-tester' });

    const confirm = async visits => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/schedules/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          propertyId: property.insertId, serviceId: 1, serviceName: 'HVAC', serviceCategory: 'HVAC',
          vendorId: vendor.insertId, vendorName: 'Confirm Vendor Co', frequency: 'monthly',
          totalVisits: visits.length, visits
        })
      });
      return { status: response.status, body: await response.json() };
    };
    const visit = (visitNumber, scheduledDate, time, isEdited = false) => ({
      visitNumber, targetDate: scheduledDate, scheduledDate, time,
      status: isEdited ? 'modified' : 'scheduled', isEdited
    });

    // The afternoon slot on visit 2 is the case the inline editor produces
    const first = await confirm([
      visit(1, '2026-09-26', '10:00 AM'),
      visit(2, '2026-10-26', '2:30 PM', true),
      visit(3, '2026-11-26', '10:00 AM')
    ]);
    assert.equal(first.status, 200, first.body.message || first.body.error);
    assert.equal(first.body.success, true);
    assert.equal(first.body.data.visitsCreated, 3);

    const seriesId = first.body.data.serviceScheduleId;
    const [[series]] = await connection.execute('SELECT * FROM property_service_schedules WHERE id = ?', [seriesId]);
    assert.equal(series.property_id, property.insertId);
    assert.equal(series.service_name, 'HVAC');
    assert.equal(series.vendor_id, vendor.insertId);
    assert.equal(series.frequency_type, 'monthly');
    assert.equal(series.total_visits, 3);
    assert.equal(series.status, 'active');
    assert.equal(series.scheduling_status, 'scheduled');

    const savedVisits = async () => {
      const [rows] = await connection.execute(
        'SELECT visit_number, scheduled_date, scheduled_time_start, vendor_id, status FROM scheduled_visits WHERE service_schedule_id = ? ORDER BY visit_number',
        [seriesId]
      );
      return rows.map(row => ({
        visit: row.visit_number,
        // Compare the stored calendar day, not a timezone-shifted ISO string
        date: `${row.scheduled_date.getFullYear()}-${String(row.scheduled_date.getMonth() + 1).padStart(2, '0')}-${String(row.scheduled_date.getDate()).padStart(2, '0')}`,
        time: row.scheduled_time_start, vendor: row.vendor_id, status: row.status
      }));
    };
    assert.deepEqual(await savedVisits(), [
      { visit: 1, date: '2026-09-26', time: '10:00:00', vendor: vendor.insertId, status: 'scheduled' },
      { visit: 2, date: '2026-10-26', time: '14:30:00', vendor: vendor.insertId, status: 'scheduled' },
      { visit: 3, date: '2026-11-26', time: '10:00:00', vendor: vendor.insertId, status: 'scheduled' }
    ]);

    // Confirming again must update the same series instead of duplicating visits
    const second = await confirm([visit(1, '2026-09-28', '9:00 AM', true), visit(2, '2026-10-28', '9:00 AM', true)]);
    assert.equal(second.status, 200, second.body.message || second.body.error);
    assert.equal(second.body.data.serviceScheduleId, seriesId);
    assert.deepEqual(await savedVisits(), [
      { visit: 1, date: '2026-09-28', time: '09:00:00', vendor: vendor.insertId, status: 'scheduled' },
      { visit: 2, date: '2026-10-28', time: '09:00:00', vendor: vendor.insertId, status: 'scheduled' }
    ]);
    const [[{ count }]] = await connection.execute('SELECT COUNT(*) AS count FROM property_service_schedules WHERE property_id = ?', [property.insertId]);
    assert.equal(count, 1);

    // A completed visit must survive re-confirmation
    await connection.execute("UPDATE scheduled_visits SET status = 'completed' WHERE service_schedule_id = ? AND visit_number = 1", [seriesId]);
    await confirm([visit(1, '2026-09-29', '11:00 AM', true)]);
    const [[{ completed }]] = await connection.execute(
      "SELECT COUNT(*) AS completed FROM scheduled_visits WHERE service_schedule_id = ? AND status = 'completed'", [seriesId]
    );
    assert.equal(completed, 1);

    // Bad input is rejected rather than half-saved
    const empty = await confirm([]);
    assert.equal(empty.status, 400);
    assert.equal(empty.body.success, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await connection.rollback();
    await connection.end();
  }
});
