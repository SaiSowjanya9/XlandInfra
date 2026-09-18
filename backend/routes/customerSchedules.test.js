const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

/**
 * GET /api/customers/schedules is the customer portal's read-only view of the
 * schedule the employee portals build. These checks run the real route against a
 * mocked database and cover the two things that must never regress: the visits
 * are scoped to the customer's own property, and the payload carries nothing
 * internal.
 */

// customer_accounts.property_id holds the onboarded property id for some
// customers and nothing usable for others, which is why the route resolves it
const customers = {
  1: { id: 1, customer_id: 'CUST-1', email: 'byid@example.test', first_name: 'By', last_name: 'Id', property_id: 42, property_code: null, property_name: 'North Villas', is_active: 1 },
  2: { id: 2, customer_id: 'CUST-2', email: 'bycode@example.test', first_name: 'By', last_name: 'Code', property_id: null, property_code: 'GC-777', property_name: 'Green Court', is_active: 1 },
  3: { id: 3, customer_id: 'CUST-3', email: 'unknown@example.test', first_name: 'No', last_name: 'Property', property_id: 999, property_code: null, property_name: null, is_active: 1 }
};
const properties = [{ id: 42, property_id: 'VILLA-042' }, { id: 9, property_id: 'GC-777' }];
const visits = [
  { property_id: 42, id: 100, visit_id: 'VISIT-100', visit_number: 3, total_visits: 12, scheduled_date: '2026-04-18',
    scheduled_time_start: '10:00', scheduled_time_end: '12:00', status: 'scheduled', original_date: '2026-04-11',
    service_name: 'Lift Maintenance', vendor_name: 'Otis Care' },
  { property_id: 42, id: 101, visit_id: 'VISIT-101', visit_number: 2, total_visits: 12, scheduled_date: '2026-03-18',
    scheduled_time_start: '09:30', scheduled_time_end: null, status: 'completed', original_date: null,
    service_name: 'Lift Maintenance', vendor_name: 'Otis Care' },
  { property_id: 9, id: 200, visit_id: 'VISIT-200', visit_number: 1, total_visits: 4, scheduled_date: '2026-05-02',
    scheduled_time_start: '08:00', scheduled_time_end: '09:00', status: 'confirmed', original_date: null,
    service_name: 'Water Tank Cleaning', vendor_name: 'AquaPure' }
];
const statsRow = { total: 11, scheduled: 9, workOrderCreated: 1, inProgress: 0, completed: 2, rescheduled: 1, cancelled: 1, upcoming: 8, today: 1, overdue: 0 };

const calls = [];
const pool = { execute: async (sql, params = []) => {
  calls.push({ sql, params });
  if (sql.includes('FROM customer_accounts WHERE id = ?')) {
    const customer = customers[Number(params[0])];
    return [customer ? [customer] : []];
  }
  if (sql.includes('FROM onboarded_properties WHERE id = ? OR property_id = ?')) {
    return [properties.filter(row => row.id === Number(params[0]) || row.property_id === params[1]).map(row => ({ id: row.id }))];
  }
  if (sql.includes('FROM scheduled_visits sv') && sql.includes('COUNT(DISTINCT')) return [[statsRow]];
  if (sql.includes('FROM scheduled_visits sv')) {
    return [visits.filter(row => row.property_id === Number(params[params.length - 1]))];
  }
  // Table initialization and anything else this route does not read
  return [[]];
} };
require.cache[require.resolve('../config/database')] = { exports: { pool } };
const { generateToken } = require('../middleware/auth');
const { emptyScheduleStats } = require('../utils/scheduleStats');
const router = require('./customers');

test('the customer schedule is scoped to the customer property and exposes nothing internal', async t => {
  const app = express();
  app.use(express.json());
  app.use('/api/customers', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/customers/schedules`;

  const request = async (customerId, query = '') => {
    const customer = customers[customerId];
    const headers = customer
      ? { Authorization: `Bearer ${generateToken({ id: customer.id, email: customer.email })}` }
      : {};
    const response = await fetch(`${base}${query}`, { headers });
    return { status: response.status, ...(await response.json()) };
  };

  assert.equal((await request(null)).status, 401);

  // Resolved from customer_accounts.property_id
  const byId = await request(1);
  assert.equal(byId.status, 200);
  assert.deepEqual(byId.data.visits.map(visit => visit.visitId), ['VISIT-100', 'VISIT-101']);
  assert.deepEqual(byId.data.stats, statsRow);

  // A visit carries the service and the vendor, and no internal reference
  assert.deepEqual(byId.data.visits[0], {
    id: 100, visitId: 'VISIT-100', serviceName: 'Lift Maintenance', vendorName: 'Otis Care',
    scheduledDate: '2026-04-18', scheduledTimeStart: '10:00', scheduledTimeEnd: '12:00',
    status: 'scheduled', visitNumber: 3, totalVisits: 12, originalDate: '2026-04-11'
  });

  // Resolved from the property code, and never another property's visits
  const byCode = await request(2);
  assert.deepEqual(byCode.data.visits.map(visit => visit.visitId), ['VISIT-200']);

  const visitQueries = calls.filter(call => call.sql.includes('FROM scheduled_visits sv') && !call.sql.includes('COUNT(DISTINCT'));
  visitQueries.forEach(call => assert.ok(call.sql.includes('WHERE sv.property_id = ?'), 'visits must be filtered by property'));
  assert.deepEqual(visitQueries.map(call => call.params), [[42], [9]]);
  // The stats are the shared portal counts, scoped to the same single property
  assert.deepEqual(
    calls.filter(call => call.sql.includes('COUNT(DISTINCT')).map(call => call.params.slice(3)),
    [[42], [9]]
  );

  // A customer whose property is not onboarded gets an empty schedule, not an error
  calls.length = 0;
  const unresolved = await request(3);
  assert.equal(unresolved.status, 200);
  assert.deepEqual(unresolved.data, { visits: [], stats: emptyScheduleStats() });
  assert.equal(calls.filter(call => call.sql.includes('FROM scheduled_visits')).length, 0);

  // The row cap is clamped, so a caller cannot ask for an unbounded read
  await request(1, '?limit=5000');
  const capped = calls.filter(call => call.sql.includes('FROM scheduled_visits sv') && !call.sql.includes('COUNT(DISTINCT')).pop();
  assert.ok(capped.sql.includes('LIMIT 1000'), capped.sql);
  await request(1, '?limit=abc');
  const fallback = calls.filter(call => call.sql.includes('FROM scheduled_visits sv') && !call.sql.includes('COUNT(DISTINCT')).pop();
  assert.ok(fallback.sql.includes('LIMIT 500'), fallback.sql);
});
