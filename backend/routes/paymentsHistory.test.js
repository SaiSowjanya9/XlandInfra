const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * GET /api/payments/history answers the audit trail behind Billing > Payment History.
 * The screen is a money log: rows that only record an intent -- a payment link created, an
 * offline intent still verification_pending, a field edit -- hide a payment that never
 * settled. The route therefore returns a row only when it lands in a settled status or
 * records a refund (refunded money was paid once).
 *
 * Run: node --test backend/routes/paymentsHistory.test.js
 */

const routes = fs.readFileSync(path.join(__dirname, 'payments.js'), 'utf8');
const historyStart = routes.indexOf("router.get('/history'");
const historyBlock = routes.slice(historyStart, historyStart + 8000);

test('the history returns only rows whose event settled money or refunded it', () => {
  assert.match(historyBlock, /ph\.new_status IN \('paid', 'completed', 'refunded'\)/,
    'verification-pending and failed intents are visible in the history again');
  assert.match(historyBlock, /ph\.action IN \('razorpay_payment', 'refunded', 'refund'\)/,
    'a Razorpay capture or a refund row is filtered out');
});

test('the gate lands inside the /history query, before its optional filters', () => {
  assert.ok(historyStart > -1, 'GET /history route not found');
  assert.ok(historyBlock.indexOf('ph.new_status') < historyBlock.indexOf('pool.execute'),
    'the settled-events clause is not part of the SELECT');
});
