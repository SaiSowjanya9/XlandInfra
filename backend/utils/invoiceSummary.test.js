const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { invoiceSummary } = require('./invoiceSummary');

/**
 * An invoice states its money in one order, on every surface:
 *
 *   Sub Total -> GST (n%) -> Discount (n%) -> Total -> Balance Due
 *
 * GST is printed at the invoice's own rate rather than omitted, the discount line appears only
 * where the estimate behind the invoice carried one, and Balance Due always renders -- the total
 * until something is paid, 0 once it is settled in full. Amount Paid is not a summary line.
 *
 * Run: node --test backend/utils/invoiceSummary.test.js
 */

const labels = summary => summary.lines.map(line => line.label);

test('an unpaid invoice with no discount states Sub Total, GST and a balance equal to its total', () => {
  const summary = invoiceSummary({
    subtotal: '10000.00', tax_percentage: '0.00', tax_amount: '0.00',
    discount_amount: '0.00', total_amount: '10000.00', amount_paid: '0.00', balance_amount: '10000.00'
  });
  assert.deepEqual(labels(summary), ['Sub Total', 'GST (0%)']);
  assert.equal(summary.hasDiscount, false, 'a line reading -Rs. 0 says nothing');
  assert.equal(summary.totalAmount, 10000);
  assert.equal(summary.balanceDue, 10000, 'nothing paid, so the whole total is owed');
});

test('GST comes before Discount, and the discount line carries its percentage', () => {
  const summary = invoiceSummary({
    subtotal: 10000, taxPercentage: 0, taxAmount: 0,
    discountPercentage: 10, discountAmount: 1000, totalAmount: 9000, balanceAmount: 9000
  });
  assert.deepEqual(labels(summary), ['Sub Total', 'GST (0%)', 'Discount (10%)']);
  const discount = summary.lines.find(line => line.key === 'discount');
  assert.equal(discount.amount, 1000);
  assert.equal(discount.negative, true, 'a discount is taken off, so it is signed');
  assert.equal(summary.lines.findIndex(line => line.key === 'gst') <
    summary.lines.findIndex(line => line.key === 'discount'), true);
});

test('the GST line states what the invoice was billed, so a historic 18% row keeps it', () => {
  // tax_percentage/tax_amount stay in the schema for exactly this reason: the rate is 0 on every
  // invoice raised since GST was unlinked from the estimate, but an older row charged what it
  // charged and its document must still say so.
  const summary = invoiceSummary({ subtotal: 10000, tax_percentage: 18, tax_amount: 1800, total_amount: 11800 });
  assert.deepEqual(labels(summary), ['Sub Total', 'GST (18%)']);
  assert.equal(summary.lines[1].amount, 1800);
});

test('a fractional rate keeps its decimals; a whole one is not padded', () => {
  assert.equal(invoiceSummary({ tax_percentage: 2.5 }).lines[1].label, 'GST (2.5%)');
  assert.equal(invoiceSummary({ tax_percentage: '0.00' }).lines[1].label, 'GST (0%)');
  assert.equal(invoiceSummary({ tax_percentage: '18.00' }).lines[1].label, 'GST (18%)');
});

test('a fixed-amount discount with no percentage states the rate it came to', () => {
  // `invoiceAmountsFromEstimate` derives a percentage from the amount, but a row written before
  // that, or by hand, carries only the amount
  const summary = invoiceSummary({ subtotal: 10000, discount_amount: 1500, total_amount: 8500 });
  assert.deepEqual(labels(summary), ['Sub Total', 'GST (0%)', 'Discount (15%)']);
});

test('Balance Due is 0 on a settled invoice and never negative on an over-settled one', () => {
  assert.equal(invoiceSummary({ total_amount: 9000, amount_paid: 9000, balance_amount: 0 }).balanceDue, 0);
  assert.equal(invoiceSummary({ total_amount: 9000, amount_paid: 9500 }).balanceDue, 0);
});

test('Balance Due is derived where a row carries no stored balance', () => {
  // A draft's totals and a hand-built payload have no settlement cache behind them
  assert.equal(invoiceSummary({ total_amount: 9000, amount_paid: 4000 }).balanceDue, 5000);
  assert.equal(invoiceSummary({ totalAmount: 9000 }).balanceDue, 9000);
});

test('snake_case and camelCase payloads read the same', () => {
  const snake = invoiceSummary({ subtotal: 10, tax_percentage: 5, tax_amount: 1, discount_amount: 2, discount_percentage: 20, total_amount: 9, balance_amount: 3 });
  const camel = invoiceSummary({ subtotal: 10, taxPercentage: 5, taxAmount: 1, discountAmount: 2, discountPercentage: 20, totalAmount: 9, balanceAmount: 3 });
  assert.deepEqual(snake, camel);
});

test('nothing in the summary is NaN when the row is empty', () => {
  const summary = invoiceSummary({});
  for (const line of summary.lines) assert.equal(Number.isFinite(line.amount), true, line.label);
  assert.equal(summary.totalAmount, 0);
  assert.equal(summary.balanceDue, 0);
});

test('Amount Paid is not a summary line on any invoice document', () => {
  // It rendered beside Balance Due and only once something had been paid, which is how an unpaid
  // invoice ended up never saying what was owed. What came in is the payments list's job.
  const summary = invoiceSummary({ total_amount: 9000, amount_paid: 4000, balance_amount: 5000 });
  for (const line of summary.lines) assert.doesNotMatch(line.label, /Amount Paid/);
  const documents = {
    'the invoice PDF': ['..', 'services', 'pdfService.js'],
    'the auto-generated invoice email': ['..', 'services', 'invoiceService.js'],
    'the invoice email': ['..', 'services', 'emailService.js'],
    'the send-invoice email': ['..', 'routes', 'payments.js']
  };
  for (const [what, parts] of Object.entries(documents)) {
    const source = fs.readFileSync(path.join(__dirname, ...parts), 'utf8');
    assert.doesNotMatch(source, /summaryLine\('Amount Paid'|\['Amount Paid'|>Amount Paid</, what);
  }
});

test('every invoice document draws its summary from this helper, never its own rows', () => {
  for (const parts of [
    ['..', 'services', 'pdfService.js'],
    ['..', 'services', 'invoiceService.js'],
    ['..', 'services', 'emailService.js'],
    ['..', 'routes', 'payments.js']
  ]) {
    const file = parts[parts.length - 1];
    const source = fs.readFileSync(path.join(__dirname, ...parts), 'utf8');
    assert.match(source, /require\('\.\.\/utils\/invoiceSummary'\)/, `${file} does not use the shared summary`);
    assert.match(source, /summary\.lines/, `${file} does not render the shared lines`);
    assert.match(source, /summary\.balanceDue/, `${file} states no Balance Due`);
  }
});
