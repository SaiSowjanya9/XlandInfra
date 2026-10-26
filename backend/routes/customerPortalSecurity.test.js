const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

/**
 * Three customer-portal guards, run against the real routes with a mocked database and mail:
 *  - POST /api/customers/create takes a staff login from one of the seven Add Customer portals;
 *  - POST /api/work-orders takes a customer login, and the raiser and property come from the
 *    account, never from the form;
 *  - a customer's offline payment intent alerts the franchise partner by email and in-portal.
 */

const accounts = {
  7: { id: 7, customer_id: 'CUST-7', email: 'resident@example.test', first_name: 'Ravi', last_name: 'K',
    phone: '9000000000', property_id: 42, property_code: 'GC-042', property_name: 'Green Court', is_active: 1 }
};

const writes = [];
const mails = [];
const renewalQueries = [];
const exec = async (sql, params = []) => {
  if (/FROM customer_accounts WHERE id = \?/.test(sql)) {
    const row = accounts[Number(params[0])];
    return [row ? [row] : []];
  }
  if (/FROM customer_accounts WHERE email = \?/.test(sql)) return [[]];
  if (/FROM onboarded_properties WHERE id = \? OR property_id = \?/.test(sql)) {
    if (!params.some(p => String(p) === '42' || p === 'GC-042')) return [[]];
    return [[{ id: 42, franchise_partner_id: 5, name: 'Green Court', property_type: 'GC', property_id: 'GC-042',
      zone: 'North', division: null, address: '', city: '', state: '' }]];
  }
  if (/FROM work_orders\s+WHERE property_id/.test(sql)) return [[]];
  if (/FROM invoices (i\s+)?WHERE (i\.)?id = \?/.test(sql)) {
    return [[{ id: 11, invoice_id: 'INV-11', status: 'sent', property_id: 42, property_code: 'GC-042',
      customer_email: 'resident@example.test', total_amount: 1000, balance_amount: 1000, amount_paid: 0,
      franchise_partner_id: 5 }]];
  }
  if (/status = 'verification_pending' ORDER BY/.test(sql)) return [[]];
  if (/FROM franchise_partners WHERE id = \?/.test(sql)) return [[{ email: 'fp@example.test' }]];
  if (/FROM fp_employees/.test(sql)) {
    return [[
      { id: 1, email: 'north.manager@example.test', role: 'manager' },
      { id: 2, email: 'south.manager@example.test', role: 'fp_manager' },
      { id: 3, email: 'all.manager@example.test', role: 'manager' },
      { id: 4, email: 'north.exec@example.test', role: 'executive' }
    ]];
  }
  if (/FROM fp_employee_zones/.test(sql)) {
    return [[
      { fp_employee_id: 1, zone_name: 'North' },
      { fp_employee_id: 2, zone_name: 'South' },
      { fp_employee_id: 3, zone_name: 'all' },
      { fp_employee_id: 4, zone_name: 'North' }
    ]];
  }
  if (/SELECT zone FROM onboarded_properties/.test(sql)) return [[{ zone: 'North' }]];
  // Renewals: the account stores the code, the table the onboarded id
  if (/FROM onboarded_properties WHERE property_id = \? LIMIT 1/.test(sql)) {
    return [params[0] === 'GC-042' ? [{ id: 42 }] : []];
  }
  if (/FROM schedule_renewals sr/.test(sql)) {
    renewalQueries.push({ sql, params });
    return [[{ id: 1, renewal_id: 'RNW-1', service_name: 'Lift', property_id: 42, status: 'pending_approval' }]];
  }
  if (/^\s*INSERT/i.test(sql)) {
    writes.push({ sql, params });
    return [{ insertId: 99, affectedRows: 1 }];
  }
  return [[]];
};
const conn = { execute: exec, query: exec, beginTransaction: async () => {}, commit: async () => {},
  rollback: async () => {}, release: () => {} };
const pool = { execute: exec, query: exec, getConnection: async () => conn };
require.cache[require.resolve('../config/database')] = { exports: { pool } };

// Every mail function is a recorder; nothing leaves the machine
const mailer = new Proxy({}, {
  get: (_, name) => async (payload) => { mails.push({ name, payload }); return { success: true }; }
});
require.cache[require.resolve('../services/emailService')] = { exports: mailer };

// A fake Razorpay: order_X was created for invoice 11, order_Y for invoice 12
const rzpOrders = { order_X: { notes: { internal_invoice_id: '11' } }, order_Y: { notes: { internal_invoice_id: '12' } } };
const rzpPayments = {
  pay_X: { id: 'pay_X', order_id: 'order_X', amount: 100000, status: 'captured' },
  pay_Y: { id: 'pay_Y', order_id: 'order_Y', amount: 100000, status: 'captured' }
};
function FakeRazorpay() {
  return {
    payments: { fetch: async (id) => rzpPayments[id] },
    orders: { fetch: async (id) => rzpOrders[id] }
  };
}
require.cache[require.resolve('razorpay')] = { exports: FakeRazorpay };
const recorded = [];
require.cache[require.resolve('../services/razorpayPayment')] = {
  exports: { recordRazorpayPayment: async (args) => { recorded.push(args); return { alreadyRecorded: false }; } }
};
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test-secret';

const { generateToken } = require('../middleware/auth');
const customersRouter = require('./customers');
const workOrdersRouter = require('./workOrders');

const startApp = async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/customers', customersRouter);
  app.use('/api/work-orders', workOrdersRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
};

const customerToken = generateToken({ id: 7, email: 'resident@example.test', role: 'customer' });
const staffToken = (role) => generateToken({ id: 7, username: `${role}-user`, email: `${role}@example.test`, role });

test('only the seven staff portals can create a customer account', async (t) => {
  const base = await startApp(t);
  const create = (token) => fetch(`${base}/api/customers/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ email: 'new@example.test', firstName: 'New', propertyId: 42, propertyCode: 'GC-042' })
  });

  assert.equal((await create(null)).status, 401);
  assert.equal((await create(customerToken)).status, 403);
  assert.equal((await create(staffToken('vendor'))).status, 403);

  for (const role of ['admin', 'operations_manager', 'franchise_partner', 'manager', 'coordinator',
    'supervisor', 'executive', 'fp_manager']) {
    const response = await create(staffToken(role));
    assert.equal(response.status, 201, `${role} should be able to add a customer`);
  }

  const insert = writes.filter(w => /INSERT INTO customer_accounts/.test(w.sql)).pop();
  assert.equal(insert.params.at(-1), 'fp_manager-user', 'created_by comes from the login, not the body');
});

test('a work order needs a customer login and takes the raiser from the account', async (t) => {
  const base = await startApp(t);
  const raise = (token) => {
    const form = new FormData();
    form.append('categoryId', '1');
    form.append('subcategoryId', '1');
    form.append('description', 'Tap leaking');
    // A forged identity in the form must be ignored
    form.append('customerEmail', 'attacker@example.test');
    form.append('propertyId', '999');
    return fetch(`${base}/api/work-orders`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form
    });
  };

  assert.equal((await raise(null)).status, 401);
  assert.equal((await raise(staffToken('admin'))).status, 401, 'a staff token is not a customer login');

  const response = await raise(customerToken);
  assert.equal(response.status, 201);
  const insert = writes.filter(w => /INSERT INTO work_orders/.test(w.sql)).pop();
  assert.ok(insert, 'the work order is written');
  assert.ok(insert.params.includes('resident@example.test'), 'the account email is stored');
  assert.ok(!insert.params.includes('attacker@example.test'), 'the form email is ignored');
  assert.equal(insert.params[2], 42, 'the property is the account property, not the form one');
});

test('an offline payment intent emails only the partner and the managers covering the property zone', async (t) => {
  const base = await startApp(t);
  mails.length = 0;
  const response = await fetch(`${base}/api/customers/invoices/11/offline-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ paymentMethod: 'cheque', portion: 'full' })
  });
  assert.equal(response.status, 200);

  // The alert is fired after the response; give it a tick
  await new Promise(resolve => setTimeout(resolve, 50));
  const sent = mails.filter(m => m.name === 'sendEmail').map(m => m.payload.to).sort();
  assert.deepEqual(sent, ['all.manager@example.test', 'fp@example.test', 'north.manager@example.test'],
    'partner + North and all-zone managers; never the South manager or a non-manager');
  assert.match(mails.find(m => m.name === 'sendEmail').payload.subject, /INV-11/);
});

test('a payment is only recorded against the invoice its order was created for, by its owner', async (t) => {
  const base = await startApp(t);
  const crypto = require('crypto');
  const sign = (order, payment) => crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${order}|${payment}`).digest('hex');
  const verify = (token, order, payment) => fetch(`${base}/api/customers/invoices/11/verify-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ razorpay_order_id: order, razorpay_payment_id: payment, razorpay_signature: sign(order, payment) })
  });

  recorded.length = 0;
  // A genuine, correctly signed payment made for invoice 12, replayed against invoice 11
  assert.equal((await verify(customerToken, 'order_Y', 'pay_Y')).status, 400);
  // A payment that does not belong to the signed order
  assert.equal((await verify(customerToken, 'order_X', 'pay_Y')).status, 400);
  // Someone else's invoice: a customer with no link to invoice 11
  accounts[9] = { id: 9, email: 'other@example.test', property_id: 7777, property_code: 'OTHER-1', is_active: 1 };
  const other = generateToken({ id: 9, email: 'other@example.test', role: 'customer' });
  assert.equal((await verify(other, 'order_X', 'pay_X')).status, 403);
  assert.equal(recorded.length, 0, 'nothing was recorded by the refused calls');

  // The real thing goes through
  const ok = await verify(customerToken, 'order_X', 'pay_X');
  assert.equal(ok.status, 200);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].invoiceId, 11);
});

test('renewals bind the status and resolve a property stored by code', async (t) => {
  const base = await startApp(t);
  const codeAccount = { ...accounts[7], id: 8, property_id: null, property_code: 'GC-042' };
  accounts[8] = codeAccount;
  const token = generateToken({ id: 8, email: codeAccount.email, role: 'customer' });
  const get = (query) => fetch(`${base}/api/customers/renewals${query}`, { headers: { Authorization: `Bearer ${token}` } });

  renewalQueries.length = 0;
  const injected = await get(`?status=${encodeURIComponent("x' OR '1'='1")}`);
  assert.equal(injected.status, 200);
  const sql = renewalQueries.at(-1).sql;
  assert.ok(!sql.includes("'1'='1"), 'the status never reaches the SQL text');
  assert.deepEqual(renewalQueries.at(-1).params, [42], 'an unknown status is not applied');

  const pending = await get('?status=pending_approval');
  const body = await pending.json();
  assert.equal(body.data.length, 1, 'a code-stored property still finds its renewal');
  assert.deepEqual(renewalQueries.at(-1).params, [42, 'pending_approval']);
  assert.match(renewalQueries.at(-1).sql, /sr\.status = \?/);
});
