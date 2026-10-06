const { test } = require('node:test');
const assert = require('node:assert/strict');

// Moving an estimate into Sent from the list's status dropdown emails it to the customer, and does
// so every time it moves there: Sent, back to Draft, and Sent again sends it a second time. The
// status route used to save the status alone, so the dropdown never sent anything.
const estimate = { id: 1, estimate_id: 'EST-FP', franchise_partner_id: 8, client_name: 'Customer', client_email: 'customer@example.test',
  property_name: 'Property', property_type: 'APT', package_services: '[]', addons_data: '[]', subtotal: 100, total_amount: 100, gst_percent: 0, status: 'draft' };
let sends = 0;
let smtpSuccess = true;
const pool = { execute: async (sql, params = []) => {
  if (sql.startsWith('SHOW COLUMNS')) return [[{ Field: 'exists' }]];
  if (sql.includes('FROM fp_addons')) return [[]];
  if (sql.startsWith('UPDATE fp_estimates SET status = ?')) { estimate.status = params[0]; return [{ affectedRows: 1 }]; }
  // The send handler marks the estimate Sent once the email has gone
  if (sql.startsWith('UPDATE fp_estimates')) { if (/status\s*=\s*'sent'/i.test(sql)) estimate.status = 'sent'; return [{ affectedRows: 1 }]; }
  if (sql.includes('FROM fp_estimates')) return [[estimate]];
  throw new Error(`Unexpected SQL: ${sql}`);
} };
require.cache[require.resolve('../config/database')] = { exports: { pool } };
require.cache[require.resolve('../services/emailService')] = { exports: {
  sendFPEmployeeWelcomeEmail: async () => {}, sendVendorAssignmentEmail: async () => {}, sendCustomerActivationEmail: async () => {},
  sendEstimateEmail: async () => { if (smtpSuccess) sends++; return { success: smtpSuccess, error: smtpSuccess ? undefined : 'Simulated SMTP failure' }; }
} };
const { updateEstimateStatusHandler } = require('./franchisePartner');

const setStatus = async status => {
  let result;
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { result = { status: this.statusCode, ...body }; return this; } };
  await updateEstimateStatusHandler({ fpId: 8, params: { id: '1' }, body: { status }, user: { id: 1 } }, res);
  return result;
};

test('Sent, Draft, Sent emails the customer twice', async () => {
  assert.equal((await setStatus('sent')).success, true);
  assert.equal(sends, 1);
  assert.equal(estimate.status, 'sent');
  // Choosing Sent again on an estimate already Sent does not send it again
  await setStatus('sent');
  assert.equal(sends, 1);
  assert.equal((await setStatus('draft')).success, true);
  assert.equal(estimate.status, 'draft');
  assert.equal(sends, 1, 'Draft sends nothing');
  const again = await setStatus('sent');
  assert.equal(again.success, true);
  assert.match(again.message, /customer@example\.test/);
  assert.equal(sends, 2);
  assert.equal(estimate.status, 'sent');
});

test('a failed send leaves the estimate in its old status', async () => {
  await setStatus('draft');
  smtpSuccess = false;
  const result = await setStatus('sent');
  smtpSuccess = true;
  assert.equal(result.success, false);
  assert.equal(estimate.status, 'draft');
});

test('an estimate with no customer email cannot be marked Sent', async () => {
  const email = estimate.client_email;
  estimate.client_email = '';
  const result = await setStatus('sent');
  estimate.client_email = email;
  assert.equal(result.status, 400);
  assert.equal(estimate.status, 'draft');
});
