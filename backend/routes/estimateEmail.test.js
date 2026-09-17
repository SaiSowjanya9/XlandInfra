const { test } = require('node:test');
const assert = require('node:assert/strict');
let smtpSuccess = false;
let delivered = false;
let updates = 0;
const estimate = { id: 1, estimate_id: 'EST-FP', franchise_partner_id: 8, client_name: 'Customer', client_email: 'customer@example.test',
  property_name: 'Property', property_type: 'APT', package_services: '[]', addons_data: '[]', subtotal: 123.45, total_amount: 123.45, gst_percent: 0 };
const pool = { execute: async (sql, params = []) => {
  if (sql.startsWith('SHOW COLUMNS')) return [[{ Field: 'exists' }]];
  if (sql.includes('FROM fp_addons')) return [[]];
  if (sql.startsWith('UPDATE fp_estimates')) { assert.equal(delivered, true); updates++; return [{ affectedRows: 1 }]; }
  if (sql.includes('FROM fp_estimates')) return [[...(params.length > 1 && params[1] !== 8 ? [] : [estimate])]];
  throw new Error(`Unexpected SQL: ${sql}`);
} };
require.cache[require.resolve('../config/database')] = { exports: { pool } };
require.cache[require.resolve('../services/emailService')] = { exports: {
  sendFPEmployeeWelcomeEmail: async () => {}, sendVendorAssignmentEmail: async () => {}, sendCustomerActivationEmail: async () => {},
  sendEstimateEmail: async data => {
  assert.equal(data.gstPercent, 0);
  assert.equal(data.total, 123.45);
  delivered = smtpSuccess;
  return { success: smtpSuccess, error: smtpSuccess ? undefined : 'Simulated SMTP failure' };
} } };
const { sendEstimateEmailHandler } = require('./franchisePartner');
const send = async fpId => {
  let result;
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { result = { status: this.statusCode, ...body }; return this; } };
  await sendEstimateEmailHandler({ fpId, body: { estimateId: 1, email: 'customer@example.test' } }, res);
  return result;
};

test('FP email trigger marks sent only after successful delivery and enforces FP lookup', async () => {
  smtpSuccess = false;
  assert.equal((await send(8)).success, false);
  assert.equal(updates, 0);
  smtpSuccess = true;
  assert.equal((await send(8)).success, true);
  assert.equal(updates, 1);
  assert.equal((await send(9)).status, 404);
  assert.equal(updates, 1);
});
