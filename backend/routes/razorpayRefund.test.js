const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Refunds are a ledger, not a flag. `payment_refunds` (schema_v55, ensured at boot) carries
 * one row per Razorpay refund keyed on razorpay_refund_id, and settled money is defined as
 * SUM(payments paid|completed) - SUM(payment_refunds processed).
 *
 * What this replaced: the webhook wrote payment_status='unpaid', which is not an ENUM member
 * (errno 1265 lost the whole adjustment), a refunded payment kept status='paid' so SUM-based
 * readers still counted returned money, a retried refund.processed decremented twice, and a
 * PARTIAL refund had no representation at all.
 *
 * Run: node --test backend/routes/razorpayRefund.test.js
 */

const routes = fs.readFileSync(path.join(__dirname, 'razorpay.js'), 'utf8');
const customers = fs.readFileSync(path.join(__dirname, 'customers.js'), 'utf8');
const settlement = fs.readFileSync(path.join(__dirname, '..', 'utils', 'invoiceSettlement.js'), 'utf8');
const ledger = fs.readFileSync(path.join(__dirname, '..', 'utils', 'refundLedger.js'), 'utf8');
const repair = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'repair-invoice-paid-amounts.js'), 'utf8');

const refundIdx = routes.indexOf('async function handleRefund');
const refundBlock = routes.slice(refundIdx, refundIdx + 9000);

test('the webhook never writes the non-existent unpaid member', () => {
  // 'unpaid' is not in payment_status ENUM('pending','partially_paid','paid') — errno 1265
  // used to kill the whole refund UPDATE, so a full refund left the invoice reading paid
  assert.doesNotMatch(refundBlock, /'unpaid'/);
});

test('refunds land in the ledger and the invoice resyncs from it', () => {
  assert.match(refundBlock, /recordRefund\(/, 'the refund is not recorded in payment_refunds');
  assert.match(refundBlock, /resyncInvoiceSettlement\(payment\.invoice_db_id\)/,
    'the invoice is adjusted by hand again instead of resynced from the ledger');
});

test('a retried refund.processed is deduped on the refund id', () => {
  assert.match(refundBlock, /findRefund\(refundEntity\.id\)/);
  assert.match(refundBlock, /already applied — skipping duplicate/);
  assert.match(ledger, /UNIQUE KEY uq_razorpay_refund/);
});

test('a fully-refunded payment leaves the settled set; a partial one keeps its remainder', () => {
  assert.match(refundBlock, /UPDATE payments SET status = 'refunded'/,
    'the payments row stays counted in every SUM of paid/completed after all its money is returned');
  assert.match(refundBlock, /refundTotal\.refunded\) >= parseFloat\(payment\.amount\)/,
    'the refunded flag must depend on the refund total reaching the payment amount');
});

test('settled money is payments minus processed refunds everywhere it is computed', () => {
  assert.match(settlement, /settledRefundTotal\(invoiceId, conn\)/,
    'the resync no longer subtracts refunds');
  const customerSubs = customers.match(/SUM\(amount\) FROM payment_refunds WHERE invoice_id = i\.id AND status = 'processed'/g) || [];
  assert.ok(customerSubs.length >= 5,
    `the customer portal computes amount_paid without subtracting refunds (${customerSubs.length} of 5 sites updated)`);
  assert.match(repair, /FROM payment_refunds\s+WHERE status = 'processed'/,
    'the repair script would zero out legitimately refunded invoices');
});

test('payment_link.paid without a payment entity records the link delta, not its cumulative total', () => {
  // The link's amount_paid is cumulative across instalments; recording it as a new payment
  // double-counted the first instalment when a second partial payment arrived. Refunded rows
  // still count — the link's cumulative includes money that was later returned.
  const paidIdx = routes.indexOf('async function handlePaymentLinkPaid');
  const block = routes.slice(paidIdx, paidIdx + 3500);
  assert.match(block, /recorded_total/, 'the cumulative amount_paid fallback is still recorded as a new payment');
  assert.match(block, /'paid', 'completed', 'refunded'/);
});
