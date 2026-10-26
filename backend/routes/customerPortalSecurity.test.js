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
const exec = async (sql, params = []) => {
  if (/FROM customer_accounts WHERE id = \?/.test(sql)) {
    const row = accounts[Number(params[0])];
    return [row ? [row] : []];
  }
  if (/FROM customer_accounts WHERE email = \?/.test(sql)) return [[]];
  if (/FROM onboarded_properties WHERE id = \? OR property_id = \?/.test(sql)) {
    return [[{ id: 42, franchise_partner_id: 5, name: 'Green Court', property_type: 'GC', property_id: 'GC-042',
      zone: 'North', division: null, address: '', city: '', state: '' }]];
  }
  if (/FROM work_orders\s+WHERE property_id/.test(sql)) return [[]];
  if (/FROM invoices WHERE id = \?/.test(sql)) {
    return [[{ id: 11, invoice_id: 'INV-11', status: 'sent', property_id: 42, property_code: 'GC-042',
      customer_email: 'resident@example.test', total_amount: 1000, balance_amount: 1000, amount_paid: 0,
      franchise_partner_id: 5 }]];
  }
  if (/status = 'verification_pending' ORDER BY/.test(sql)) return [[]];
  if (/FROM franchise_partners WHERE id = \?/.test(sql)) return [[{ email: 'fp@example.test' }]];
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

test('an offline payment intent alerts the franchise partner by email and in-portal', async (t) => {
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
  const mail = mails.find(m => m.name === 'sendEmail');
  assert.ok(mail, 'the partner is emailed');
  assert.equal(mail.payload.to, 'fp@example.test');
  assert.match(mail.payload.subject, /INV-11/);
  const note = writes.find(w => /INSERT INTO portal_notifications/.test(w.sql));
  assert.ok(note, 'an in-portal notification is written');
  assert.equal(note.params[1], 5, 'for the invoice franchise partner');
});
