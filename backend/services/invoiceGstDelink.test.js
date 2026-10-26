const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');

/**
 * An invoice's GST is not the estimate's. An invoice raised from an approved estimate starts with
 * its GST blank (tax_percentage NULL), an employee enters it on the draft in Generated Invoices,
 * the send route refuses the invoice until they have, and the rate is locked once it is sent.
 */

const inserts = [];
const updates = [];
const state = {
  estimate: null,
  invoice: null
};
const baseEstimate = {
  id: 1, estimate_id: 'EST-1', estimate_type: 'amc', franchise_partner_id: 5,
  client_name: 'Ravi', estimate_email: 'ravi@example.test', property_code: 'GC-042',
  package_name: 'Gold', package_price: 10000, package_services: '[]', addons_data: '[]',
  subtotal: '10000.00', discount_percent: '0.00', discount_amount: '0.00', gst_percent: '18.00', gst_amount: '1800.00',
  total: '11800.00', total_amount: '11800.00'
};
const connection = {
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
  execute: async (sql, params = []) => {
    if (/FROM fp_estimates fe/.test(sql)) return [[state.estimate]];
    if (/FROM invoices WHERE source_estimate_id/.test(sql)) return [state.invoice ? [state.invoice] : []];
    if (/INSERT INTO invoices/.test(sql)) {
      inserts.push({ sql, params });
      return [{ insertId: 77 }];
    }
    if (/UPDATE invoices SET/.test(sql)) {
      updates.push({ sql, params });
      return [{ affectedRows: 1 }];
    }
    return [[]];
  }
};

const originalLoad = Module._load;
Module._load = function (request) {
  if (request === '../config/database') {
    return { pool: { execute: async () => [[]], query: async () => [[]], getConnection: async () => connection } };
  }
  if (request === 'nodemailer') return { createTransport: () => ({ sendMail: async () => ({}) }) };
  return originalLoad.apply(this, arguments);
};
const { generateInvoiceFromEstimate, refreshDraftInvoiceFromEstimate, invoiceAmountsFromEstimate } = require('./invoiceService');

const columnValue = (insert, column) => {
  const columns = insert.sql.match(/INSERT INTO invoices \(([\s\S]*?)\)\s*VALUES/)[1]
    .split(',').map(c => c.trim());
  return insert.params[columns.indexOf(column)];
};

test('an invoice raised from an 18% estimate starts with its GST blank, not 18%', async () => {
  inserts.length = 0;
  state.estimate = { ...baseEstimate };
  state.invoice = null;
  await generateInvoiceFromEstimate(1, null, 'fp');
  assert.equal(inserts.length, 1);
  const insert = inserts[0];
  assert.equal(columnValue(insert, 'tax_percentage'), null, 'GST is left for the employee to enter');
  assert.equal(columnValue(insert, 'tax_amount'), 0);
  assert.equal(columnValue(insert, 'subtotal'), 10000, 'the pre-GST subtotal, never the GST-inclusive total');
  assert.equal(columnValue(insert, 'total_amount'), 10000);
  assert.equal(columnValue(insert, 'balance_amount'), 10000);
});

test("the estimate's discount reaches the invoice, by amount or by percentage", () => {
  // A fixed-amount discount has no percentage; it must still come over
  const byAmount = invoiceAmountsFromEstimate({ subtotal: '10000', discount_percent: '0', discount_amount: '1500' }, null);
  assert.equal(byAmount.discountAmount, 1500);
  assert.equal(byAmount.discountPercentage, 15);
  assert.equal(byAmount.totalAmount, 8500);
  const byPercent = invoiceAmountsFromEstimate({ subtotal: '10000', discount_percent: '10' }, 18);
  assert.equal(byPercent.discountAmount, 1000);
  assert.equal(byPercent.taxAmount, 1620, "the invoice's own GST, on the discounted amount");
  assert.equal(byPercent.totalAmount, 10620);
});

test('a discount added to the estimate after invoicing updates the unsent draft, keeping its GST', async () => {
  updates.length = 0;
  state.estimate = { ...baseEstimate, discount_percent: '10.00', discount_amount: '1000.00' };
  state.invoice = { id: 77, invoice_id: 'INV-00001', status: 'draft', tax_percentage: '5.00', amount_paid: '0.00' };
  const result = await refreshDraftInvoiceFromEstimate(1, 'fp');
  assert.equal(result.updated, true);
  const params = updates[0].params;
  // line_items, subtotal, discount_percentage, discount_amount, tax_amount, total_amount, balance_amount, id
  assert.deepEqual(params.slice(1), [10000, 10, 1000, 450, 9450, 9450, 77]);
});

test('re-approving an edited estimate refreshes its existing draft instead of leaving it stale', async () => {
  updates.length = 0;
  inserts.length = 0;
  state.estimate = { ...baseEstimate, discount_amount: '2000.00' };
  state.invoice = { id: 77, invoice_id: 'INV-00001', status: 'draft', tax_percentage: null, amount_paid: '0.00' };
  const result = await generateInvoiceFromEstimate(1, null, 'fp');
  assert.equal(result.alreadyExists, true);
  assert.equal(result.refreshed, true);
  assert.equal(inserts.length, 0, 'no second invoice');
  assert.equal(updates[0].params[5], 8000);
});

test('a sent invoice is never rewritten by an estimate edit', async () => {
  updates.length = 0;
  state.estimate = { ...baseEstimate, discount_amount: '2000.00' };
  for (const invoice of [
    { id: 77, invoice_id: 'INV-00001', status: 'sent', tax_percentage: '18.00', amount_paid: '0.00' },
    { id: 77, invoice_id: 'INV-00001', status: 'draft', tax_percentage: '18.00', amount_paid: '500.00' }
  ]) {
    state.invoice = invoice;
    const result = await refreshDraftInvoiceFromEstimate(1, 'fp');
    assert.equal(result.updated, false);
  }
  assert.equal(updates.length, 0);
});

test('every FP estimate editor refreshes the draft invoice after saving', () => {
  for (const file of ['franchisePartner.js', 'admin.js', 'manager.js', 'coordinator.js', 'executive.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'routes', file), 'utf8');
    assert.match(source, /refreshDraftInvoiceFromEstimate\(estimateId, 'fp'\)/, file);
  }
});

const payments = fs.readFileSync(path.join(__dirname, '..', 'routes', 'payments.js'), 'utf8');
const routeBody = (signature) => {
  const start = payments.indexOf(signature);
  assert.ok(start >= 0, `${signature} exists`);
  const next = payments.indexOf('\nrouter.', start + signature.length);
  return payments.slice(start, next < 0 ? undefined : next);
};

test('an invoice whose GST is blank cannot be sent', () => {
  const send = routeBody("router.post('/invoices/:id/send'");
  const guard = send.indexOf('tax_percentage === null');
  assert.ok(guard > 0, 'the send route checks for a blank GST');
  assert.ok(guard < send.indexOf('createPaymentLinkForInvoice'), 'before a payment link is minted');
  assert.ok(guard < send.indexOf("status = CASE"), 'before the invoice is marked sent');
});

test('GST is editable on a draft and locked once sent', () => {
  const update = routeBody("router.put('/invoices/:id'");
  assert.match(update, /invoice\.status !== 'draft'/);
  assert.match(update, /status\(409\)/);
  assert.match(update, /requestedTax < 0 \|\| requestedTax > 100/);
});

test('create-from-estimate taxes the pre-GST subtotal and only the GST the employee entered', () => {
  const create = routeBody("router.post('/invoices/create-from-estimate'");
  assert.doesNotMatch(create, /const subtotal = parseFloat\(estimate\.total\)/, 'the GST-inclusive total is never the base');
  assert.match(create, /const taxPct = gstEntered \? parseFloat\(gstPercent\) : null/);
});
