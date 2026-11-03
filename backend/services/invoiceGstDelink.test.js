const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');

/**
 * An invoice carries no GST. An invoice raised from an approved estimate is stored with
 * `tax_percentage = 0` and `tax_amount = 0` whatever the estimate charged, no screen offers a
 * GST field on an invoice, and no invoice document (screen, PDF or email) prints a GST line.
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

test('an invoice raised from an 18% estimate charges no GST', async () => {
  inserts.length = 0;
  state.estimate = { ...baseEstimate };
  state.invoice = null;
  await generateInvoiceFromEstimate(1, null, 'fp');
  assert.equal(inserts.length, 1);
  const insert = inserts[0];
  assert.equal(columnValue(insert, 'tax_percentage'), 0, "the estimate's rate is never copied");
  assert.equal(columnValue(insert, 'tax_amount'), 0);
  assert.equal(columnValue(insert, 'subtotal'), 10000, 'the pre-GST subtotal, never the GST-inclusive total');
  assert.equal(columnValue(insert, 'total_amount'), 10000);
  assert.equal(columnValue(insert, 'balance_amount'), 10000);
});

test("the estimate's discount reaches the invoice, by amount or by percentage", () => {
  // A fixed-amount discount has no percentage; it must still come over
  const byAmount = invoiceAmountsFromEstimate({ subtotal: '10000', discount_percent: '0', discount_amount: '1500' });
  assert.equal(byAmount.discountAmount, 1500);
  assert.equal(byAmount.discountPercentage, 15);
  assert.equal(byAmount.totalAmount, 8500);
  const byPercent = invoiceAmountsFromEstimate({ subtotal: '10000', discount_percent: '10', gst_percent: '18' });
  assert.equal(byPercent.discountAmount, 1000);
  assert.equal(byPercent.taxAmount, 0, 'the discounted subtotal is the total; no GST rides along');
  assert.equal(byPercent.totalAmount, 9000);
});

test('a discount added to the estimate after invoicing updates the unsent draft, GST still 0', async () => {
  updates.length = 0;
  state.estimate = { ...baseEstimate, discount_percent: '10.00', discount_amount: '1000.00' };
  state.invoice = { id: 77, invoice_id: 'INV-00001', status: 'draft', amount_paid: '0.00' };
  const result = await refreshDraftInvoiceFromEstimate(1, 'fp');
  assert.equal(result.updated, true);
  const params = updates[0].params;
  // line_items, subtotal, discount_percentage, discount_amount, tax_percentage, tax_amount, total_amount, balance_amount, id
  assert.deepEqual(params.slice(1), [10000, 10, 1000, 0, 0, 9000, 9000, 77]);
});

test('re-approving an edited estimate refreshes its existing draft instead of leaving it stale', async () => {
  updates.length = 0;
  inserts.length = 0;
  state.estimate = { ...baseEstimate, discount_amount: '2000.00' };
  state.invoice = { id: 77, invoice_id: 'INV-00001', status: 'draft', amount_paid: '0.00' };
  const result = await generateInvoiceFromEstimate(1, null, 'fp');
  assert.equal(result.alreadyExists, true);
  assert.equal(result.refreshed, true);
  assert.equal(inserts.length, 0, 'no second invoice');
  assert.equal(updates[0].params[6], 8000, 'total_amount');
});

test('a sent invoice is never rewritten by an estimate edit', async () => {
  updates.length = 0;
  state.estimate = { ...baseEstimate, discount_amount: '2000.00' };
  for (const invoice of [
    { id: 77, invoice_id: 'INV-00001', status: 'sent', amount_paid: '0.00' },
    { id: 77, invoice_id: 'INV-00001', status: 'draft', amount_paid: '500.00' }
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

test('nothing blocks or gates an invoice on its GST any more', () => {
  const send = routeBody("router.post('/invoices/:id/send'");
  assert.doesNotMatch(send, /GST_NOT_SET/);
  // The route reads the stored rate only to hand it to the document, so the GST line states what
  // the invoice was billed. It must never test it: the `GST_NOT_SET` 400 and the draft-only 409
  // that used to live here refused to send an invoice over a rate nobody sets any more.
  assert.doesNotMatch(send, /if \([^)]*tax_percentage/, 'the send route gates on GST again');
  assert.doesNotMatch(send, /parseFloat\((invoice\.)?tax_percentage\)/, 'the send route re-reads a GST rate');
  assert.match(send, /taxPercentage: invoice\.tax_percentage/, "the PDF is not told the invoice's own rate");
  assert.match(send, /createPaymentLinkForInvoice/, 'and still mints the payment link');
});

test('no invoice writer takes a GST rate from the request', () => {
  for (const signature of [
    "router.post('/invoices'",
    "router.put('/invoices/:id'",
    "router.post('/invoices/create-from-estimate'",
    "router.post('/invoices/create-generic'"
  ]) {
    const body = routeBody(signature);
    assert.match(body, /const taxPct = 0|taxPercentage: taxPct/, signature);
    assert.doesNotMatch(body, /parseFloat\((gstPercent|taxPercentage)\)/, signature);
  }
});

test('every invoice document states its GST line, at the invoice\'s own rate', () => {
  // The rate is 0 and the estimate's is still never copied -- what changed is that the line is
  // *printed* at that rate rather than left out (the user's call): a summary that jumps from Sub
  // Total to Total reads as though a tax line had gone missing. The label is built in
  // `utils/invoiceSummary.js` from the invoice's own `tax_percentage`, so a historic row that was
  // billed 18% still says 18%, and no document hard-codes a rate of its own.
  const between = (file, from, to) => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const start = source.indexOf(from);
    assert.ok(start >= 0, `${from} in ${file}`);
    const end = to ? source.indexOf(to, start) : -1;
    return source.slice(start, end < 0 ? undefined : end);
  };
  const invoiceDocuments = {
    'the invoice PDF': between('services/pdfService.js', 'const generateInvoicePDF', 'const generateReceiptPDF'),
    'the invoice email': between('services/emailService.js', 'const sendInvoiceEmail', 'const sendEmail = async'),
    'the send-invoice email': between('routes/payments.js', "router.post('/invoices/:id/send'", '\nrouter.'),
    'the auto-generated invoice email': fs.readFileSync(path.join(__dirname, 'invoiceService.js'), 'utf8')
  };
  for (const [what, source] of Object.entries(invoiceDocuments)) {
    assert.match(source, /summary\.lines/, `${what} does not draw the shared summary lines`);
    // A rate written into the document is what once billed a 0% estimate at 18%
    assert.doesNotMatch(source, /GST \(\$\{[^}]*\|\|\s*18/, `${what} falls back to an 18% label`);
    assert.doesNotMatch(source, /GST \(18/, `${what} hard-codes an 18% GST line`);
  }
  // The label itself is written once, in the shared helper
  const helper = fs.readFileSync(path.join(__dirname, '..', 'utils', 'invoiceSummary.js'), 'utf8');
  assert.match(helper, /GST \(\$\{ratePercent\(taxPercentage\)\}%\)/, 'the GST label no longer reads the invoice\'s own rate');
});

test('the summary states Sub Total, GST, Discount, Total, Balance Due, in that order', () => {
  const helper = fs.readFileSync(path.join(__dirname, '..', 'utils', 'invoiceSummary.js'), 'utf8');
  const order = ["key: 'subtotal'", "key: 'gst'", "key: 'discount'"];
  const at = order.map(token => helper.indexOf(token));
  for (const [index, position] of at.entries()) {
    assert.ok(position > 0, `${order[index]} is not a summary line`);
    if (index) assert.ok(position > at[index - 1], `${order[index]} is out of order`);
  }
  // The discount is the one conditional line: it is entered on the estimate and comes over with it
  const discountGate = helper.slice(helper.indexOf('if (discountAmount > 0)'), helper.indexOf("key: 'discount'"));
  assert.ok(discountGate.length > 0 && discountGate.length < 200, 'the discount line is no longer gated on an amount');
  // GST and Balance Due are not gated on anything
  assert.doesNotMatch(helper, /if \(tax(Amount|Percentage)[^)]*\)\s*\{?\s*lines\.push/, 'the GST line is conditional again');
});
