import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { invoiceSummary, SUBTOTAL_LABEL, TOTAL_LABEL, BALANCE_LABEL } from './invoiceSummary.js';

/**
 * An invoice's money is one block, in one order, on every screen:
 *
 *   Sub Total -> GST (n%) -> Discount (n%) -> Total -> Balance Due
 *
 * Each surface used to hand-write its own list and they had drifted on all three counts: the staff
 * modals printed no GST line at all, the FP page and the customer portal ordered Discount before
 * the (absent) GST, and Amount Paid / Balance Due rendered only once something had been paid -- so
 * an unpaid invoice never stated what was owed and a settled one did not say it was settled.
 * `utils/invoiceSummary.js` now fixes the order, and this test fails if a screen rebuilds it.
 *
 * Run: node --test admin-portal/src/utils/invoiceSummaryView.test.js
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..', '..', '..');
const read = (...parts) => fs.readFileSync(path.join(repo, ...parts), 'utf8');

// Every surface that states what an invoice comes to
const SURFACES = [
  ['admin-portal/src/components/billing/InvoiceSummaryCard.jsx', 'the shared staff summary card'],
  ['admin-portal/src/pages/FPInvoiceView.jsx', 'the FP invoice page'],
  ['admin-portal/src/pages/billing/CreateInvoice.jsx', 'the manual invoice draft'],
  ['admin-portal/src/pages/billing/GeneratedInvoices.jsx', 'the estimate-to-invoice draft'],
  ['frontend/src/pages/Payment.jsx', "the customer's own invoice"]
];

test('the client helper is the backend helper, line for line', () => {
  // The order a customer reads on screen and the order printed on the PDF attached to their email
  // are the same order, so the two implementations state the same lines
  const client = read('admin-portal', 'src', 'utils', 'invoiceSummary.js');
  const server = read('backend', 'utils', 'invoiceSummary.js');
  const shape = source => source
    .replace(/export const /g, 'const ')
    .match(/const invoiceSummary = \(invoice = \{\}\) => \{[\s\S]*?\n\};/)[0];
  assert.equal(shape(client), shape(server), 'the client and server summaries have drifted');
});

test('the customer portal carries the same copy as the staff portals', () => {
  // `Modal` is kept identical across the two apps for the same reason: there is no shared package,
  // so the duplication is deliberate and checked rather than allowed to rot
  assert.equal(
    read('admin-portal', 'src', 'utils', 'invoiceSummary.js'),
    read('frontend', 'src', 'utils', 'invoiceSummary.js'),
    'admin-portal and frontend copies of invoiceSummary.js differ'
  );
});

test('the lines come out in order, with GST before Discount', () => {
  const summary = invoiceSummary({
    subtotal: 10000, taxPercentage: 0, taxAmount: 0,
    discountPercentage: 10, discountAmount: 1000, totalAmount: 9000, balanceAmount: 9000
  });
  assert.deepEqual(summary.lines.map(line => line.label), [SUBTOTAL_LABEL, 'GST (0%)', 'Discount (10%)']);
  assert.equal(summary.totalLabel, TOTAL_LABEL);
  assert.equal(summary.balanceLabel, BALANCE_LABEL);
});

test('GST always renders; the discount only where the estimate gave one', () => {
  const plain = invoiceSummary({ subtotal: 10000, totalAmount: 10000 });
  assert.deepEqual(plain.lines.map(line => line.key), ['subtotal', 'gst']);
  assert.equal(plain.hasDiscount, false);
});

test('Balance Due follows the money: the total unpaid, 0 once settled', () => {
  assert.equal(invoiceSummary({ totalAmount: 9000, amountPaid: 0, balanceAmount: 9000 }).balanceDue, 9000);
  assert.equal(invoiceSummary({ totalAmount: 9000, amountPaid: 4000, balanceAmount: 5000 }).balanceDue, 5000);
  assert.equal(invoiceSummary({ totalAmount: 9000, amountPaid: 9000, balanceAmount: 0 }).balanceDue, 0);
});

for (const [file, what] of SURFACES) {
  test(`${what} renders the shared lines rather than its own`, () => {
    const body = read(...file.split('/'));
    assert.match(body, /invoiceSummary|InvoiceSummaryCard/, `${what} does not use the shared summary`);
    if (/InvoiceSummaryCard/.test(body) && !/export default function InvoiceSummaryCard/.test(body)) return;
    assert.match(body, /\.lines\.map\(/, `${what} does not map the shared lines`);
    assert.match(body, /balanceDue/, `${what} states no Balance Due`);
    // Nothing hand-writes the lines the helper owns
    assert.doesNotMatch(body, />\s*Subtotal\s*</, `${what} still hard-codes a Subtotal row`);
    assert.doesNotMatch(body, /Discount \(\{/, `${what} still hard-codes a Discount row`);
    assert.doesNotMatch(body, /Grand Total/, `${what} still calls the total a Grand Total`);
  });

  test(`${what} states no Amount Paid in the summary`, () => {
    // What came in is the payment history's job; the summary answers what is still owed
    const body = read(...file.split('/'));
    const summarySection = body.slice(body.indexOf('Price Summary') >= 0 ? body.indexOf('Price Summary') : 0);
    assert.doesNotMatch(summarySection.slice(0, 2500), />\s*Amount Paid\s*</, `${what} prints Amount Paid beside the total`);
  });
}

test('the two staff modals share one card instead of a copy each', () => {
  for (const file of ['admin-portal/src/pages/billing/Invoices.jsx',
    'admin-portal/src/pages/billing/GeneratedInvoices.jsx']) {
    const body = read(...file.split('/'));
    assert.match(body, /<InvoiceSummaryCard/, `${file} does not mount the shared card`);
    assert.doesNotMatch(body, /text-\[9px\] font-bold uppercase tracking-\[0\.14em\] text-warm-muted">Price Summary/,
      `${file} has its own copy of the summary card back`);
  }
});

test("the invoices export lists the summary's own columns, in order", () => {
  const body = read('admin-portal', 'src', 'pages', 'billing', 'Invoices.jsx');
  const order = ["'Sub Total (₹)'", "'GST (%)'", "'GST Amount (₹)'", "'Discount (%)'",
    "'Discount Amount (₹)'", "'Total (₹)'", "'Balance Due (₹)'"];
  const at = order.map(token => body.indexOf(token));
  for (const [index, position] of at.entries()) {
    assert.ok(position > 0, `${order[index]} is not an exported column`);
    if (index) assert.ok(position > at[index - 1], `${order[index]} is out of order`);
  }
});
