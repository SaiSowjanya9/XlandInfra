const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

/**
 * Route order in /api/schedules.
 *
 * GET '/:id' is declared above the static routes that follow it and Express matches in order, so
 * every single-segment path below it - '/cancelled', '/notifications', '/recommended-dates',
 * '/reschedule-requests', '/pending-count', '/eligible-vendors', '/status-summary', '/all',
 * '/renewals' - was answered by the single-schedule handler with "Schedule not found". Nine
 * endpoints were dead, three of them called by the portals (Cancelled Schedules, schedule
 * notifications, recommended dates).
 *
 * This test is about reachability only: with an empty mocked database a handler may still fail on
 * its own, so it asserts the request is not answered by '/:id' rather than asserting 200. The live
 * responses are verified against the real database separately.
 */

const pool = {
  execute: async (sql, params = []) => {
    if (sql.includes('FROM users')) return [[{ id: params[0] || 1, role: 'admin', is_active: 1 }]];
    return [[]];
  },
  query: async () => [[]]
};
require.cache[require.resolve('../config/database')] = { exports: { pool } };
const { generateToken } = require('../middleware/auth');
const router = require('./schedules');

const STATIC_ROUTES = ['/cancelled', '/notifications', '/recommended-dates', '/reschedule-requests',
  '/pending-count', '/pending-properties', '/pending-properties-v2', '/eligible-vendors',
  '/status-summary', '/all', '/renewals'];

test('every static schedules route is reachable and none is swallowed by /:id', async t => {
  const app = express();
  app.use(express.json());
  app.use('/api/schedules', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = generateToken({ id: 1, username: 'admin', role: 'admin' });
  const get = async path => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/schedules${path}`,
      { headers: { Authorization: `Bearer ${token}` } });
    let body = null;
    try { body = await response.json(); } catch {}
    return { status: response.status, message: body?.message };
  };

  for (const path of STATIC_ROUTES) {
    const { status, message } = await get(path);
    assert.notEqual(message, 'Schedule not found', `${path} is being answered by the /:id route`);
    assert.notEqual(status, 404, `${path} is unreachable`);
  }

  // A numeric id still reaches the single-schedule handler, which reports its own 404
  const single = await get('/12345');
  assert.equal(single.status, 404);
  assert.equal(single.message, 'Schedule not found');
});
