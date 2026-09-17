const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const addon = { catalogServiceId: 1, name: 'Tank Cleaning', totalPrice: 11700.25, frequency_type: 'Half-Yearly', frequency_count: 2,
  pricingInputs: { capacity: 10, frequency: 'Half-Yearly', visits: 2 }, pricingSnapshot: { pricing_method: 'capacity_based', unit: 'KL' } };
const estimate = { estimate_id: 'EST-CUSTOM', estimate_type: 'custom', customer_name: 'Customer', customer_email: 'customer@example.test',
  property_code: 'PROP-1', created_at: '2026-09-16', services: '[]', addons: JSON.stringify([addon]), subtotal: '11700.25',
  total: '11700.25', total_amount: '11700.25', tax_percentage: 0, tax_amount: 0, discount_percentage: 0, discount_amount: 0 };
let delivery;
const db = { isDbConnected: true, pool: { execute: async sql => {
  if (sql.includes('FROM fp_estimates')) return [[{ ...estimate, estimate_id: 'EST-FP', addons: null, addons_data: JSON.stringify([addon]) }]];
  if (sql.includes('FROM estimates')) return [[estimate]];
  if (sql.startsWith('UPDATE estimates')) return [{ affectedRows: 1 }];
  throw new Error(`Unexpected SQL: ${sql}`);
} } };
require.cache[require.resolve('../config/database')] = { exports: db };
require.cache[require.resolve('../middleware/auth')] = { exports: { authenticate: (req, res, next) => { req.user = { id: 1, role: 'admin' }; next(); } } };
require.cache[require.resolve('../services/emailService')] = { exports: {
  sendEstimateEmail: async data => { delivery = data; return { success: true }; }, sendEstimateActionNotification: async () => ({ success: true })
} };
const originalSetInterval = global.setInterval;
const originalSetTimeout = global.setTimeout;
global.setInterval = (...args) => originalSetInterval(...args).unref();
global.setTimeout = (...args) => originalSetTimeout(...args).unref();
const router = require('./estimatesSync');
global.setInterval = originalSetInterval;
global.setTimeout = originalSetTimeout;

test('estimate sync keeps both sources and passes saved fields to the email trigger', async t => {
  const app = express();
  app.use(express.json());
  app.use('/estimates', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/estimates`;
  const list = await (await fetch(base)).json();
  assert.equal(list.success, true);
  assert.equal(list.data.length, 2);
  assert.equal(list.data[0].addons[0].price, 11700.25);
  const response = await fetch(`${base}/EST-CUSTOM/send`, { method: 'POST' });
  assert.equal(response.status, 200);
  assert.equal(delivery.gstPercent, 0);
  assert.equal(delivery.total, 11700.25);
  assert.equal(delivery.propertyCode, 'PROP-1');
  assert.equal(delivery.createdAt, '2026-09-16');
  const status = await (await fetch(`${base}/EST-CUSTOM/status?token=test-token`)).json();
  assert.equal(status.success, true);
  assert.equal(status.data.total, 11700.25);
});
